# EntrepreneurAgenda

企業家國際演講會議程表產生器，含登入系統與議程雲端管理。

## 專案結構

```
EntrepreneurAgenda/
├── auth.js            # 共用 auth 工具（API_BASE 自動偵測環境）
├── login.html         # 登入 / 註冊頁面
├── home.html          # 議程管理首頁（列表、新增、刪除）
├── index.html         # 議程表產生器（需登入）
├── member.html        # 會員管理頁面
├── app.js
├── style.css
├── media/             # 預設圖片（TM Logo、FB QR、LINE QR）
├── requirements.txt   # Vercel 用（根目錄）
├── vercel.json        # Vercel 路由設定
├── api/
│   └── index.py      # Vercel Serverless FastAPI（正式環境）
└── backend/
    ├── main.py        # 本地開發用 FastAPI（含 connection pool）
    └── .env           # 本地環境變數（不進版控）
```

## 正式部署（Vercel）

### 1. Vercel 環境變數設定

至 **Project → Settings → Environment Variables** 新增：

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Neon PostgreSQL 連線字串 |
| `JWT_SECRET` | 隨機產生的密鑰字串（用於簽名與驗證 JWT token，勿外洩） |
| `INVITE_CODE` | 註冊時需填入的邀請碼 |

### 2. 部署

Push 到 GitHub，Vercel 自動部署。`/api/*` 的請求會透過 `vercel.json` 路由至 `api/index.py`。

---

## 本地開發（FastAPI）

### 第一次設定

```powershell
# 若 PowerShell 不允許執行 .ps1，先執行一次：
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
```

### 之後每次啟動

```powershell
.\venv\Scripts\Activate.ps1
cd backend
uvicorn main:app --reload --port 8001
```

後端跑在 `http://localhost:8001`，啟動時自動建立 / 更新資料表。

### 本地 .env 設定

在 `backend/.env` 填入：

```env
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret
```

---

## 前端頁面

| 頁面 | 說明 |
|------|------|
| `login.html` | 登入 / 註冊，成功後跳轉至 `home.html` |
| `home.html` | 議程管理首頁，顯示所有已儲存議程，可新增或刪除 |
| `index.html` | 議程表產生器，填寫內容後即時預覽並可匯出 PDF |
| `member.html` | 會員管理，管理會議成員資料 |

`auth.js` 會自動偵測環境：
- **本地**（localhost）→ `http://localhost:8001`
- **Vercel**（正式）→ 相對路徑（同網域）

---

## API 端點

### 認證

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/api/auth/register` | 註冊（帳號 ≥ 3 字元，密碼 ≥ 6 字元，需填英中文姓名） |
| POST | `/api/auth/login` | 登入，回傳 JWT token（有效期 24 小時） |
| GET  | `/api/auth/verify` | 驗證 token 是否有效 |

### 議程管理（需 Bearer Token）

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET    | `/api/agendas` | 取得議程列表（支援 `date`、`page`、`limit` 查詢參數） |
| POST   | `/api/agendas` | 新增議程 |
| GET    | `/api/agendas/{id}` | 取得單一議程完整資料 |
| PUT    | `/api/agendas/{id}` | 更新議程 |
| DELETE | `/api/agendas/{id}` | 刪除議程 |

### 會員管理（需 Bearer Token）

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET    | `/api/members` | 取得所有會員列表 |
| POST   | `/api/members` | 新增會員（需填中英文姓名與職級） |
| PUT    | `/api/members/{id}` | 更新會員資料 |
| DELETE | `/api/members/{id}` | 刪除會員 |

---

## 資料庫 Schema

```sql
CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name_en       VARCHAR(100),
    name_zh       VARCHAR(100),
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE agendas (
    id           SERIAL PRIMARY KEY,
    username     VARCHAR(50) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    data         JSONB NOT NULL,
    meeting_date DATE,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE members (
    id         SERIAL PRIMARY KEY,
    name_zh    VARCHAR(100) NOT NULL,
    name_en    VARCHAR(100) NOT NULL,
    level      VARCHAR(100) NOT NULL DEFAULT 'TM',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```
