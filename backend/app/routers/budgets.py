"""
Budgets router: CRUD for category budgets.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from datetime import date

from app.core.dependencies import get_current_user
from app.database.connection import get_db_connection
from app.schemas.finance import BudgetCreate, BudgetUpdate

router = APIRouter(prefix="/budgets", tags=["budgets"])


@router.get("")
async def list_budgets(current_user: dict = Depends(get_current_user)):
    """List all budgets with current month spending."""
    user_id = current_user["id"]
    today = date.today()
    month_start = date(today.year, today.month, 1)

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM budgets WHERE user_id = %s ORDER BY category", (user_id,))
            budgets = cursor.fetchall()

            # Fetch current month spending per category
            cursor.execute(
                """SELECT category, SUM(amount) as spent
                   FROM transactions
                   WHERE user_id = %s AND type = 'expense' AND date >= %s
                   GROUP BY category""",
                (user_id, month_start),
            )
            spending = {row["category"]: float(row["spent"]) for row in cursor.fetchall()}
    finally:
        conn.close()

    for b in budgets:
        b["monthly_limit"] = float(b["monthly_limit"])
        b["spent"] = spending.get(b["category"], 0.0)
        b["created_at"] = str(b["created_at"])
        b["updated_at"] = str(b.get("updated_at", ""))

    return budgets


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_budget(body: BudgetCreate, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            try:
                cursor.execute(
                    "INSERT INTO budgets (user_id, category, monthly_limit) VALUES (%s, %s, %s)",
                    (current_user["id"], body.category.strip(), body.monthly_limit),
                )
                budget_id = cursor.lastrowid
            except Exception as e:
                if "Duplicate" in str(e):
                    raise HTTPException(status_code=409, detail="Budget for this category already exists.")
                raise
            conn.commit()

            cursor.execute("SELECT * FROM budgets WHERE id = %s", (budget_id,))
            b = cursor.fetchone()
    finally:
        conn.close()

    b["monthly_limit"] = float(b["monthly_limit"])
    b["spent"] = 0.0
    b["created_at"] = str(b["created_at"])
    return b


@router.patch("/{budget_id}")
async def update_budget(
    budget_id: int,
    body: BudgetUpdate,
    current_user: dict = Depends(get_current_user),
):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "UPDATE budgets SET monthly_limit = %s WHERE id = %s AND user_id = %s",
                (body.monthly_limit, budget_id, current_user["id"]),
            )
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="Budget not found.")
            conn.commit()

            cursor.execute("SELECT * FROM budgets WHERE id = %s", (budget_id,))
            b = cursor.fetchone()
    finally:
        conn.close()

    b["monthly_limit"] = float(b["monthly_limit"])
    b["created_at"] = str(b["created_at"])
    return b


@router.delete("/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_budget(budget_id: int, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "DELETE FROM budgets WHERE id = %s AND user_id = %s",
                (budget_id, current_user["id"]),
            )
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="Budget not found.")
        conn.commit()
    finally:
        conn.close()
