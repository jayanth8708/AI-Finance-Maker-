"""
Database initialization script.
Run with: python -m app.database.init_db
"""
import sys
import os

# Ensure the backend root is in path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

import pymysql
from app.core.config import settings

SCHEMA_SQL = """
-- Users table
CREATE TABLE IF NOT EXISTS users (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100)     NOT NULL,
    email       VARCHAR(255)     NOT NULL UNIQUE,
    password_hash VARCHAR(255)   NOT NULL,
    is_verified BOOLEAN          NOT NULL DEFAULT FALSE,
    is_active   BOOLEAN          NOT NULL DEFAULT TRUE,
    created_at  DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- OTP challenges table
CREATE TABLE IF NOT EXISTS otp_challenges (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         INT UNSIGNED     NOT NULL,
    otp_type        ENUM('email_verification','login') NOT NULL,
    otp_hash        VARCHAR(255)     NOT NULL,
    expires_at      DATETIME         NOT NULL,
    attempts        TINYINT UNSIGNED NOT NULL DEFAULT 0,
    is_used         BOOLEAN          NOT NULL DEFAULT FALSE,
    last_sent_at    DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_type (user_id, otp_type),
    INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         INT UNSIGNED     NOT NULL,
    title           VARCHAR(200)     NOT NULL,
    amount          DECIMAL(12, 2)   NOT NULL,
    type            ENUM('income','expense') NOT NULL,
    category        VARCHAR(100)     NOT NULL,
    description     TEXT,
    date            DATE             NOT NULL,
    created_at      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_date (user_id, date),
    INDEX idx_user_type (user_id, type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Budgets table
CREATE TABLE IF NOT EXISTS budgets (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         INT UNSIGNED     NOT NULL,
    category        VARCHAR(100)     NOT NULL,
    monthly_limit   DECIMAL(12, 2)   NOT NULL,
    created_at      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uq_user_category (user_id, category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
"""


def init_db():
    # Connect without database first to create it if needed
    conn = pymysql.connect(
        host=settings.DB_HOST,
        port=settings.DB_PORT,
        user=settings.DB_USER,
        password=settings.DB_PASSWORD,
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
    )
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                f"CREATE DATABASE IF NOT EXISTS `{settings.DB_NAME}` "
                "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            )
            cursor.execute(f"USE `{settings.DB_NAME}`")

            # Execute each statement
            for statement in SCHEMA_SQL.split(";"):
                stmt = statement.strip()
                if stmt and not stmt.startswith("--"):
                    cursor.execute(stmt)

        conn.commit()
        print(f"[OK] Database '{settings.DB_NAME}' and tables initialized successfully.")
    except Exception as e:
        print(f"[ERROR] Database initialization failed: {e}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    init_db()
