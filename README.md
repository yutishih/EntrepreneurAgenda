# EntrepreneurAgenda

企業家國際演講會 Club Management 系統，含登入、議程管理、會員管理、分會管理與圖片雲端儲存。

## 專案結構

```
EntrepreneurAgenda/
├── auth.js            # 共用 auth 工具（API_BASE 自動偵測環境、角色輔助函式）
├── login.html         # 登入 / 註冊頁面
├── home.html          # 會務管理首頁（Dashboard 版型）
├── index.html         # 議程表產生器（需登入）
├── member.html        # 會員管理頁面
├── club.html          # 分會管理頁面
├── admin.html         # 用戶管理頁面（僅 system_admin）
├── app.js             # 議程產生器主邏輯
├── style.css          # 議程產生器樣式
├── media/             # 靜態圖片（TM Logo、FB QR、LINE QR）
├── requirements.txt   # Python 套件（Vercel 用）
├── vercel.json        # Vercel 路由設定
├── alembic.ini        # Alembic 設定
├── .env               # 本地環境變數（不進版控）
├── api/
│   └── index.py      # FastAPI（本地開發 & 正式環境共用）
└── migrations/
    ├── env.py         # Alembic 環境設定（讀取 DATABASE_URL）
    ├── script.py.mako # Migration 模板
    └── versions/
        ├── 0001_initial_schema.py   # 建立 users / agendas / members
        ├── 0002_seed_admin_user.py  # 初始 admin 帳號
        ├── 0003_add_clubs.py        # 建立 clubs 資料表、members 加 club_id
        └── 0004_add_roles.py        # users 加 role / club_id、agendas 加 club_id
```

---

## 權限系統（RBAC）

系統共有三種角色：

| 角色 | 說明 |
|------|------|
| `system_admin` | 最高權限，可 CRUD 所有分會、所有會員、所有議程、所有用戶 |
| `club_admin` | 可 CRUD **自己分會**的會員與議程；不可操作其他分會或管理用戶 |
| `club_member` | 僅能閱覽頁面，無法寫入任何資料 |

### 特殊規則

- `admin` 帳號由 migration `0002` 初始化，**不可刪除，不可變更角色**
- 新註冊用戶預設角色為 `club_member`，需由 system_admin 升級
- club_admin 新增會員或議程時，`club_id` 自動設為其所屬分會（不可指定其他分會）

### 前端 UI 規則

`auth.js` 的 `applyRoleUI()` 會依角色隱藏對應元素：

| CSS class | 說明 |
|-----------|------|
| `.write-action` | 寫入操作按鈕（`club_member` 看不到） |
| `.system-admin-only` | 系統管理員操作（僅 `system_admin` 看到） |

---

## 正式部署（Vercel）

### 1. Vercel 環境變數設定

至 **Project → Settings → Environment Variables** 新增：

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Neon PostgreSQL **Pooled** 連線字串（見下方說明） |
| `JWT_SECRET` | 隨機產生的密鑰字串 |
| `INVITE_CODE` | 註冊時需填入的邀請碼 |
| `R2_ACCOUNT_ID` | Cloudflare 帳號 ID |
| `R2_ACCESS_KEY_ID` | R2 API Token Access Key ID |
| `R2_SECRET_ACCESS_KEY` | R2 API Token Secret |
| `R2_BUCKET_NAME` | R2 Bucket 名稱 |
| `R2_PUBLIC_URL` | R2 Public Development URL（`https://pub-xxx.r2.dev`） |

#### DATABASE_URL：使用 Neon Connection Pooler

為降低 serverless 冷啟動時的 DB 連線延遲，請使用 Neon 的 **Pooled connection string**：

1. Neon Dashboard → 選 Project → **Branches** → 點 branch（`main`）
2. Connection string 區塊將 **Connection type** 切換為 **Pooled connection**
3. 複製連線字串（hostname 中含 `-pooler`），貼入 Vercel `DATABASE_URL`

```
# Pooled 連線字串範例（hostname 含 -pooler）
postgresql://user:pass@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/dbname?sslmode=require
```

