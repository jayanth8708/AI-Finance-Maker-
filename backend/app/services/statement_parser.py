"""
Bank Statement Parser -- v3
Supports: PDF (text-based via PyMuPDF + pdfplumber fallback), CSV, Excel

Canara Bank layout (and similar Indian e-passbook formats):
  Date column   (x ~  26)  ->  one word per transaction, y = anchor_y
  Narration col (x ~ 106)  ->  many lines above the anchor row
  Deposits col  (x ~ 310)  ->  one word per transaction, y = anchor_y
  Withdrawals   (x ~ 413)  ->  one word per transaction, y = anchor_y
  Balance       (x ~ 517)  ->  one word per transaction, y = anchor_y
  Chq line appears ~42pts BELOW anchor_y, in the narration column.

Algorithm for anchor-row PDFs:
  1. Detect header row to get column x-bounds.
  2. Identify anchor rows: rows with BOTH a date-col word AND >= 1 amount word.
  3. For each anchor, find the Chq: row y (anchor_y + ~42).
  4. Narration = all narration-col words from prev_chq_y to anchor_y (inclusive).
  5. Reference = Chq/UTR line (extracted and removed from narration).
  6. prev_y advances to chq_y (not anchor_y) before the next transaction.
"""
import re
import io
import logging
from datetime import datetime
from typing import Optional

from app.services.categorizer import categorize, is_skip_description

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Date / Amount helpers
# ---------------------------------------------------------------------------
DATE_FORMATS = [
    "%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%d-%m-%y",
    "%Y-%m-%d", "%Y/%m/%d",
    "%d %b %Y", "%d %b %y", "%d-%b-%Y", "%d-%b-%y",
    "%d %B %Y", "%d %B %y",
    "%m/%d/%Y", "%m-%d-%Y",
]


def parse_date(raw: str) -> Optional[str]:
    """Parse any recognised date string to ISO YYYY-MM-DD. None if unrecognised."""
    if not raw:
        return None
    raw = raw.strip()
    raw = re.sub(r"\s+\d{1,2}:\d{2}.*$", "", raw).strip()
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def parse_amount(raw: str) -> Optional[float]:
    """
    Parse a bank-statement amount string to a positive float.
    Returns None for blank, zero, dash, or NIL.
    Handles Indian number formatting (e.g. 1,23,456.78).
    """
    if not raw:
        return None
    s = str(raw).strip()
    if s.upper() in ("", "-", "NAN", "NIL", "0", "0.00", "0.000"):
        return None
    s = re.sub(r"[^\d.,\-\(\)]", "", s)
    s = re.sub(r"(?i)(cr|dr)$", "", s)
    s = s.replace("(", "-").replace(")", "")
    s = s.replace(",", "")
    try:
        val = float(s)
        return round(val, 2) if val > 0 else None
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Column header aliases
# ---------------------------------------------------------------------------
_DATE_EXACT = {
    "date", "txn date", "trans date", "tran date", "transaction date",
    "value date", "posting date", "trans. date", "book date", "entry date",
    "transact. date",
}
_NARR_EXACT = {
    "narration", "description", "particulars", "details", "remarks",
    "transaction details", "transaction remarks", "txn remark",
    "cheque no./ref no.", "ref no./cheque no.",
}
_DEBIT_EXACT = {
    "debit", "dr", "withdrawal", "withdrawl", "withdrawal amt.",
    "withdrawal(dr)", "debit amount", "dr amount", "withdrawals",
    "dr.amt.(rs.)", "with.amt(rs.)",
}
_CREDIT_EXACT = {
    "credit", "cr", "deposit", "deposit amt.", "deposit(cr)",
    "credit amount", "cr amount", "deposits", "cr.amt.(rs.)",
    "dep.amt(rs.)",
}
_BAL_EXACT = {
    "balance", "closing balance", "running balance", "available balance",
    "closing bal.", "bal.", "balance(cr/dr)", "closing bal",
}
_TYPE_EXACT = {"type", "dr/cr", "dr / cr", "cr/dr", "txn type"}
_AMT_EXACT  = {"amount", "txn amount", "transaction amount"}


