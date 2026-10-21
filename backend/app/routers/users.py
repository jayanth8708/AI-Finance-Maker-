"""
Profile/settings router: update name, password.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
import re

from app.core.dependencies import get_current_user
from app.core.hashing import hash_password, verify_password
from app.database.connection import get_db_connection

router = APIRouter(prefix="/users", tags=["users"])


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    def validate_new_password(self):
        v = self.new_password
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Must contain uppercase")
        if not re.search(r"[a-z]", v):
            raise ValueError("Must contain lowercase")
        if not re.search(r"\d", v):
            raise ValueError("Must contain a digit")


@router.get("/profile")
async def get_profile(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "name": current_user["name"],
        "email": current_user["email"],
        "is_verified": current_user["is_verified"],
        "created_at": str(current_user["created_at"]),
    }


@router.patch("/profile")
async def update_profile(
    body: UpdateProfileRequest,
    current_user: dict = Depends(get_current_user),
):
    updates = {}
    if body.name:
        name = body.name.strip()
        if len(name) < 2:
            raise HTTPException(status_code=400, detail="Name too short.")
        updates["name"] = name

    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update.")

    fields = ", ".join(f"{k} = %s" for k in updates)
    values = list(updates.values()) + [current_user["id"]]

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(f"UPDATE users SET {fields} WHERE id = %s", values)
        conn.commit()
    finally:
        conn.close()

    return {"message": "Profile updated.", "name": updates.get("name", current_user["name"])}


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
):
    body.validate_new_password()

    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT password_hash FROM users WHERE id = %s", (current_user["id"],))
            user = cursor.fetchone()
    finally:
        conn.close()

    if not verify_password(body.current_password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    new_hash = hash_password(body.new_password)
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "UPDATE users SET password_hash = %s WHERE id = %s",
                (new_hash, current_user["id"]),
            )
        conn.commit()
    finally:
        conn.close()

    return {"message": "Password changed successfully."}
