"""
Bank Statement Parser
Supports: CSV, PDF (text-based), Excel (.xlsx / .xls)
Auto-detects columns and categorizes transactions.
"""
import re
import io
import logging
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Category keyword map (case-insensitive partial match)
# ---------------------------------------------------------------------------
CATEGORY_RULES = {
    "Salary": [
        "salary", "sal credit", "payroll", "wages", "stipend",
    ],
    "Freelance": [
        "freelance", "consulting", "project payment", "invoice",
    ],
    "Investment": [
        "dividend", "mutual fund", "mf redemption", "sip", "nse", "bse",
        "stocks", "shares", "zerodha", "groww", "kuvera",
    ],
    "Rent": [
        "rent", "house rent", "flat rent", "pg rent", "accommodation",
    ],
    "Food": [
        "swiggy", "zomato", "restaurant", "cafe", "coffee", "hotel",
        "dominos", "mcdonald", "kfc", "pizza", "dining", "food",
        "breakfast", "lunch", "dinner", "grocery", "bigbasket",
        "blinkit", "dunzo", "supermarket", "bakery",
    ],
    "Transport": [
        "ola", "uber", "rapido", "metro", "irctc", "railway", "bus",
        "petrol", "fuel", "fastag", "toll", "parking", "cab",
    ],
    "Shopping": [
        "amazon", "flipkart", "myntra", "ajio", "meesho", "nykaa",
        "mall", "shopping", "store", "retail", "purchase",
    ],
    "Entertainment": [
        "netflix", "hotstar", "prime video", "spotify", "youtube",
        "gaming", "steam", "movie", "pvr", "inox", "ticket",
        "concert", "event", "subscription", "ott",
    ],
    "Healthcare": [
        "hospital", "clinic", "doctor", "pharmacy", "medicine",
        "medical", "health", "diagnostic", "lab", "test",
        "apollo", "fortis", "max hospital",
    ],
    "Education": [
        "college", "university", "school", "tuition", "course",
        "udemy", "coursera", "byju", "unacademy", "exam fee",
    ],
    "Utilities": [
        "electricity", "water bill", "gas bill", "internet", "broadband",
        "mobile recharge", "phone bill", "dth", "cable", "wifi",
        "jio", "airtel", "bsnl", "tata sky",
    ],
}


def categorize(description: str) -> str:
    """Return a category string based on the transaction description."""
    desc_lower = description.lower()
    for category, keywords in CATEGORY_RULES.items():
        for kw in keywords:
            if kw in desc_lower:
                return category
    return "Other"


# ---------------------------------------------------------------------------
# Date parsing helpers
# ---------------------------------------------------------------------------
DATE_FORMATS = [
    "%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%d-%m-%y",
    "%Y-%m-%d", "%Y/%m/%d",
    "%d %b %Y", "%d %b %y", "%d-%b-%Y", "%d-%b-%y",
    "%d %B %Y", "%d %B %y",
    "%m/%d/%Y", "%m-%d-%Y",
]


def parse_date(raw: str) -> Optional[str]:
    """Parse a raw date string into YYYY-MM-DD. Returns None if unparseable."""
    raw = raw.strip()
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def parse_amount(raw: str) -> Optional[float]:
    """Clean and parse a numeric amount string."""
    if not raw or str(raw).strip() in ("", "-", "nan"):
        return None
    cleaned = re.sub(r"[₹,\s]", "", str(raw)).strip()
    try:
        return float(cleaned)
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Column name detection
# ---------------------------------------------------------------------------
DATE_ALIASES    = {"date", "txn date", "transaction date", "value date",
                   "posting date", "trans date", "tran date"}
DESC_ALIASES    = {"description", "narration", "particulars", "details",
                   "remarks", "transaction details", "ref", "reference"}
DEBIT_ALIASES   = {"debit", "dr", "withdrawal", "withdrawl", "debit amount",
                   "dr amount", "amount debited"}
CREDIT_ALIASES  = {"credit", "cr", "deposit", "credit amount", "cr amount",
                   "amount credited"}
AMOUNT_ALIASES  = {"amount", "txn amount", "transaction amount"}
TYPE_ALIASES    = {"type", "dr/cr", "dr / cr", "credit/debit"}


def _find_col(headers: list[str], aliases: set[str]) -> Optional[int]:
    for i, h in enumerate(headers):
        if h.strip().lower() in aliases:
            return i
    return None


# ---------------------------------------------------------------------------
# Row → transaction dict
# ---------------------------------------------------------------------------
def _build_transaction(
    date_str: str,
    description: str,
    debit_str: Optional[str],
    credit_str: Optional[str],
    type_str: Optional[str] = None,
) -> Optional[dict]:
    date = parse_date(date_str)
    if not date:
        return None

    description = description.strip()
    if not description:
        return None

    debit  = parse_amount(debit_str)  if debit_str  else None
    credit = parse_amount(credit_str) if credit_str else None

    if debit and debit > 0:
        tx_type = "expense"
        amount  = debit
    elif credit and credit > 0:
        tx_type = "income"
        amount  = credit
    else:
        return None  # No usable amount

    # Override with explicit type column if present
    if type_str:
        t = type_str.strip().upper()
        if t in ("DR", "DEBIT"):
            tx_type = "expense"
        elif t in ("CR", "CREDIT"):
            tx_type = "income"

    category = categorize(description)

    return {
        "title":       description[:200],
        "amount":      round(amount, 2),
        "type":        tx_type,
        "category":    category,
        "description": "",
        "date":        date,
    }