def _match_header(text: str) -> Optional[str]:
    """Map a header cell to a canonical column name, or None."""
    tl = text.strip().lower()
    if tl in _DATE_EXACT:   return "date"
    if tl in _NARR_EXACT:   return "narration"
    if tl in _DEBIT_EXACT:  return "debit"
    if tl in _CREDIT_EXACT: return "credit"
    if tl in _BAL_EXACT:    return "balance"
    if tl in _TYPE_EXACT:   return "txtype"
    if tl in _AMT_EXACT:    return "amount"
    if "date" in tl and any(k in tl for k in ("txn", "trans", "value", "post")):
        return "date"
    if any(k in tl for k in ("narrat", "descript", "particul", "remark", "detail")):
        return "narration"
    if any(k in tl for k in ("withdrawal", "debit", "dr amt")):
        return "debit"
    if any(k in tl for k in ("deposit", "credit", "cr amt")):
        return "credit"
    if "balance" in tl or "closing" in tl:
        return "balance"
    return None


def _find_col_idx(headers: list, canonical: str) -> Optional[int]:
    for i, h in enumerate(headers):
        if _match_header(h) == canonical:
            return i
    return None


# ---------------------------------------------------------------------------
# Shared transaction builder
# ---------------------------------------------------------------------------
def _build_tx(
    date_str:    str,
    narration:   str,
    debit_str:   Optional[str] = None,
    credit_str:  Optional[str] = None,
    balance_str: Optional[str] = None,
    txtype_str:  Optional[str] = None,
    amount_str:  Optional[str] = None,
    reference:   Optional[str] = None,
    user_rules:  Optional[list] = None,
) -> Optional[dict]:
    """
    Build a normalised transaction dict from raw extracted fields.
    Returns None for rows that are invalid or should be skipped.
    """
    date = parse_date(date_str)
    if not date:
        return None

    narration = (narration or "").strip()
    if not narration:
        return None

    if is_skip_description(narration):
        return None

    debit  = parse_amount(debit_str)
    credit = parse_amount(credit_str)
    amt    = parse_amount(amount_str)

    if debit is not None:
        tx_type, amount = "expense", debit
    elif credit is not None:
        tx_type, amount = "income", credit
    elif amt is not None:
        if txtype_str:
            t = txtype_str.strip().upper()
            tx_type = "income" if t in ("CR", "CREDIT", "C") else "expense"
        else:
            tx_type = "expense"
        amount = amt
    else:
        return None

    if txtype_str:
        t = txtype_str.strip().upper()
        if t in ("CR", "CREDIT", "C"):
            tx_type = "income"
        elif t in ("DR", "DEBIT", "D"):
            tx_type = "expense"

    # Infer type from UPI/CR or UPI/DR in narration (Canara, SBI pattern)
    narr_up = narration.upper()
    if re.search(r"\bUPI/CR\b", narr_up):
        tx_type = "income"
    elif re.search(r"\bUPI/DR\b", narr_up):
        tx_type = "expense"

    balance  = parse_amount(balance_str)
    category, source, needs_review = categorize(narration, tx_type, user_rules)

    return {
        "title":                 narration[:200],
        "amount":                round(amount, 2),
        "type":                  tx_type,
        "category":              category,
        "description":           reference or "",
        "date":                  date,
        "balance":               balance,
        "categorization_source": source,
        "needs_review":          needs_review,
        "transaction_reference": reference or "",
    }


# ---------------------------------------------------------------------------
# Tabular row parser  (shared by CSV + Excel)
# ---------------------------------------------------------------------------
def _parse_rows(headers: list, rows: list, user_rules: Optional[list] = None) -> list:
    date_i   = _find_col_idx(headers, "date")
    narr_i   = _find_col_idx(headers, "narration")
    debit_i  = _find_col_idx(headers, "debit")
    credit_i = _find_col_idx(headers, "credit")
    bal_i    = _find_col_idx(headers, "balance")
    type_i   = _find_col_idx(headers, "txtype")
    amt_i    = _find_col_idx(headers, "amount")

    if date_i is None or narr_i is None:
        logger.warning("Could not identify date/narration columns. Headers: %s", headers)
        return []

    col_idxs  = [c for c in [date_i, narr_i, debit_i, credit_i, bal_i, type_i, amt_i] if c is not None]
    min_width = max(col_idxs) + 1 if col_idxs else 1
    transactions = []

    for row in rows:
        if len(row) < min_width:
            continue

        def _g(idx):
            return str(row[idx]).strip() if idx is not None and idx < len(row) else None

        tx = _build_tx(
            date_str    = _g(date_i),
            narration   = _g(narr_i),
            debit_str   = _g(debit_i),
            credit_str  = _g(credit_i),
            balance_str = _g(bal_i),
            txtype_str  = _g(type_i),
            amount_str  = _g(amt_i),
            user_rules  = user_rules,
        )
        if tx:
            transactions.append(tx)

    return transactions


