"""
OTP service: generation, storage, verification, and resend logic.
"""
import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional
import pymysql

from app.core.config import settings
from app.database.connection import get_db_connection


def _generate_otp() -> str:
    """Generate cryptographically secure 6-digit OTP."""
    return f"{secrets.randbelow(1000000):06d}"


def _hash_otp(otp: str) -> str:
    """SHA-256 hash of the OTP for safe storage."""
    return hashlib.sha256(otp.encode()).hexdigest()


def create_and_store_otp(user_id: int, otp_type: str) -> tuple[str, datetime]:
    """
    Create a new OTP, invalidate any existing ones for this user+type,
    and store the hash. Returns (plain_otp, expires_at).
    """
    otp = _generate_otp()
    otp_hash = _hash_otp(otp)
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Invalidate old OTPs
            cursor.execute(
                "UPDATE otp_challenges SET is_used = TRUE "
                "WHERE user_id = %s AND otp_type = %s AND is_used = FALSE",
                (user_id, otp_type),
            )
            # Insert new OTP
            cursor.execute(
                """INSERT INTO otp_challenges
                   (user_id, otp_type, otp_hash, expires_at, last_sent_at)
                   VALUES (%s, %s, %s, %s, %s)""",
                (user_id, otp_type, otp_hash, expires_at.replace(tzinfo=None), now.replace(tzinfo=None)),
            )
        conn.commit()
    finally:
        conn.close()

    return otp, expires_at


def verify_otp(user_id: int, otp_type: str, otp: str) -> tuple[bool, str]:
    """
    Verify an OTP. Returns (success, error_message).
    On success, marks the OTP as used.
    """
    otp_hash = _hash_otp(otp)
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """SELECT id, otp_hash, expires_at, attempts, is_used
                   FROM otp_challenges
                   WHERE user_id = %s AND otp_type = %s AND is_used = FALSE
                   ORDER BY created_at DESC LIMIT 1""",
                (user_id, otp_type),
            )
            record = cursor.fetchone()

            if not record:
                return False, "No active OTP found. Please request a new one."

            if record["is_used"]:
                return False, "OTP already used. Please request a new one."

            if record["expires_at"] < now:
                return False, "OTP has expired. Please request a new one."

            if record["attempts"] >= settings.OTP_MAX_ATTEMPTS:
                return False, "Too many failed attempts. Please request a new OTP."

            if record["otp_hash"] != otp_hash:
                # Increment attempts
                cursor.execute(
                    "UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = %s",
                    (record["id"],),
                )
                conn.commit()
                remaining = settings.OTP_MAX_ATTEMPTS - record["attempts"] - 1
                return False, f"Invalid OTP. {max(0, remaining)} attempt(s) remaining."

            # Mark as used
            cursor.execute(
                "UPDATE otp_challenges SET is_used = TRUE WHERE id = %s",
                (record["id"],),
            )
            conn.commit()
            return True, ""
    finally:
        conn.close()


def check_resend_cooldown(user_id: int, otp_type: str) -> tuple[bool, int]:
    """
    Check if resend is allowed (cooldown passed).
    Returns (can_resend, seconds_remaining).
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """SELECT last_sent_at FROM otp_challenges
                   WHERE user_id = %s AND otp_type = %s AND is_used = FALSE
                   ORDER BY created_at DESC LIMIT 1""",
                (user_id, otp_type),
            )
            record = cursor.fetchone()
    finally:
        conn.close()

    if not record:
        return True, 0

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    last_sent = record["last_sent_at"]
    elapsed = (now - last_sent).total_seconds()
    cooldown = settings.OTP_RESEND_COOLDOWN_SECONDS

    if elapsed >= cooldown:
        return True, 0
    return False, int(cooldown - elapsed)
