import json
import os
import re
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
from typing import Any, Dict

load_dotenv()

# psycopg2 不支援 channel_binding 參數，移除後再連線
_raw_url = os.getenv("DATABASE_URL", "")
DATABASE_URL = re.sub(r"[&?]channel_binding=[^&]*", "", _raw_url)
JWT_SECRET = os.getenv("JWT_SECRET", "please-change-this-secret")
INVITE_CODE = os.getenv("INVITE_CODE", "")
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
            cur.execute("""
                CREATE TABLE IF NOT EXISTS agendas (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(50) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
                    data JSONB NOT NULL,
                    meeting_date DATE,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)
            cur.execute("ALTER TABLE agendas ADD COLUMN IF NOT EXISTS meeting_date DATE")


init_db()

security = HTTPBearer()


# ------------------------------------------------------------------ models
class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str
    name_en: str
    name_zh: str
    invite_code: str


class AgendaSaveRequest(BaseModel):
    data: Dict[str, Any]


# ------------------------------------------------------------------ helpers
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


def parse_jsonb(val) -> dict:
    if isinstance(val, str):
        return json.loads(val)
    return val or {}


# ------------------------------------------------------------------ auth
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
    if not INVITE_CODE or req.invite_code != INVITE_CODE:
        raise HTTPException(status_code=403, detail="邀請碼錯誤")
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


# ------------------------------------------------------------------ agenda
@app.get("/api/agendas")
def list_agendas(
    date:  str = None,
    page:  int = 1,
    limit: int = 10,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    import math
    username = decode_token(credentials.credentials)
    offset = (page - 1) * limit
    with get_db() as conn:
        with conn.cursor() as cur:
            where  = "WHERE username = %s"
            params: list = [username]
            if date:
                where += " AND meeting_date = %s"
                params.append(date)
            cur.execute(f"SELECT COUNT(*) FROM agendas {where}", params)
            total = cur.fetchone()[0]
            cur.execute(
                f"SELECT id, data, updated_at FROM agendas {where}"
                f" ORDER BY updated_at DESC LIMIT %s OFFSET %s",
                params + [limit, offset],
            )
            rows = cur.fetchall()
    items = []
    for r in rows:
        d = parse_jsonb(r[1])
        items.append({
            "id":           r[0],
            "meetingDate":  d.get("meetingDate", ""),
            "meetingNo":    d.get("meetingNo", ""),
            "meetingTheme": d.get("meetingTheme", ""),
            "updatedAt":    r[2].isoformat() if r[2] else "",
        })
    return {
        "items": items,
        "total": total,
        "page":  page,
        "pages": math.ceil(total / limit) if total else 1,
    }


@app.post("/api/agendas")
def create_agenda(req: AgendaSaveRequest, credentials: HTTPAuthorizationCredentials = Depends(security)):
    username = decode_token(credentials.credentials)
    meeting_date = req.data.get("meetingDate") or None
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO agendas (username, data, meeting_date) VALUES (%s, %s::jsonb, %s) RETURNING id",
                (username, json.dumps(req.data), meeting_date),
            )
            new_id = cur.fetchone()[0]
    return {"id": new_id}


@app.put("/api/agendas/{agenda_id}")
def update_agenda(
    agenda_id: int,
    req: AgendaSaveRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    username = decode_token(credentials.credentials)
    meeting_date = req.data.get("meetingDate") or None
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE agendas SET data = %s::jsonb, meeting_date = %s, updated_at = NOW()"
                " WHERE id = %s AND username = %s",
                (json.dumps(req.data), meeting_date, agenda_id, username),
            )
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="找不到此議程或無權限")
    return {"ok": True}


@app.get("/api/agendas/{agenda_id}")
def get_agenda(agenda_id: int, credentials: HTTPAuthorizationCredentials = Depends(security)):
    username = decode_token(credentials.credentials)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT data FROM agendas WHERE id = %s AND username = %s",
                (agenda_id, username),
            )
            row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="找不到此議程或無權限")
    return parse_jsonb(row[0])


@app.delete("/api/agendas/{agenda_id}")
def delete_agenda(agenda_id: int, credentials: HTTPAuthorizationCredentials = Depends(security)):
    username = decode_token(credentials.credentials)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM agendas WHERE id = %s AND username = %s",
                (agenda_id, username),
            )
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="找不到此議程或無權限")
    return {"ok": True}
