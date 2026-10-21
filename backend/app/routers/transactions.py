"""
Transactions router: CRUD for user transactions.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import Optional, List
import logging

from app.core.dependencies import get_current_user
from app.database.connection import get_db_connection
from app.schemas.finance import TransactionCreate, TransactionUpdate, TransactionOut

router = APIRouter(prefix="/transactions", tags=["transactions"])
logger = logging.getLogger(__name__)


@router.get("")
async def list_transactions(
    search: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    sort_by: str = Query("date"),
    sort_dir: str = Query("desc"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    allowed_sort = {"date", "amount", "title", "category", "created_at"}
    if sort_by not in allowed_sort:
        sort_by = "date"
    sort_dir = "DESC" if sort_dir.lower() == "desc" else "ASC"

    conditions = ["user_id = %s"]
    params = [current_user["id"]]

    if search:
        conditions.append("(title LIKE %s OR description LIKE %s OR category LIKE %s)")
        like = f"%{search}%"
        params += [like, like, like]

    if type in ("income", "expense"):
        conditions.append("type = %s")
        params.append(type)

    if category:
        conditions.append("category = %s")
        params.append(category)

    where = " AND ".join(conditions)
    offset = (page - 1) * per_page

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(f"SELECT COUNT(*) as cnt FROM transactions WHERE {where}", params)
            total = cursor.fetchone()["cnt"]

            cursor.execute(
                f"SELECT * FROM transactions WHERE {where} ORDER BY {sort_by} {sort_dir} LIMIT %s OFFSET %s",
                params + [per_page, offset],
            )
            rows = cursor.fetchall()
    finally:
        conn.close()

    # Serialize dates
    for row in rows:
        row["date"] = str(row["date"])
        row["created_at"] = str(row["created_at"])
        row["updated_at"] = str(row.get("updated_at", ""))

    return {
        "data": rows,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_transaction(
    body: TransactionCreate,
    current_user: dict = Depends(get_current_user),
):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """INSERT INTO transactions (user_id, title, amount, type, category, description, date)
                   VALUES (%s, %s, %s, %s, %s, %s, %s)""",
                (
                    current_user["id"],
                    body.title,
                    body.amount,
                    body.type,
                    body.category,
                    body.description,
                    body.date,
                ),
            )
            tx_id = cursor.lastrowid
        conn.commit()

        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM transactions WHERE id = %s", (tx_id,))
            tx = cursor.fetchone()
    finally:
        conn.close()

    tx["date"] = str(tx["date"])
    tx["created_at"] = str(tx["created_at"])
    tx["updated_at"] = str(tx.get("updated_at", ""))
    return tx


@router.get("/{tx_id}")
async def get_transaction(tx_id: int, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT * FROM transactions WHERE id = %s AND user_id = %s",
                (tx_id, current_user["id"]),
            )
            tx = cursor.fetchone()
    finally:
        conn.close()

    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found.")

    tx["date"] = str(tx["date"])
    tx["created_at"] = str(tx["created_at"])
    tx["updated_at"] = str(tx.get("updated_at", ""))
    return tx


@router.patch("/{tx_id}")
async def update_transaction(
    tx_id: int,
    body: TransactionUpdate,
    current_user: dict = Depends(get_current_user),
):
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update.")

    fields = ", ".join(f"{k} = %s" for k in updates)
    values = list(updates.values())

    # Serialize date
    if "date" in updates:
        values[list(updates.keys()).index("date")] = str(updates["date"])

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                f"UPDATE transactions SET {fields} WHERE id = %s AND user_id = %s",
                values + [tx_id, current_user["id"]],
            )
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="Transaction not found.")

            cursor.execute("SELECT * FROM transactions WHERE id = %s", (tx_id,))
            tx = cursor.fetchone()
        conn.commit()
    finally:
        conn.close()

    tx["date"] = str(tx["date"])
    tx["created_at"] = str(tx["created_at"])
    tx["updated_at"] = str(tx.get("updated_at", ""))
    return tx


@router.delete("/{tx_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(tx_id: int, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "DELETE FROM transactions WHERE id = %s AND user_id = %s",
                (tx_id, current_user["id"]),
            )
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="Transaction not found.")
        conn.commit()
    finally:
        conn.close()