# ---------------------------------------------------------------------------
# CSV Parser
# ---------------------------------------------------------------------------
def parse_csv(content: bytes, user_rules: Optional[list] = None) -> list:
    import csv

    for encoding in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            text = content.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    else:
        text = content.decode("utf-8", errors="replace")

    reader   = csv.reader(io.StringIO(text))
    all_rows = list(reader)

    header_idx = 0
    for i, row in enumerate(all_rows):
        if not row:
            continue
        has_date = any(_match_header(c) == "date"      for c in row)
        has_narr = any(_match_header(c) == "narration" for c in row)
        if has_date and has_narr:
            header_idx = i
            break

    headers   = all_rows[header_idx]
    data_rows = [r for r in all_rows[header_idx + 1:] if any(c.strip() for c in r)]
    return _parse_rows(headers, data_rows, user_rules)


# ---------------------------------------------------------------------------
# Excel Parser
# ---------------------------------------------------------------------------
def parse_excel(content: bytes, user_rules: Optional[list] = None) -> list:
    import openpyxl

    wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
    ws = wb.active

    all_rows = []
    for row in ws.iter_rows(values_only=True):
        all_rows.append([str(c).strip() if c is not None else "" for c in row])

    header_idx = 0
    for i, row in enumerate(all_rows):
        has_date = any(_match_header(c) == "date"      for c in row if c)
        has_narr = any(_match_header(c) == "narration" for c in row if c)
        if has_date and has_narr:
            header_idx = i
            break

    headers   = all_rows[header_idx]
    data_rows = [r for r in all_rows[header_idx + 1:] if any(c for c in r)]
    return _parse_rows(headers, data_rows, user_rules)


# ---------------------------------------------------------------------------
# PDF helpers -- coordinate-based
# ---------------------------------------------------------------------------
def _cluster_words_into_rows(words, y_tolerance: float = 4.0) -> dict:
    """
    Cluster words into visual rows by y-coordinate proximity.
    Returns {representative_y: [(x0, y0, x1, y1, text), ...]}
    """
    rows     = {}
    row_keys = []

    for item in words:
        x0, y0, x1, y1, text = item[:5]
        if not str(text).strip():
            continue
        placed = False
        for ry in row_keys:
            if abs(ry - y0) <= y_tolerance:
                rows[ry].append((x0, y0, x1, y1, str(text)))
                placed = True
                break
        if not placed:
            rows[y0] = [(x0, y0, x1, y1, str(text))]
            row_keys.append(y0)

    return rows


def _detect_column_bounds(rows: dict) -> tuple:
    """
    Scan rows top-to-bottom for a header row containing at least a date
    and a narration column. Returns (header_y, col_bounds) or (None, None).
    col_bounds: {col_name: (x_start, x_end)}
    """
    for row_y in sorted(rows.keys()):
        col_hits: dict = {}

        for x0, y0, x1, y1, text in rows[row_y]:
            col = _match_header(text)
            if col and col not in ("txtype",):
                col_hits.setdefault(col, []).append(x0)

        if "date" not in col_hits or "narration" not in col_hits:
            continue

        col_starts  = {col: min(xs) for col, xs in col_hits.items()}
        sorted_cols = sorted(col_starts.items(), key=lambda kv: kv[1])

        col_bounds = {}
        for i, (col_name, x_start) in enumerate(sorted_cols):
            x_end = sorted_cols[i + 1][1] - 1 if i + 1 < len(sorted_cols) else 99999
            col_bounds[col_name] = (x_start - 5, x_end)

        if sorted_cols:
            first = sorted_cols[0][0]
            col_bounds[first] = (0, col_bounds[first][1])

        return row_y, col_bounds

    return None, None