# ---------------------------------------------------------------------------
# Parse rows (shared logic once headers are known)
# ---------------------------------------------------------------------------
def _parse_rows(headers: list[str], rows: list[list[str]]) -> list[dict]:
    h = [c.strip().lower() for c in headers]

    date_i   = _find_col(h, DATE_ALIASES)
    desc_i   = _find_col(h, DESC_ALIASES)
    debit_i  = _find_col(h, DEBIT_ALIASES)
    credit_i = _find_col(h, CREDIT_ALIASES)
    amt_i    = _find_col(h, AMOUNT_ALIASES)
    type_i   = _find_col(h, TYPE_ALIASES)

    if date_i is None or desc_i is None:
        logger.warning("Could not identify date/description columns in headers: %s", headers)
        return []

    transactions = []
    for row in rows:
        if len(row) <= max(filter(lambda x: x is not None,
                                  [date_i, desc_i, debit_i, credit_i, amt_i, type_i or 0])):
            continue

        def _get(idx):
            if idx is not None and idx < len(row):
                return str(row[idx]).strip()
            return None

        date_str = _get(date_i)
        desc_str = _get(desc_i)
        type_str = _get(type_i)

        if debit_i is not None or credit_i is not None:
            tx = _build_transaction(date_str, desc_str, _get(debit_i), _get(credit_i), type_str)
        elif amt_i is not None:
            # Single amount column — use type column to determine direction
            tx = _build_transaction(date_str, desc_str, None, None, type_str)
            if tx is None and amt_i is not None:
                # Try treating amount as debit if no type column
                amt_val = _get(amt_i)
                if type_str and type_str.upper() in ("CR", "CREDIT"):
                    tx = _build_transaction(date_str, desc_str, None, amt_val, type_str)
                else:
                    tx = _build_transaction(date_str, desc_str, amt_val, None, type_str)
        else:
            continue

        if tx:
            transactions.append(tx)

    return transactions


# ---------------------------------------------------------------------------
# CSV parser
# ---------------------------------------------------------------------------
def parse_csv(content: bytes) -> list[dict]:
    import csv
    text = content.decode("utf-8", errors="replace")
    reader = csv.reader(io.StringIO(text))
    all_rows = list(reader)

    # Find the header row — first row that has at least one date alias or desc alias column
    header_idx = 0
    for i, row in enumerate(all_rows):
        lowered = {c.strip().lower() for c in row}
        if lowered & DATE_ALIASES and lowered & DESC_ALIASES:
            header_idx = i
            break

    headers = all_rows[header_idx]
    data_rows = all_rows[header_idx + 1:]
    return _parse_rows(headers, data_rows)


# ---------------------------------------------------------------------------
# Excel parser
# ---------------------------------------------------------------------------
def parse_excel(content: bytes) -> list[dict]:
    import openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
    ws = wb.active

    all_rows = []
    for row in ws.iter_rows(values_only=True):
        all_rows.append([str(c) if c is not None else "" for c in row])

    # Find header row
    header_idx = 0
    for i, row in enumerate(all_rows):
        lowered = {c.strip().lower() for c in row}
        if lowered & DATE_ALIASES and lowered & DESC_ALIASES:
            header_idx = i
            break

    headers = all_rows[header_idx]
    data_rows = all_rows[header_idx + 1:]
    return _parse_rows(headers, data_rows)


# ---------------------------------------------------------------------------
# PDF parser
# ---------------------------------------------------------------------------
def parse_pdf(content: bytes) -> list[dict]:
    import pdfplumber

    transactions = []
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            for table in tables:
                if not table or len(table) < 2:
                    continue

                # Find the header row in the table
                header_idx = 0
                for i, row in enumerate(table):
                    if row is None:
                        continue
                    lowered = {str(c or "").strip().lower() for c in row}
                    if lowered & DATE_ALIASES and lowered & DESC_ALIASES:
                        header_idx = i
                        break

                headers = [str(c or "") for c in table[header_idx]]
                data_rows = [[str(c or "") for c in r] for r in table[header_idx + 1:] if r]
                transactions.extend(_parse_rows(headers, data_rows))

    return transactions


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------
def parse_statement(filename: str, content: bytes) -> list[dict]:
    """
    Parse a bank statement file.
    Returns a list of transaction dicts ready for DB insertion.
    """
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext == "pdf":
        txns = parse_pdf(content)
    elif ext in ("xlsx", "xls"):
        txns = parse_excel(content)
    elif ext == "csv":
        txns = parse_csv(content)
    else:
        raise ValueError(f"Unsupported file type: .{ext}. Please upload CSV, PDF, or Excel.")

    # Deduplicate within the upload by (date, title, amount, type)
    seen = set()
    unique = []
    for tx in txns:
        key = (tx["date"], tx["title"], tx["amount"], tx["type"])
        if key not in seen:
            seen.add(key)
            unique.append(tx)

    return unique
