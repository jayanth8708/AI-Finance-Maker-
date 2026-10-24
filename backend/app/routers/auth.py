"""
Authentication router: register, login, logout, me.
OTP-based authentication has been removed. Accounts are verified automatically on registration.
"""
from fastapi import APIRouter, HTTPException, Response, Request, Depends, status
from fastapi.responses import JSONResponse
import logging

from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    UserOut,
)
from app.core.hashing import hash_password, verify_password
from app.core.security import create_access_token
from app.core.config import settings
from app.core.dependencies import get_current_user
from app.database.connection import get_db_connection

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)


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
async def register(body: RegisterRequest, response: Response):
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
            # is_verified=TRUE: accounts are verified automatically (no OTP required)
            cursor.execute(
                "INSERT INTO users (name, email, password_hash, is_verified) VALUES (%s, %s, %s, TRUE)",
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

    # Issue JWT and set cookie so user is logged in immediately after registration
    token = create_access_token({"sub": str(user_id)})
    _set_auth_cookie(response, token)

    return {
        "message": "Account created successfully. Welcome!",
        "user": {
            "id": user_id,
            "name": body.name.strip(),
            "email": body.email.lower(),
        },
    }


@router.post("/login")
async def login(body: LoginRequest, response: Response):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT id, name, email, password_hash, is_active FROM users WHERE email = %s",
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
