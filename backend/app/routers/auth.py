"""
Authentication router: register, verify-email, login, verify-login-otp, resend-otp, logout, me.
"""
from fastapi import APIRouter, HTTPException, Response, Request, Depends, status
from fastapi.responses import JSONResponse
from datetime import timedelta
import logging

from app.schemas.auth import (
    RegisterRequest,
    VerifyEmailRequest,
    LoginRequest,
    VerifyLoginOTPRequest,
    ResendOTPRequest,
    UserOut,
)
from app.core.hashing import hash_password, verify_password
from app.core.security import create_access_token
from app.core.config import settings
from app.core.dependencies import get_current_user
from app.database.connection import get_db_connection
from app.services.otp_service import create_and_store_otp, verify_otp, check_resend_cooldown
from app.services.email_service import send_otp_email

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)


def _mask_email(email: str) -> str:
    local, domain = email.split("@")
    masked = local[:2] + "*" * (len(local) - 2)
    return f"{masked}@{domain}"


def _set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=settings.ENVIRONMENT == "production",
        samesite="strict",
        max_age=settings.JWT_EXPIRE_MINUTES * 60,
        path="/",
    )


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Check email uniqueness
            cursor.execute("SELECT id FROM users WHERE email = %s", (body.email,))
            if cursor.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="An account with this email already exists.",
                )

            pw_hash = hash_password(body.password)
            cursor.execute(
                "INSERT INTO users (name, email, password_hash, is_verified) VALUES (%s, %s, %s, FALSE)",
                (body.name.strip(), body.email.lower(), pw_hash),
            )
            user_id = cursor.lastrowid
        conn.commit()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Register error: {e}")
        raise HTTPException(status_code=500, detail="Registration failed. Please try again.")
    finally:
        conn.close()

    # Send OTP
    try:
        otp, _ = create_and_store_otp(user_id, "email_verification")
        send_otp_email(body.email, body.name.strip(), otp, "email_verification")
    except Exception as e:
        logger.error(f"Failed to send OTP after registration: {e}")
        raise HTTPException(status_code=500, detail="Account created but failed to send verification email. Please use resend OTP.")

    return {
        "message": "Account created. Please check your email for a verification code.",
        "masked_email": _mask_email(body.email),
    }


@router.post("/verify-email")
async def verify_email(body: VerifyEmailRequest):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT id, name, is_verified FROM users WHERE email = %s AND is_active = TRUE",
                (body.email.lower(),),
            )
            user = cursor.fetchone()
    finally:
        conn.close()

    if not user:
        raise HTTPException(status_code=404, detail="Account not found.")

    if user["is_verified"]:
        raise HTTPException(status_code=400, detail="Email already verified.")

    success, error = verify_otp(user["id"], "email_verification", body.otp)
    if not success:
        raise HTTPException(status_code=400, detail=error)

    # Activate account
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "UPDATE users SET is_verified = TRUE WHERE id = %s",
                (user["id"],),
            )
        conn.commit()
    finally:
        conn.close()

    return {"message": "Email verified successfully. You can now sign in."}


@router.post("/login")
async def login(body: LoginRequest):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT id, name, email, password_hash, is_verified, is_active FROM users WHERE email = %s",
                (body.email.lower(),),
            )
            user = cursor.fetchone()
    finally:
        conn.close()

    # Generic error to prevent user enumeration
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if not user["is_active"]:
        raise HTTPException(status_code=403, detail="Account is deactivated.")

    if not user["is_verified"]:
        raise HTTPException(
            status_code=403,
            detail="Email not verified. Please verify your email first.",
            headers={"X-Needs-Verification": "true"},
        )

    # Send login OTP
    try:
        otp, _ = create_and_store_otp(user["id"], "login")
        send_otp_email(user["email"], user["name"], otp, "login")
    except Exception as e:
        logger.error(f"Failed to send login OTP: {e}")
        raise HTTPException(status_code=500, detail="Failed to send login code. Please try again.")

    return {
        "message": "Login code sent to your email.",
        "masked_email": _mask_email(user["email"]),
    }


@router.post("/verify-login-otp")
async def verify_login_otp(body: VerifyLoginOTPRequest, response: Response):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT id, name, email FROM users WHERE email = %s AND is_active = TRUE AND is_verified = TRUE",
                (body.email.lower(),),
            )
            user = cursor.fetchone()
    finally:
        conn.close()

    if not user:
        raise HTTPException(status_code=404, detail="Account not found or not verified.")

    success, error = verify_otp(user["id"], "login", body.otp)
    if not success:
        raise HTTPException(status_code=400, detail=error)

    token = create_access_token({"sub": str(user["id"])})
    _set_auth_cookie(response, token)

    return {
        "message": "Login successful.",
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
        },
    }


@router.post("/resend-otp")
async def resend_otp(body: ResendOTPRequest):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT id, name FROM users WHERE email = %s AND is_active = TRUE",
                (body.email.lower(),),
            )
            user = cursor.fetchone()
    finally:
        conn.close()

    if not user:
        # Don't reveal if email exists
        return {"message": "If that email is registered, a new code has been sent."}

    can_resend, seconds_remaining = check_resend_cooldown(user["id"], body.otp_type)
    if not can_resend:
        raise HTTPException(
            status_code=429,
            detail=f"Please wait {seconds_remaining} seconds before requesting a new code.",
        )

    try:
        otp, _ = create_and_store_otp(user["id"], body.otp_type)
        send_otp_email(body.email, user["name"], otp, body.otp_type)
    except Exception as e:
        logger.error(f"Resend OTP failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to send code. Please try again.")

    return {
        "message": "A new verification code has been sent to your email.",
        "masked_email": _mask_email(body.email),
    }


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"message": "Logged out successfully."}


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "name": current_user["name"],
        "email": current_user["email"],
        "is_verified": current_user["is_verified"],
        "created_at": str(current_user["created_at"]),
    }