def _assign_words_to_cols(row_words: list, col_bounds: dict) -> dict:
    """Map each word in a row to its column using x_center position."""
    buckets = {col: [] for col in col_bounds}

    for x0, y0, x1, y1, text in sorted(row_words, key=lambda w: w[0]):
        x_center = (x0 + x1) / 2.0
        best_col, best_width = None, float("inf")
        for col_name, (cx_min, cx_max) in col_bounds.items():
            if cx_min <= x_center <= cx_max:
                w = cx_max - cx_min
                if w < best_width:
                    best_width = w
                    best_col   = col_name
        if best_col:
            buckets[best_col].append(text)

    return {col: " ".join(words) for col, words in buckets.items()}


def _is_repeated_header(text: str) -> bool:
    """Return True if a row looks like a repeated header (page-break artefact)."""
    tl = text.lower()
    return "date" in tl and any(
        kw in tl for kw in ("narrat", "descript", "particul", "remark", "deposit", "withdraw")
    )


def _process_coordinate_rows(rows: dict, header_y: float, col_bounds: dict, user_rules) -> list:
    """
    Standard coordinate-row processor for banks where each transaction
    fits on a single visual row.  Used as the generic fallback.
    """
    current_tx   = None
    transactions = []

    for row_y in sorted(rows.keys()):
        if row_y <= header_y:
            continue

        row_data   = _assign_words_to_cols(rows[row_y], col_bounds)
        date_str   = row_data.get("date",      "").strip()
        narr_str   = row_data.get("narration", "").strip()
        debit_str  = row_data.get("debit",     "").strip()
        credit_str = row_data.get("credit",    "").strip()
        bal_str    = row_data.get("balance",   "").strip()
        type_str   = row_data.get("txtype",    "").strip()

        if not any([date_str, narr_str, debit_str, credit_str, bal_str]):
            continue

        if _is_repeated_header(" ".join(row_data.values())):
            continue

        parsed_date = parse_date(date_str) if date_str else None

        if parsed_date:
            if current_tx:
                tx = _build_tx(**current_tx, user_rules=user_rules)
                if tx:
                    transactions.append(tx)
            current_tx = {
                "date_str":    parsed_date,
                "narration":   narr_str,
                "debit_str":   debit_str  or None,
                "credit_str":  credit_str or None,
                "balance_str": bal_str    or None,
                "txtype_str":  type_str   or None,
            }

        elif narr_str and current_tx is not None:
            if narr_str not in current_tx["narration"]:
                current_tx["narration"] = (current_tx["narration"] + " " + narr_str).strip()
            if debit_str  and not current_tx["debit_str"]:
                current_tx["debit_str"]   = debit_str
            if credit_str and not current_tx["credit_str"]:
                current_tx["credit_str"]  = credit_str
            if bal_str    and not current_tx["balance_str"]:
                current_tx["balance_str"] = bal_str

    if current_tx:
        tx = _build_tx(**current_tx, user_rules=user_rules)
        if tx:
            transactions.append(tx)

    return transactions


# ---------------------------------------------------------------------------
# Canara-style PDF parser  (anchor-row layout)
# ---------------------------------------------------------------------------
# Reference / timestamp patterns that belong in description, not narration.
_CHQ_RE      = re.compile(r"Chq\s*:\s*(\S+)", re.IGNORECASE)
_UTR_RE      = re.compile(r"UTR\s*:?\s*(\S+)", re.IGNORECASE)
# Match lines that are ONLY a reference number or timestamp
_PURE_REF_RE = re.compile(
    r"^\d{9,20}$"                                 # pure reference number
    r"|^\d{2}/\d{2}/\d{4}\s+\d{2}:\d{2}:\d{2}$"  # timestamp 24/09/2026 22:00:53
    r"|^\d{2}:\d{2}:\d{2}$",                      # time HH:MM:SS
    re.IGNORECASE,
)
# Match lines that are ONLY a hash-like hex string used in UPI references
_HASH_RE = re.compile(r"^[0-9A-F]{6,40}[/\\][0-9A-F]{6,40}$|^[0-9A-F]{10,40}$", re.IGNORECASE)


