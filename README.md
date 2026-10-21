# AI Finance Maker

A professional, AI-powered personal finance application with real email OTP authentication.

## Tech Stack

- **Frontend:** React 18, Vite, Tailwind CSS, React Router v6, Recharts, Lucide React
- **Backend:** Python 3.11+, FastAPI, Pydantic v2
- **Database:** MySQL 8+
- **Auth:** Argon2id hashing, JWT in HttpOnly cookies, real email OTP
- **Email:** Resend API (or SMTP fallback)

---

## Project Structure

```
Ai Finance maker/
├── frontend/          # React + Vite app
├── backend/           # FastAPI app
├── .env.example       # Environment variable template
└── README.md
```

---

## Prerequisites

- **Node.js** 18+
- **Python** 3.11+
- **MySQL** 8.0+
- **Resend account** (https://resend.com) or SMTP credentials

---

## Setup Instructions

### 1. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```powershell
Copy-Item .env.example .env
```

Edit `.env`:

```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=ai_finance_maker
DB_USER=root
DB_PASSWORD=your_mysql_password

# JWT
JWT_SECRET_KEY=your-very-long-random-secret-key
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=1440

# Email (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxx
FROM_EMAIL=noreply@yourdomain.com

# App
FRONTEND_URL=http://localhost:5173
ENVIRONMENT=development
```

### 2. MySQL Setup

```sql
CREATE DATABASE ai_finance_maker CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3. Backend Setup

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m app.database.init_db
uvicorn app.main:app --reload --port 8000
```

### 4. Frontend Setup

```powershell
cd frontend
npm install
npm run dev
```

App: http://localhost:5173 | API: http://localhost:8000 | Docs: http://localhost:8000/docs

---

## Authentication Flow

### Registration
1. POST `/auth/register` - hash password, create unverified user, send OTP email
2. POST `/auth/verify-email` - verify OTP, activate account

### Login
1. POST `/auth/login` - validate credentials, send login OTP
2. POST `/auth/verify-login-otp` - verify OTP, issue JWT cookie

---

## Security Features

- Argon2id password hashing
- JWT in HttpOnly, Secure, SameSite=Strict cookies
- Cryptographically random 6-digit OTPs
- 5-minute OTP expiry, single-use, max 5 attempts
- 60-second resend cooldown
- Rate limiting on auth endpoints
- CORS restricted to frontend origin
- No secrets in localStorage or code
