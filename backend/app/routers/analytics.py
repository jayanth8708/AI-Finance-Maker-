"""Analytics router: spending summaries, monthly trends."""
from fastapi import APIRouter, Depends
from datetime import date
from app.core.dependencies import get_current_user
from app.database.connection import get_db_connection

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/summary")
async def get_summary(current_user: dict = Depends(get_current_user)):
    """Current month and overall financial summary."""
    user_id = current_user["id"]
    today = date.today()
    month_start = date(today.year, today.month, 1)

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # All-time totals
            cursor.execute(
                """SELECT
                     SUM(CASE WHEN type='income' THEN amount ELSE 0 END) as total_income,
                     SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as total_expense
                   FROM transactions WHERE user_id = %s""",
                (user_id,),
            )
            totals = cursor.fetchone()

            # Current month totals
            cursor.execute(
                """SELECT
                     SUM(CASE WHEN type='income' THEN amount ELSE 0 END) as month_income,
                     SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as month_expense
                   FROM transactions WHERE user_id = %s AND date >= %s""",
                (user_id, month_start),
            )
            monthly = cursor.fetchone()

            # Category breakdown (expenses, last 30 days)
            cursor.execute(
                """SELECT category, SUM(amount) as total
                   FROM transactions
                   WHERE user_id = %s AND type='expense' AND date >= %s
                   GROUP BY category ORDER BY total DESC""",
                (user_id, month_start),
            )
            categories = cursor.fetchall()
    finally:
        conn.close()

    total_income = float(totals["total_income"] or 0)
    total_expense = float(totals["total_expense"] or 0)
    month_income = float(monthly["month_income"] or 0)
    month_expense = float(monthly["month_expense"] or 0)

    return {
        "total_income": total_income,
        "total_expense": total_expense,
        "net_savings": total_income - total_expense,
        "month_income": month_income,
        "month_expense": month_expense,
        "month_savings": month_income - month_expense,
        "categories": [
            {"category": r["category"], "total": float(r["total"])} for r in categories
        ],
    }


@router.get("/monthly-trends")
async def get_monthly_trends(
    months: int = 6,
    current_user: dict = Depends(get_current_user),
):
    """Monthly income, expense, and savings for the last N months."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """SELECT
                     DATE_FORMAT(date, '%%Y-%%m') as month,
                     SUM(CASE WHEN type='income' THEN amount ELSE 0 END) as income,
                     SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as expense
                   FROM transactions
                   WHERE user_id = %s AND date >= DATE_SUB(CURDATE(), INTERVAL %s MONTH)
                   GROUP BY month
                   ORDER BY month ASC""",
                (current_user["id"], months),
            )
            rows = cursor.fetchall()
    finally:
        conn.close()

    result = []
    for r in rows:
        income = float(r["income"] or 0)
        expense = float(r["expense"] or 0)
        result.append({
            "month": r["month"],
            "income": income,
            "expense": expense,
            "savings": income - expense,
        })

    return result


@router.get("/category-breakdown")
async def get_category_breakdown(current_user: dict = Depends(get_current_user)):
    """Expense breakdown by category (all time)."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """SELECT category, SUM(amount) as total, COUNT(*) as count
                   FROM transactions
                   WHERE user_id = %s AND type='expense'
                   GROUP BY category ORDER BY total DESC""",
                (current_user["id"],),
            )
            rows = cursor.fetchall()
    finally:
        conn.close()

    return [{"category": r["category"], "total": float(r["total"]), "count": r["count"]} for r in rows]