> `channel_binding` 參數會由程式碼自動移除，不影響連線。

### 2. 部署

Push 到 GitHub，Vercel 自動部署。`/api/*` 的請求透過 `vercel.json` 路由至 `api/index.py`。

> ⚠️ Vercel **不會自動執行 migration**。每次新增 migration 版本後，請手動在正式 DB 執行 `alembic upgrade head`。

### 3. URL 路由規則（vercel.json）

| URL | 對應檔案 | 說明 |
|-----|---------|------|
| `/login` | `login.html` | 登入 / 註冊 |
| `/home` | `home.html` | 會務 Dashboard |
| `/index` | `index.html` | 議程表產生器 |
| `/member` | `member.html` | 會員管理 |
| `/club` | `club.html` | 分會管理 |
| `/admin` | `admin.html` | 用戶管理（system_admin only） |

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

## Database Migration（Alembic）

Schema 版本管理使用 **Alembic**，取代舊有的 `init_db()` 手動執行方式。

### 部署新環境 / 第一次初始化

```powershell
.\venv\Scripts\Activate.ps1
alembic upgrade head
```

這個指令會依序執行所有 migration：

1. `0001` — 建立 `users`、`agendas`、`members` 資料表
2. `0002` — 新增預設 `admin` 帳號（密碼見部署文件）
3. `0003` — 建立 `clubs` 資料表；`members` 加 `club_id` 外鍵
4. `0004` — `users` 加 `role`、`club_id`；`agendas` 加 `club_id`；`admin` 升為 `system_admin`

### 常用指令

| 指令 | 說明 |
|------|------|
| `alembic history` | 查看所有 migration 版本 |
| `alembic current` | 查看 DB 目前在哪個版本 |
| `alembic upgrade head` | 執行全部尚未套用的 migration |
| `alembic downgrade -1` | 回滾上一個版本 |
| `alembic revision -m "描述"` | 建立新 migration 檔 |

### 新增欄位的流程

```powershell
# 1. 建立新 migration
alembic revision -m "add_avatar_to_members"

# 2. 編輯產生的檔案，填入 upgrade / downgrade
#    migrations/versions/xxxx_add_avatar_to_members.py

# 3. 套用
alembic upgrade head
```

### 測試 Migration（上正式 DB 前）

建議先用獨立的測試 DB 驗證，確認無誤再套用正式環境。

