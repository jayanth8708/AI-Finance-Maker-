from pydantic_settings import BaseSettings
from pathlib import Path

# Resolve .env: prefer backend/.env, fall back to project-root .env
_here = Path(__file__).resolve().parent  # app/core/
_backend_env = _here.parent.parent / ".env"       # backend/.env
_root_env = _here.parent.parent.parent / ".env"   # project-root .env
_env_file = str(_backend_env) if _backend_env.exists() else str(_root_env)


class Settings(BaseSettings):
    # Database
    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_NAME: str = "ai_finance_maker"
    DB_USER: str = "root"
    DB_PASSWORD: str = ""

    # JWT
    JWT_SECRET_KEY: str = "change-this-secret"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440  # 24 hours

    # App
    FRONTEND_URL: str = "http://localhost:5173"
    ENVIRONMENT: str = "development"

    class Config:
        env_file = _env_file
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
