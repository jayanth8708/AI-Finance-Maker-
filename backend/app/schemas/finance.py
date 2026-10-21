from pydantic import BaseModel, field_validator
from typing import Optional, Literal
from datetime import date
import re


class TransactionCreate(BaseModel):
    title: str
    amount: float
    type: Literal["income", "expense"]
    category: str
    description: Optional[str] = None
    date: date

    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Title is required")
        if len(v) > 200:
            raise ValueError("Title too long")
        return v

    @field_validator("amount")
    @classmethod
    def amount_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Amount must be positive")
        return round(v, 2)

    @field_validator("category")
    @classmethod
    def category_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Category is required")
        return v


class TransactionUpdate(BaseModel):
    title: Optional[str] = None
    amount: Optional[float] = None
    type: Optional[Literal["income", "expense"]] = None
    category: Optional[str] = None
    description: Optional[str] = None
    date: Optional[date] = None


class TransactionOut(BaseModel):
    id: int
    user_id: int
    title: str
    amount: float
    type: str
    category: str
    description: Optional[str]
    date: str
    created_at: str


class BudgetCreate(BaseModel):
    category: str
    monthly_limit: float

    @field_validator("monthly_limit")
    @classmethod
    def limit_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Budget limit must be positive")
        return round(v, 2)


class BudgetUpdate(BaseModel):
    monthly_limit: float

    @field_validator("monthly_limit")
    @classmethod
    def limit_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Budget limit must be positive")
        return round(v, 2)


class BudgetOut(BaseModel):
    id: int
    user_id: int
    category: str
    monthly_limit: float
    spent: float = 0.0
    created_at: str
