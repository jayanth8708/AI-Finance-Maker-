"""
Hybrid transaction categorizer.

Priority order:
  1. User-saved merchant rules (from merchant_rules DB table)
  2. Built-in keyword rules (brand names, UPI patterns, etc.)
  3. UPI/IMPS heuristic → 'Transfers'
  4. Mark as 'Uncategorized' — NEVER guess purpose from direction alone.

Critical principle:
  - Debit means money left the account. It does NOT reveal where it went.
  - Credit means money arrived.  It does NOT mean Salary.
  - Do not classify a transaction as Food/Shopping/etc. merely because it is
    a debit. Only keyword evidence in the description justifies a category.
"""
import re
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Category taxonomy  (compatible with existing DB values)
# ─────────────────────────────────────────────────────────────────────────────
EXPENSE_CATEGORIES = [
    "Food", "Healthcare", "Transport", "Shopping", "Rent",
    "Utilities", "Entertainment", "Education", "Personal Care",
    "Transfers", "Refunds", "Other", "Uncategorized",
]
INCOME_CATEGORIES = [
    "Salary", "Investment", "Freelance",
    "Transfers", "Refunds", "Other", "Uncategorized",
]
ALL_CATEGORIES = list(dict.fromkeys(EXPENSE_CATEGORIES + INCOME_CATEGORIES))

# ─────────────────────────────────────────────────────────────────────────────
# Keyword rules
# Each entry: (category, [keywords], applies_to)
# applies_to: 'both' | 'income' | 'expense'
# Rules are evaluated in order; FIRST match wins.
# ─────────────────────────────────────────────────────────────────────────────
_RULES = [
    # ── Refunds (check BEFORE shopping/food so reversals aren't mis-tagged) ──
    ("Refunds", [
        "refund", "reversal", "reversed", "chargeback", "ref rtn", "ref rev",
        "cashback", "money back", "reimburs", "clawback",
    ], "both"),

    # ── Income-only: Salary / Payroll ────────────────────────────────────────
    ("Salary", [
        "salary", "sal cr", "sal credit", "payroll", "wages", "stipend",
        "allowance cr", "hrms salary", "nps cr", "epfo",
    ], "income"),

    # ── Income-only: Investments / Dividends ─────────────────────────────────
    ("Investment", [
        "dividend", "int cr", "interest credit", "interest earned", "interest cr",
        "mf redemption", "sip redemption", "mutual fund redemption",
        "fd maturity", "fixed deposit maturity", "rd maturity",
        "maturity proceeds", "nse dividend", "bse dividend",
    ], "income"),

    # ── Income-only: Freelance / Consulting ──────────────────────────────────
    ("Freelance", [
        "freelance", "consulting fee", "project payment", "invoice payment",
        "professional fee", "contractual payment",
    ], "income"),

    # ── Food & Dining ─────────────────────────────────────────────────────────
    ("Food", [
        "swiggy", "zomato", "blinkit", "zepto", "bigbasket", "grofers",
        "dunzo", "milkbasket", "jiomart food", "country delight",
        "restaurant", "cafe", "coffee", "bakery", "eatery", "canteen",
        "domino", "mcdonald", "kfc", "pizza hut", "burger king",
        "subway", "starbucks", "ccd", "barista", "chaayos", "chai point",
        "grocery store", "supermarket", "reliance fresh", "dmart",
        "nature basket", "spar hypermarket", "more supermarket", "lulu market",
        "food delivery", "tiffin service",
    ], "both"),

    # ── Medical & Healthcare ──────────────────────────────────────────────────
    ("Healthcare", [
        "apollo", "fortis", "max hospital", "aiims", "medanta", "narayana",
        "kokilaben", "lilavati hospital",
        "hospital", "clinic", "doctor", "physician",
        "pharmacy", "chemist", "medplus", "netmeds", "1mg", "pharmeasy",
        "wellness", "healthkart",
        "medicine", "medical", "diagnostic", "health check", "dental",
        "optical", "eye care",
        "pathology", "blood test", "lab test", "scan report", "xray", "x-ray",
        "physiotherapy", "ambulance",
    ], "both"),

    # ── Transport ─────────────────────────────────────────────────────────────
    ("Transport", [
        "ola cab", "uber", "rapido", "meru cab", "taxi", "cab ride",
        "irctc", "indian railway", "railway reservation", "train ticket",
        "redbus", "apsrtc", "ksrtc", "msrtc", "gsrtc", "bus ticket",
        "metro card", "dmrc", "bmtc", "nmmt", "best bus", "metro recharge",
        "petrol", "diesel", "fuel station", "hp petrol", "bharat petroleum",
        "iocl", "indian oil", "hindustan petroleum",
        "fastag", "toll plaza", "toll tax", "highway toll", "parking fee",
        "indigo", "air india", "spicejet", "vistara", "go first",
        "goair", "akasa air",
        "makemytrip", "goibibo", "cleartrip", "ixigo", "yatra",
    ], "both"),

    # ── Shopping ──────────────────────────────────────────────────────────────
    ("Shopping", [
        "amazon", "flipkart", "myntra", "ajio", "meesho", "nykaa", "snapdeal",
        "tata cliq", "reliance digital", "croma", "vijay sales", "poorvika",
        "shopclues", "pepperfry", "urbanic", "shein",
        "pos txn", "pos debit", "card purchase", "pos purchase",
    ], "both"),

    # ── Rent & Housing ────────────────────────────────────────────────────────
    ("Rent", [
        "house rent", "flat rent", "pg rent", "apartment rent",
        "room rent", "hostel rent",
        "maintenance charge", "society maintenance", "property tax",
        "housing board",
    ], "both"),

    # ── Utilities & Bills ─────────────────────────────────────────────────────
    ("Utilities", [
        "electricity bill", "bescom", "mseb", "tata power", "adani electricity",
        "tneb", "uppcl", "cesc electricity",
        "water bill", "water charge", "water supply",
        "gas bill", "indane gas", "bharat gas", "hp gas cylinder",
        "jio", "airtel", "bsnl", "vi prepaid", "vodafone", "idea cellular",
        "mobile recharge", "phone recharge", "broadband", "internet bill",
        "dth recharge", "tata sky", "dish tv", "sun direct", "d2h",
        "postpaid bill", "prepaid recharge", "bbps", "bill payment",
        "insurance premium", "lic premium", "health insurance premium",
        "term insurance", "vehicle insurance", "car insurance", "bike insurance",
    ], "both"),

    # ── Entertainment & Subscriptions ─────────────────────────────────────────
    ("Entertainment", [
        "netflix", "amazon prime", "hotstar", "disney+", "jiocinema",
        "sony liv", "zee5", "alt balaji", "voot", "mxplayer",
        "spotify", "gaana", "wynk", "jiosaavn", "apple music",
        "youtube premium",
        "pvr cinema", "inox", "cinepolis", "movie ticket", "bookmyshow",
        "gaming", "steam", "playstation", "xbox", "nintendo",
        "amusement park", "theme park",
    ], "both"),

    # ── Education ────────────────────────────────────────────────────────────
    ("Education", [
        "school fee", "college fee", "tuition fee", "university fee",
        "course fee", "exam fee", "admission fee",
        "udemy", "coursera", "skillshare", "unacademy", "byju", "vedantu",
        "whitehat jr", "toppr", "doubtnut",
        "books", "stationery", "library fee",
    ], "both"),

    # ── Personal Care ─────────────────────────────────────────────────────────
    ("Personal Care", [
        "salon", "spa", "haircut", "barber", "beauty parlour", "parlour",
        "grooming", "cosmetics", "skincare",
    ], "both"),
]


