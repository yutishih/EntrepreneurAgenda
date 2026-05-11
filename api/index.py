import os
import bcrypt
import jwt
import psycopg2
import psycopg2.errors
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
JWT_SECRET = os.getenv("JWT_SECRET", "please-change-this-secret")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 24

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@contextmanager
def get_db():
    conn = psycopg2.connect(DATABASE_URL)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(50) UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    name_en VARCHAR(100),
                    name_zh VARCHAR(100),
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)
            cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS name_en VARCHAR(100)")
            cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS name_zh VARCHAR(100)")


init_db()

security = HTTPBearer()


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str
    name_en: str
    name_zh: str


def make_token(username: str) -> str:
    payload = {
        "sub": username,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> str:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload["sub"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token 已過期，請重新登入")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="無效的 Token")


@app.post("/api/auth/login")
def login(req: LoginRequest):
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT password_hash FROM users WHERE username = %s", (req.username,))
            row = cur.fetchone()
    if not row or not bcrypt.checkpw(req.password.encode(), row[0].encode()):
        raise HTTPException(status_code=401, detail="帳號或密碼錯誤")
    return {"token": make_token(req.username), "username": req.username}


@app.post("/api/auth/register")
def register(req: RegisterRequest):
    if len(req.username) < 3:
        raise HTTPException(status_code=400, detail="帳號至少需要 3 個字元")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="密碼至少需要 6 個字元")
    if not req.name_en.strip():
        raise HTTPException(status_code=400, detail="請輸入英文姓名")
    if not req.name_zh.strip():
        raise HTTPException(status_code=400, detail="請輸入中文姓名")
    password_hash = bcrypt.hashpw(req.password.encode(), bcrypt.gensalt()).decode()
    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO users (username, password_hash, name_en, name_zh) VALUES (%s, %s, %s, %s)",
                    (req.username, password_hash, req.name_en.strip(), req.name_zh.strip()),
                )
    except psycopg2.errors.UniqueViolation:
        raise HTTPException(status_code=400, detail="帳號已存在")
    return {"token": make_token(req.username), "username": req.username}


@app.get("/api/auth/verify")
def verify(credentials: HTTPAuthorizationCredentials = Depends(security)):
    username = decode_token(credentials.credentials)
    return {"username": username}
