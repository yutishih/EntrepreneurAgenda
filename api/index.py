import json
import os
import re
import uuid
import boto3
import bcrypt
import jwt
import psycopg2
import psycopg2.errors
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Any, Dict, Optional

load_dotenv()

# psycopg2 不支援 channel_binding 參數，移除後再連線
_raw_url = os.getenv("DATABASE_URL", "")
DATABASE_URL = re.sub(r"[&?]channel_binding=[^&]*", "", _raw_url)
JWT_SECRET = os.getenv("JWT_SECRET", "please-change-this-secret")
INVITE_CODE = os.getenv("INVITE_CODE", "")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = 24

R2_ACCOUNT_ID        = os.getenv("R2_ACCOUNT_ID", "")
R2_ACCESS_KEY_ID     = os.getenv("R2_ACCESS_KEY_ID", "")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY", "")
R2_BUCKET_NAME       = os.getenv("R2_BUCKET_NAME", "")
R2_PUBLIC_URL        = os.getenv("R2_PUBLIC_URL", "").rstrip("/")


def _r2():
    if not all([R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME]):
        raise HTTPException(status_code=503, detail="R2 未設定，請聯絡管理員")
    return boto3.client(
        "s3",
        endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        region_name="auto",
    )

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


try:
    init_db()
except Exception as e:
    print(f"[init_db] warning: {e}")

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


class MemberRequest(BaseModel):
    name_zh: str
    name_en: str
    level: str


class PresignRequest(BaseModel):
    filename: str
    content_type: str
    meeting_date: Optional[str] = None
    meeting_no: Optional[str] = None


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
    decode_token(credentials.credentials)
    offset = (page - 1) * limit
    with get_db() as conn:
        with conn.cursor() as cur:
            where  = "WHERE 1=1"
            params: list = []
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
    decode_token(credentials.credentials)
    meeting_date = req.data.get("meetingDate") or None
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE agendas SET data = %s::jsonb, meeting_date = %s, updated_at = NOW()"
                " WHERE id = %s",
                (json.dumps(req.data), meeting_date, agenda_id),
            )
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="找不到此議程")
    return {"ok": True}


@app.get("/api/agendas/{agenda_id}")
def get_agenda(agenda_id: int, credentials: HTTPAuthorizationCredentials = Depends(security)):
    decode_token(credentials.credentials)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT data FROM agendas WHERE id = %s", (agenda_id,))
            row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="找不到此議程")
    return parse_jsonb(row[0])


@app.delete("/api/agendas/{agenda_id}")
def delete_agenda(agenda_id: int, credentials: HTTPAuthorizationCredentials = Depends(security)):
    decode_token(credentials.credentials)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM agendas WHERE id = %s", (agenda_id,))
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="找不到此議程")
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
def create_member(req: MemberRequest, credentials: HTTPAuthorizationCredentials = Depends(security)):
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
def update_member(member_id: int, req: MemberRequest, credentials: HTTPAuthorizationCredentials = Depends(security)):
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
def delete_member(member_id: int, credentials: HTTPAuthorizationCredentials = Depends(security)):
    decode_token(credentials.credentials)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM members WHERE id=%s", (member_id,))
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="找不到此會員")
    return {"ok": True}


# ------------------------------------------------------------------ upload
@app.post("/api/upload/presign")
def presign_upload(req: PresignRequest, credentials: HTTPAuthorizationCredentials = Depends(security)):
    decode_token(credentials.credentials)
    ext = req.filename.rsplit(".", 1)[-1].lower() if "." in req.filename else "jpg"
    tw_tz = timezone(timedelta(hours=8))
    ts = datetime.now(tw_tz).strftime("%H%M%S")
    if req.meeting_date and req.meeting_no:
        key = f"media/{req.meeting_date}_No{req.meeting_no}_{ts}.{ext}"
    elif req.meeting_date:
        key = f"media/{req.meeting_date}_{ts}.{ext}"
    else:
        key = f"media/{ts}_{uuid.uuid4()}.{ext}"
    client = _r2()
    upload_url = client.generate_presigned_url(
        "put_object",
        Params={"Bucket": R2_BUCKET_NAME, "Key": key, "ContentType": req.content_type},
        ExpiresIn=300,
    )
    public_url = f"{R2_PUBLIC_URL}/{key}"
    return {"uploadUrl": upload_url, "publicUrl": public_url}


# ------------------------------------------------------------------ image proxy
@app.get("/api/image-proxy")
def image_proxy(
    url: str = Query(...),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    decode_token(credentials.credentials)
    prefix = R2_PUBLIC_URL + "/"
    if not R2_PUBLIC_URL or not url.startswith(prefix):
        raise HTTPException(status_code=400, detail="Invalid image URL")
    key = url[len(prefix):]
    client = _r2()
    try:
        obj = client.get_object(Bucket=R2_BUCKET_NAME, Key=key)
    except Exception:
        raise HTTPException(status_code=404, detail="Image not found")
    data = obj["Body"].read()
    content_type = obj.get("ContentType", "image/jpeg")
    return Response(content=data, media_type=content_type, headers={"Cache-Control": "max-age=3600"})


# ------------------------------------------------------------------ dev-only
@app.delete("/api/dev/users/{username}")
def delete_user(username: str, credentials: HTTPAuthorizationCredentials = Depends(security)):
    decode_token(credentials.credentials)
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM users WHERE username = %s", (username,))
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="找不到此使用者")
    return {"ok": True}