class _CompiledRule:
    __slots__ = ("category", "applies_to", "keywords")

    def __init__(self, category, applies_to, keywords):
        self.category   = category
        self.applies_to = applies_to
        self.keywords   = [k.lower() for k in keywords]


_COMPILED: list[_CompiledRule] = [
    _CompiledRule(cat, app, kws) for cat, kws, app in _RULES
]

# Patterns that indicate a UPI/IMPS/NEFT transaction (person-to-person transfer)
_UPI_IMPS_RE = re.compile(
    r"(?:UPI[-/:]|IMPS[-/]?\d{8,}|NEFT[-/:]|RTGS[-/:])", re.IGNORECASE
)

# Rows to skip (not real transactions)
_SKIP_PHRASES = frozenset([
    "opening balance", "b/f balance", "balance b/f",
    "balance brought forward", "closing balance", "carry forward",
    "grand total", "sub total", "total", "page total",
])


def is_skip_description(description: str) -> bool:
    """Return True if this row is an opening/closing balance or totals row."""
    dl = description.strip().lower()
    return any(phrase in dl for phrase in _SKIP_PHRASES)


def categorize(
    description: str,
    tx_type: str,
    user_rules: list | None = None,
) -> tuple[str, str, bool]:
    """
    Categorize a single transaction.

    Args:
        description: raw narration text from the statement
        tx_type:     'income' or 'expense'
        user_rules:  list of {'keyword': str, 'category': str} dicts (from DB)

    Returns:
        (category, source, needs_review)
          category    – category string
          source      – 'user' | 'rule' | 'uncategorized'
          needs_review– True when the category is uncertain
    """
    dl = description.lower()

    # ── 1. User-saved rules (highest priority) ──────────────────────────────
    if user_rules:
        for rule in user_rules:
            kw = rule.get("keyword", "").lower().strip()
            if kw and kw in dl:
                return rule["category"], "user", False

    # ── 2. Built-in keyword rules ────────────────────────────────────────────
    for rule in _COMPILED:
        if rule.applies_to == "income"  and tx_type != "income":
            continue
        if rule.applies_to == "expense" and tx_type != "expense":
            continue
        for kw in rule.keywords:
            if kw in dl:
                return rule.category, "rule", False

    # ── 3. UPI/IMPS heuristic: generic payment reference → Transfer ──────────
    if _UPI_IMPS_RE.search(description):
        return "Transfers", "rule", False

    # ── 4. Cannot determine — mark for review ───────────────────────────────
    return "Uncategorized", "uncategorized", True


def load_user_rules(conn, user_id: int) -> list:
    """Load user's saved merchant rules from DB. Returns [] on any failure."""
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT keyword, category FROM merchant_rules "
                "WHERE user_id = %s ORDER BY created_at DESC",
                (user_id,),
            )
            return list(cursor.fetchall())
    except Exception as exc:
        logger.debug("Could not load merchant rules: %s", exc)
        return []
