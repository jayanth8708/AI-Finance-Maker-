"""
Statement upload router.
POST /upload/statement  — accepts a bank statement file (CSV / PDF / Excel)
and inserts the parsed transactions for the authenticated user.
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, status
import logging

from app.core.dependencies import get_current_user
from app.database.connection import get_db_connection
from app.services.statement_parser import parse_statement

router = APIRouter(prefix="/upload", tags=["upload"])
logger = logging.getLogger(__name__)

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post("/statement", status_code=status.HTTP_201_CREATED)
async def upload_statement(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """
    Parse a bank statement (CSV / PDF / XLSX) and insert transactions
    for the authenticated user.
    Returns counts of inserted and skipped (duplicate) rows.
    """
    user_id = current_user["id"]

    # --- Size guard ---
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File too large. Maximum allowed size is 10 MB.",
        )

    # --- Parse ---
    try:
        transactions = parse_statement(file.filename, content)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error("Statement parse error: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not parse the statement. Please check the file format.",
        )

    if not transactions:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "No transactions could be extracted from this file. "
                "Make sure the file contains columns for Date, Description, "
                "and Debit/Credit amounts."
            ),
        )

    # --- Insert, skip duplicates ---
    inserted = 0
    skipped = 0

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Fetch existing (date, title, amount, type) tuples for this user
            # to avoid inserting duplicates from re-uploads
            cursor.execute(
                "SELECT date, title, amount, type FROM transactions WHERE user_id = %s",
                (user_id,),
            )
            existing = {
                (str(r["date"]), r["title"], float(r["amount"]), r["type"])
                for r in cursor.fetchall()
            }

            for tx in transactions:
                key = (tx["date"], tx["title"], tx["amount"], tx["type"])
                if key in existing:
                    skipped += 1
                    continue

                cursor.execute(
                    """
                    INSERT INTO transactions
                        (user_id, title, amount, type, category, description, date)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        user_id,
                        tx["title"],
                        tx["amount"],
                        tx["type"],
                        tx["category"],
                        tx.get("description", ""),
                        tx["date"],
                    ),
                )
                inserted += 1
                existing.add(key)  # prevent intra-upload duplicates

        conn.commit()
    except Exception as e:
        logger.error("DB insert error during statement upload: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to save transactions.")
    finally:
        conn.close()

    return {
        "message": f"Upload complete. {inserted} transactions added, {skipped} duplicates skipped.",
        "inserted": inserted,
        "skipped": skipped,
        "total_parsed": len(transactions),
    }
