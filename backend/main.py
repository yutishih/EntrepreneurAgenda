import json
import os
import bcrypt
import jwt
import psycopg2
import psycopg2.pool
import psycopg2.errors
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Any, Dict, Optional

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

db_pool = psycopg2.pool.ThreadedConnectionPool(1, 10, DATABASE_URL)


@contextmanager
def get_db():
    conn = db_pool.getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        db_pool.putconn(conn)


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
            cur.execute("""
                CREATE TABLE IF NOT EXISTS members (
                    id SERIAL PRIMARY KEY,
                    name_zh VARCHAR(100) NOT NULL,
                    name_en VARCHAR(100) NOT NULL,
                    level   VARCHAR(100) NOT NULL DEFAULT 'TM',
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)
            seed = [
                ("蔡宜容", "Lia Tsai",      "IP5, PM2"),
                ("郭家瑀", "Jade Kuo",       "DL5"),
                ("盧柏昌", "Robert Lu",      "DTM"),
                ("林昌賢", "Lachlan Lin",    "VC4"),
                ("許耕銘", "Min Hsu",        "TM"),
                ("蘇彥儒", "Scott Su",       "DTM"),
                ("顏妙蓁", "Jennifer Yen",   "PM4"),
                ("葉姵君", "Jill Ye",        "TM"),
                ("陳凰櫻", "Gloria Chen",    "DTM"),
                ("簡瑜君", "Jacey Chien",    "VC4"),
                ("張建民", "Hayden Chang",   "DTM"),
                ("蘇宇辰", "Tina Su",        "TM"),
                ("高仲芸", "Phoebe Kao",     "PM5"),
                ("施友棣", "Yuti Shih",      "IP4"),
                ("陳婷怡", "Angel Chen",     "TM"),
                ("張馳",   "Joseph Teo",     "TM"),
                ("陳濬睿", "Ray Chen",       "TM"),
            ]
            for name_zh, name_en, level in seed:
                cur.execute(
                    "INSERT INTO members (name_zh, name_en, level)"
                    " SELECT %s, %s, %s WHERE NOT EXISTS"
                    " (SELECT 1 FROM members WHERE name_en = %s)",
                    (name_zh, name_en, level, name_en),
                )


@app.on_event("startup")
def startup():
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


class AgendaSaveRequest(BaseModel):
    data: Dict[str, Any]


class MemberRequest(BaseModel):
    name_zh: str
    name_en: str
    level: str


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
    date:  Optional[str] = Query(default=None),
    page:  int           = Query(default=1,  ge=1),
    limit: int           = Query(default=10, ge=1, le=100),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
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
    import math
    return {
        "items": items,
        "total": total,
        "page":  page,
        "pages": math.ceil(total / limit) if total else 1,
    }


@app.post("/api/agendas")
def create_agenda(
    req: AgendaSaveRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
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
def get_agenda(
    agenda_id: int,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
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
def delete_agenda(
    agenda_id: int,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
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


# ------------------------------------------------------------------ members
@app.get("/api/members")
def list_members(credentials: HTTPAuthorizationCredentials = Depends(security)):
    decode_token(credentials.credentials)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, name_zh, name_en, level FROM members ORDER BY id")
            rows = cur.fetchall()
    return [{"id": r[0], "nameZh": r[1], "nameEn": r[2], "level": r[3]} for r in rows]


@app.post("/api/members")
def create_member(
    req: MemberRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    decode_token(credentials.credentials)
    if not req.name_zh.strip() or not req.name_en.strip():
        raise HTTPException(status_code=400, detail="姓名不得為空")
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO members (name_zh, name_en, level) VALUES (%s, %s, %s) RETURNING id",
                (req.name_zh.strip(), req.name_en.strip(), req.level.strip()),
            )
            new_id = cur.fetchone()[0]
    return {"id": new_id}


@app.put("/api/members/{member_id}")
def update_member(
    member_id: int,
    req: MemberRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    decode_token(credentials.credentials)
    if not req.name_zh.strip() or not req.name_en.strip():
        raise HTTPException(status_code=400, detail="姓名不得為空")
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE members SET name_zh=%s, name_en=%s, level=%s WHERE id=%s",
                (req.name_zh.strip(), req.name_en.strip(), req.level.strip(), member_id),
            )
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="找不到此會員")
    return {"ok": True}


@app.delete("/api/members/{member_id}")
def delete_member(
    member_id: int,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    decode_token(credentials.credentials)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM members WHERE id=%s", (member_id,))
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="找不到此會員")
    return {"ok": True}