**1. 在 Neon 建立新的測試 Project**
> [console.neon.tech](https://console.neon.tech) → New Project → 取得 Pooled connection string

**2. 暫時替換 `.env` 的 `DATABASE_URL`**
```env
DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.../neondb?sslmode=require
```

**3. 跑 migration 並驗證**
```powershell
.\venv\Scripts\alembic.exe upgrade head
.\venv\Scripts\alembic.exe current   # 應顯示 0004 (head)
```

**4. 確認無誤後，將 `.env` 改回正式 DB，再執行一次**
```powershell
.\venv\Scripts\alembic.exe upgrade head
```

> **Rollback**：若需要回滾，`alembic downgrade -1` 回一版，`alembic downgrade base` 全部清除。
> 正式 DB 執行 downgrade 前請務必備份，`DROP TABLE` 無法復原。

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

| 頁面（Vercel URL） | 檔案 | 說明 | 最低權限 |
|--------------------|------|------|----------|
| `/login` | `login.html` | 登入 / 註冊，成功後跳轉至 `/home` | 無 |
| `/home` | `home.html` | 會務管理 Dashboard，含統計卡片、議程列表 | 任何登入用戶 |
| `/index` | `index.html` | 議程表產生器，即時預覽並可匯出 PDF / JPG | 任何登入用戶 |
| `/member` | `member.html` | 會員管理，新增、編輯、搜尋、移除會員 | `club_admin`（寫入） |
| `/club` | `club.html` | 分會管理，新增、編輯、刪除分會 | `system_admin`（寫入） |
| `/admin` | `admin.html` | 用戶管理，設定角色與所屬分會 | `system_admin` |

`auth.js` 會自動偵測環境：
- **本地**（localhost）→ `http://localhost:8001`
- **Vercel**（正式）→ 相對路徑（同網域）

---

## API 端點

### 認證

| 方法 | 路徑 | 說明 | 權限 |
|------|------|------|------|
| POST | `/api/auth/register` | 註冊（需邀請碼），預設 `club_member` | 無 |
| POST | `/api/auth/login` | 登入，回傳 JWT token（有效期 24 小時） | 無 |
| GET  | `/api/auth/verify` | 驗證 token，回傳 username / role / club_id | 已登入 |

### 議程管理（需 Bearer Token）

| 方法 | 路徑 | 說明 | 權限 |
|------|------|------|------|
| GET    | `/api/agendas` | 取得議程列表（支援 `date`、`page`、`limit`） | 已登入 |
| POST   | `/api/agendas` | 新增議程 | `club_admin` 以上 |
| GET    | `/api/agendas/{id}` | 取得單一議程 | 已登入 |
| PUT    | `/api/agendas/{id}` | 更新議程 | `club_admin` 以上 |
| DELETE | `/api/agendas/{id}` | 刪除議程 | `club_admin` 以上 |

> `club_admin` 只能看到 / 操作自己分會的議程；`system_admin` 可看到全部。

### 會員管理（需 Bearer Token）

| 方法 | 路徑 | 說明 | 權限 |
|------|------|------|------|
| GET    | `/api/members` | 取得會員列表 | 已登入 |
| POST   | `/api/members` | 新增會員 | `club_admin` 以上 |
| PUT    | `/api/members/{id}` | 更新會員 | `club_admin` 以上 |
| DELETE | `/api/members/{id}` | 刪除會員 | `club_admin` 以上 |

> `club_admin` 只能看到 / 操作自己分會的會員。

### 分會管理（需 Bearer Token）

| 方法 | 路徑 | 說明 | 權限 |
|------|------|------|------|
| GET    | `/api/clubs` | 取得分會列表 | 已登入 |
| POST   | `/api/clubs` | 新增分會 | `system_admin` |
| PUT    | `/api/clubs/{id}` | 更新分會名稱 | `system_admin` |
| DELETE | `/api/clubs/{id}` | 刪除分會 | `system_admin` |

### 用戶管理（需 Bearer Token）

| 方法 | 路徑 | 說明 | 權限 |
|------|------|------|------|
| GET    | `/api/users` | 取得所有用戶（含角色 / 分會） | `system_admin` |
| PUT    | `/api/users/{username}` | 更新用戶角色 / 所屬分會 | `system_admin` |
| DELETE | `/api/users/{username}` | 刪除用戶（`admin` 不可刪） | `system_admin` |

### 圖片上傳（需 Bearer Token）

| 方法 | 路徑 | 說明 | 權限 |
|------|------|------|------|
| POST | `/api/upload/presign` | 取得 R2 Presigned URL（前端直傳） | `club_admin` 以上 |

---

## 資料庫 Schema

```sql
CREATE TABLE clubs (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    username      VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name_en       VARCHAR(100),
    name_zh       VARCHAR(100),
    role          VARCHAR(20) NOT NULL DEFAULT 'club_member',
    club_id       INTEGER REFERENCES clubs(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE agendas (
    id           SERIAL PRIMARY KEY,
    username     VARCHAR(50) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    data         JSONB NOT NULL,
    meeting_date DATE,
    club_id      INTEGER REFERENCES clubs(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE members (
    id         SERIAL PRIMARY KEY,
    name_zh    VARCHAR(100) NOT NULL,
    name_en    VARCHAR(100) NOT NULL,
    level      VARCHAR(100) NOT NULL DEFAULT 'TM',
    club_id    INTEGER REFERENCES clubs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

議程的 `data` JSONB 欄位包含 `themeImgUrl`，用於儲存 R2 主題圖片的公開網址。

### Role 值說明

| role | 說明 |
|------|------|
| `system_admin` | 最高管理員（`admin` 帳號為唯一預設值，不可改、不可刪） |
| `club_admin` | 分會管理員，需指定 `club_id` |
| `club_member` | 一般會員（預設值） |
