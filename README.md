# EntrepreneurAgenda

企業家國際演講會議程表產生器，含登入系統。

## 專案結構

```
EntrepreneurAgenda/
├── auth.js            # 共用 auth 工具（API_BASE 自動偵測環境）
├── login.html         # 登入 / 註冊頁面
├── index.html         # 議程表主頁（需登入）
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
| `JWT_SECRET` | 隨機產生的密鑰字串 |

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

後端跑在 `http://localhost:8001`，啟動時自動建立 / 更新 `users` 資料表。

### 本地 .env 設定

在 `backend/.env` 填入：

```env
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret
```

---

## 前端

瀏覽器開啟 `login.html`，登入後自動跳轉至 `index.html`。

`auth.js` 會自動偵測環境：
- **本地**（localhost）→ `http://localhost:8001`
- **Vercel**（正式）→ 相對路徑（同網域）

---

## API 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/api/auth/register` | 註冊（帳號 ≥ 3 字元，密碼 ≥ 6 字元，需填英中文姓名） |
| POST | `/api/auth/login` | 登入，回傳 JWT token（有效期 24 小時） |
| GET  | `/api/auth/verify` | 驗證 token 是否有效 |

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
```