def _is_amount_str(s: str) -> bool:
    """Return True if s looks like a bank amount (e.g. 40.00, 1,23,456.78)."""
    return bool(re.match(r"^\d[\d,]*\.\d{2}$", s.strip()))


def _find_chq_y(sorted_ys: list, rows: dict, anchor_y: float, narr_x_min: float, narr_x_max: float) -> float:
    """
    Find the y of the Chq:/UTR: line that belongs to the transaction at anchor_y.
    Searches in narration column from anchor_y to anchor_y + 55.
    Returns anchor_y + 50 as fallback if no Chq line found.
    """
    chq_pattern = re.compile(r"Chq\s*:|UTR\s*:?", re.IGNORECASE)
    for ry in sorted_ys:
        if ry <= anchor_y:
            continue
        if ry > anchor_y + 55:
            break
        for x0, y0, x1, y1, text in rows[ry]:
            xc = (x0 + x1) / 2.0
            if narr_x_min <= xc <= narr_x_max and chq_pattern.match(text.strip()):
                # Return the y of the Chq label row itself
                return ry
    # No Chq line found (some transactions may not have one)
    # Return anchor_y + 12 as a minimal boundary (just past the anchor row)
    return anchor_y + 12


def _extract_narration_and_ref(narr_lines: list) -> tuple:
    """
    Split raw narration lines into (clean_narration, reference).
    Lines matching Chq:, UTR:, pure timestamps, or pure ref numbers
    are moved to the reference field.
    """
    ref_parts  = []
    narr_parts = []

    for line in narr_lines:
        line = line.strip()
        if not line:
            continue
        m_chq = _CHQ_RE.search(line)
        m_utr = _UTR_RE.search(line)
        if m_chq:
            ref_parts.append(m_chq.group(1))
        elif m_utr:
            ref_parts.append(m_utr.group(1))
        elif _PURE_REF_RE.match(line):
            ref_parts.append(line)
        else:
            narr_parts.append(line)

    narration = " ".join(narr_parts).strip()
    reference = " | ".join(ref_parts) if ref_parts else ""
    return narration, reference


def _parse_pdf_canara_style(all_words: list, col_bounds: dict, header_y: float, user_rules) -> list:
    """
    Parse bank PDFs where date + amounts share one y-coordinate (anchor row)
    and narration text spans multiple y-rows ABOVE the anchor row.
    The Chq: line appears ~42 points BELOW the anchor in the narration column.
    prev_y advances to chq_y (not anchor_y) to avoid bleeding narration lines
    from one transaction into the next.
    """
    date_x_min, date_x_max = col_bounds.get("date",      (0,    100))
    narr_x_min, narr_x_max = col_bounds.get("narration", (100,  315))
    dep_x_min,  dep_x_max  = col_bounds.get("credit",    (310,  415))
    wd_x_min,   wd_x_max   = col_bounds.get("debit",     (410,  520))
    bal_x_min,  bal_x_max  = col_bounds.get("balance",   (515,  700))

    rows      = _cluster_words_into_rows(all_words, y_tolerance=5.0)
    sorted_ys = sorted(rows.keys())

    # Step 1: identify anchor rows (date + at least one amount on same y)
    anchor_rows = []
    for ry in sorted_ys:
        if ry <= header_y:
            continue
        date_words   = []
        amount_words = []
        for x0, y0, x1, y1, text in rows[ry]:
            xc = (x0 + x1) / 2.0
            if date_x_min <= xc <= date_x_max:
                date_words.append(text)
            if (dep_x_min <= xc <= dep_x_max or
                    wd_x_min <= xc <= wd_x_max or
                    bal_x_min <= xc <= bal_x_max):
                amount_words.append(text)

        has_date = any(parse_date(w) is not None for w in date_words)
        has_amt  = any(_is_amount_str(w) for w in amount_words)
        if has_date and has_amt:
            anchor_rows.append(ry)

    if not anchor_rows:
        return []

    # Step 2: for each anchor, collect narration from prev_end_y to chq_y
    transactions = []
    prev_end_y   = header_y  # advances to chq_y after each transaction

    for anchor_y in anchor_rows:
        # Find the Chq: line y for this transaction
        chq_y = _find_chq_y(sorted_ys, rows, anchor_y, narr_x_min, narr_x_max)

        # Extract date, deposit, withdrawal, balance from anchor row
        date_words_found = []
        dep_words_found  = []
        wd_words_found   = []
        bal_words_found  = []

        for x0, y0, x1, y1, text in rows[anchor_y]:
            xc = (x0 + x1) / 2.0
            if   date_x_min <= xc <= date_x_max:  date_words_found.append(text)
            elif dep_x_min  <= xc <= dep_x_max:   dep_words_found.append(text)
            elif wd_x_min   <= xc <= wd_x_max:    wd_words_found.append(text)
            elif bal_x_min  <= xc <= bal_x_max:   bal_words_found.append(text)

        # Collect narration lines from (prev_end_y, chq_y] inclusive
        narr_lines = []
        for ry in sorted_ys:
            if ry <= prev_end_y:
                continue
            if ry > chq_y + 5:   # small slack past chq line
                break
            # Skip repeated page headers
            row_text = " ".join(text for x0,y0,x1,y1,text in rows[ry])
            if _is_repeated_header(row_text):
                continue
            narr_in_row = [
                text for x0, y0, x1, y1, text in sorted(rows[ry], key=lambda w: w[0])
                if narr_x_min <= (x0 + x1) / 2.0 <= narr_x_max
            ]
            if narr_in_row:
                narr_lines.append(" ".join(narr_in_row))

        narration, reference = _extract_narration_and_ref(narr_lines)

        date_str    = " ".join(date_words_found).strip()
        credit_str  = " ".join(dep_words_found).strip()  or None
        debit_str   = " ".join(wd_words_found).strip()   or None
        balance_str = " ".join(bal_words_found).strip()  or None

        # Skip opening/closing balance rows (has amounts, no real narration)
        if not narration:
            prev_end_y = chq_y
            continue

        tx = _build_tx(
            date_str    = date_str,
            narration   = narration,
            credit_str  = credit_str,
            debit_str   = debit_str,
            balance_str = balance_str,
            reference   = reference,
            user_rules  = user_rules,
        )
        if tx:
            transactions.append(tx)

        prev_end_y = chq_y   # KEY: advance past the Chq: line, not just anchor_y

    return transactions


