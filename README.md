# EntrepreneurAgenda

企業家國際演講會 Club Management 系統，含登入、議程管理、會員管理與圖片雲端儲存。

## 專案結構

```
EntrepreneurAgenda/
├── auth.js            # 共用 auth 工具（API_BASE 自動偵測環境）
├── login.html         # 登入 / 註冊頁面
├── home.html          # 會務管理首頁（Dashboard 版型）
├── index.html         # 議程表產生器（需登入）
├── member.html        # 會員管理頁面
├── app.js             # 議程產生器主邏輯
├── style.css          # 議程產生器樣式
├── media/             # 靜態圖片（TM Logo、FB QR、LINE QR）
├── requirements.txt   # Python 套件（Vercel 用）
├── vercel.json        # Vercel 路由設定
├── .env               # 本地環境變數（不進版控）
├── api/
│   └── index.py      # FastAPI（本地開發 & 正式環境共用）
```

## 正式部署（Vercel）

### 1. Vercel 環境變數設定

至 **Project → Settings → Environment Variables** 新增：

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Neon PostgreSQL 連線字串 |
| `JWT_SECRET` | 隨機產生的密鑰字串 |
| `INVITE_CODE` | 註冊時需填入的邀請碼 |
| `R2_ACCOUNT_ID` | Cloudflare 帳號 ID |
| `R2_ACCESS_KEY_ID` | R2 API Token Access Key ID |
| `R2_SECRET_ACCESS_KEY` | R2 API Token Secret |
| `R2_BUCKET_NAME` | R2 Bucket 名稱 |
| `R2_PUBLIC_URL` | R2 Public Development URL（`https://pub-xxx.r2.dev`） |

### 2. 部署

Push 到 GitHub，Vercel 自動部署。`/api/*` 的請求透過 `vercel.json` 路由至 `api/index.py`。

### 3. URL 路由規則（vercel.json）

| 規則 | 說明 |
|------|------|
| `cleanUrls: true` | 自動去除頁面 URL 的 `.html`，例如 `/login.html` → `/login` |
| `/` redirect → `/login` | 訪問根路徑自動跳轉至登入頁 |

> 本地開發（Live Server）不支援 clean URLs，請直接用 `http://127.0.0.1:5500/login.html` 存取。

---

## 本地開發（FastAPI）

### 第一次設定

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 之後每次啟動

```powershell
.\venv\Scripts\Activate.ps1
uvicorn api.index:app --reload --port 8001
```

後端跑在 `http://localhost:8001`。

| 文件頁面 | 位址 |
|----------|------|
| Swagger UI | http://localhost:8001/docs |
| ReDoc | http://localhost:8001/redoc |

### 本地 .env 設定

```env
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret
INVITE_CODE=your-invite-code
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=your-bucket-name
R2_PUBLIC_URL=https://pub-xxx.r2.dev
```

---

## Cloudflare R2 設定

主題圖片透過 R2 儲存，需完成以下設定：

1. 建立 R2 Bucket，開啟 **Public Development URL**
2. 建立 R2 API Token（權限：**Object Read & Write**）
3. 在 Bucket **Settings → CORS Policy** 加入：

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

圖片命名規則：`media/{會議日期}_No{編號}_{時間}.{副檔名}`
（例：`media/2026-05-20_No280_213022.jpg`）

---

## 前端頁面

| 頁面（Vercel URL） | 檔案 | 說明 |
|--------------------|------|------|
| `/login` | `login.html` | 登入 / 註冊，成功後跳轉至 `/home` |
| `/home` | `home.html` | 會務管理 Dashboard，含統計卡片、議程列表、日期篩選 |
| `/index` | `index.html` | 議程表產生器，即時預覽並可匯出 PDF / JPG |
| `/member` | `member.html` | 會員管理，新增、編輯、搜尋、移除會員 |

`auth.js` 會自動偵測環境：
- **本地**（localhost）→ `http://localhost:8001`
- **Vercel**（正式）→ 相對路徑（同網域）

---

## API 端點

### 認證

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/api/auth/register` | 註冊（需邀請碼） |
| POST | `/api/auth/login` | 登入，回傳 JWT token（有效期 24 小時） |
| GET  | `/api/auth/verify` | 驗證 token |

### 議程管理（需 Bearer Token）

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET    | `/api/agendas` | 取得議程列表（支援 `date`、`page`、`limit`） |
| POST   | `/api/agendas` | 新增議程 |
| GET    | `/api/agendas/{id}` | 取得單一議程 |
| PUT    | `/api/agendas/{id}` | 更新議程 |
| DELETE | `/api/agendas/{id}` | 刪除議程 |

### 會員管理（需 Bearer Token）

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET    | `/api/members` | 取得所有會員 |
| POST   | `/api/members` | 新增會員 |
| PUT    | `/api/members/{id}` | 更新會員 |
| DELETE | `/api/members/{id}` | 刪除會員 |

### 圖片上傳（需 Bearer Token）

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/api/upload/presign` | 取得 R2 Presigned URL（前端直傳） |

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

議程的 `data` JSONB 欄位包含 `themeImgUrl`，用於儲存 R2 主題圖片的公開網址。