def _is_canara_style(col_bounds: dict, rows: dict, header_y: float) -> bool:
    """
    Heuristic: does this PDF use the Canara-style anchor-row layout?
    Returns True if there are significantly more narration rows than date rows.
    """
    if not col_bounds:
        return False

    date_x_min, date_x_max = col_bounds.get("date",      (0,   100))
    narr_x_min, narr_x_max = col_bounds.get("narration", (100, 315))

    date_ys = set()
    narr_ys = set()

    for ry in sorted(rows.keys()):
        if ry <= header_y:
            continue
        for x0, y0, x1, y1, text in rows[ry]:
            xc = (x0 + x1) / 2.0
            if date_x_min <= xc <= date_x_max and parse_date(text):
                date_ys.add(ry)
            if narr_x_min <= xc <= narr_x_max and len(text) > 3:
                narr_ys.add(ry)

    if not date_ys:
        return False

    ratio = len(narr_ys) / max(len(date_ys), 1)
    return ratio >= 3.0


# ---------------------------------------------------------------------------
# PDF Parser -- primary path: PyMuPDF
# ---------------------------------------------------------------------------
def _parse_pdf_pymupdf(content: bytes, user_rules: Optional[list] = None) -> list:
    """
    Coordinate-based PDF parser using PyMuPDF.
    Handles multiline narrations, Canara-style anchor-row layout,
    page-break repeated headers, opening/closing balance rows.
    Raises ValueError for scanned/image-only PDFs.
    """
    import fitz  # PyMuPDF

    doc = fitz.open(stream=content, filetype="pdf")

    total_chars = sum(len(page.get_text()) for page in doc)
    if total_chars < 30:
        doc.close()
        raise ValueError(
            "This PDF appears to be a scanned image with no selectable text. "
            "Please export your bank statement as CSV or Excel instead."
        )

    all_words = []
    y_offset  = 0.0

    for page in doc:
        raw_words = page.get_text("words")
        page_h    = page.rect.height
        for w in raw_words:
            all_words.append((w[0], w[1] + y_offset, w[2], w[3] + y_offset, w[4]))
        y_offset += page_h + 20

    doc.close()

    if not all_words:
        return []

    rows_all = _cluster_words_into_rows(all_words, y_tolerance=5.0)
    header_y, col_bounds = _detect_column_bounds(rows_all)

    if col_bounds is None:
        return []

    if _is_canara_style(col_bounds, rows_all, header_y):
        logger.info("Detected Canara-style anchor-row layout -- using anchor parser")
        return _parse_pdf_canara_style(all_words, col_bounds, header_y, user_rules)
    else:
        logger.info("Using standard coordinate-row parser")
        return _process_coordinate_rows(rows_all, header_y, col_bounds, user_rules)


# ---------------------------------------------------------------------------
# PDF Parser -- fallback path: pdfplumber word-based
# ---------------------------------------------------------------------------
def _parse_pdf_pdfplumber(content: bytes, user_rules: Optional[list] = None) -> list:
    """
    Fallback PDF parser using pdfplumber.extract_words().
    Does NOT use extract_tables() -- that breaks on multiline narrations.
    """
    import pdfplumber

    all_words = []
    y_offset  = 0.0

    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            words  = page.extract_words(x_tolerance=2, y_tolerance=3,
                                        keep_blank_chars=False, use_text_flow=False)
            page_h = float(page.height)
            for w in words:
                all_words.append((
                    float(w["x0"]),   float(w["top"])    + y_offset,
                    float(w["x1"]),   float(w["bottom"]) + y_offset,
                    w["text"],
                ))
            y_offset += page_h + 20

    if not all_words:
        return []

    rows = _cluster_words_into_rows(all_words, y_tolerance=5.0)
    header_y, col_bounds = _detect_column_bounds(rows)

    if col_bounds is None or header_y is None:
        return []

    if _is_canara_style(col_bounds, rows, header_y):
        logger.info("pdfplumber: Canara-style layout detected")
        return _parse_pdf_canara_style(all_words, col_bounds, header_y, user_rules)

    return _process_coordinate_rows(rows, header_y, col_bounds, user_rules)


# ---------------------------------------------------------------------------
# Public PDF entry point
# ---------------------------------------------------------------------------
def parse_pdf(content: bytes, user_rules: Optional[list] = None) -> list:
    """
    Parse a bank statement PDF.
    Tries PyMuPDF first; falls back to pdfplumber if PyMuPDF yields nothing.
    Raises ValueError for scanned/image-only PDFs.
    """
    try:
        import fitz  # noqa: F401
        txns = _parse_pdf_pymupdf(content, user_rules)
        if txns:
            return txns
        logger.info("PyMuPDF returned 0 transactions, trying pdfplumber")
        return _parse_pdf_pdfplumber(content, user_rules)
    except ImportError:
        logger.warning("PyMuPDF not available, using pdfplumber")
        return _parse_pdf_pdfplumber(content, user_rules)
    except ValueError:
        raise
    except Exception as exc:
        logger.warning("PyMuPDF failed (%s), trying pdfplumber", exc)
        return _parse_pdf_pdfplumber(content, user_rules)


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------
def parse_statement(
    filename:   str,
    content:    bytes,
    user_rules: Optional[list] = None,
) -> list:
    """
    Parse a bank statement file (PDF / CSV / XLSX / XLS).

    Args:
        filename:   original filename (used for extension detection)
        content:    raw file bytes
        user_rules: optional list of {keyword, category} dicts from DB

    Returns:
        List of transaction dicts, each with:
          title, amount, type, category, description, date,
          balance, categorization_source, needs_review,
          transaction_reference
    """
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext == "pdf":
        txns = parse_pdf(content, user_rules)
    elif ext in ("xlsx", "xls"):
        txns = parse_excel(content, user_rules)
    elif ext == "csv":
        txns = parse_csv(content, user_rules)
    else:
        raise ValueError(
            f"Unsupported file type '.{ext}'. Please upload a CSV, PDF, or Excel file."
        )

    seen   = set()
    unique = []
    for tx in txns:
        key = (tx["date"], tx["title"], tx["amount"], tx["type"])
        if key not in seen:
            seen.add(key)
            unique.append(tx)

    logger.info(
        "Parsed %d transactions from '%s' (%d after dedup)",
        len(txns), filename, len(unique),
    )
    return unique
