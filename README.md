# EntrepreneurAgenda

企業家國際演講會 Club Management 系統，含登入、議程管理、會員管理、分會管理與圖片雲端儲存。

## 專案結構

```
EntrepreneurAgenda/
├── auth.js               # 共用 auth 工具（API_BASE 自動偵測環境、角色輔助函式）
├── login.html            # 登入 / 註冊頁面
├── home.html             # 會務管理首頁（Dashboard 版型）
├── index.html            # 議程表產生器（需登入）
├── member.html           # 會員管理頁面（管理 users 資料表）
├── club.html             # 分會管理頁面
├── admin.html            # 用戶管理頁面（僅 system_admin）
├── change-password.html  # 修改密碼頁面（含首次登入強制改密碼）
├── app.js                # 議程產生器主邏輯
├── templates.js          # 議程版型引擎（AGENDA_TEMPLATES + 每版型 manifest / 預設素材 / 語言能力）
├── style.css             # 議程產生器樣式（含各版型 .tmpl-<key> 命名空間）
├── media/                # 靜態圖片
│   ├── toastmasters_logo.png   # 官方 TM Logo（標準版預設）
│   ├── Entrepreneur/           # 標準版預設 QR（FacebookQR / LINEQR）
│   └── ChillHiHigh/            # Chill Hi High 預設素材（logo / FB·IG·LINE QR / 第二頁兩張圖）
├── requirements.txt      # Python 套件（Vercel 用）
├── vercel.json           # Vercel 路由設定
├── alembic.ini           # Alembic 設定
├── .env                  # 本地環境變數（不進版控）
├── api/
│   └── index.py         # FastAPI（本地開發 & 正式環境共用）
└── migrations/
    ├── env.py            # Alembic 環境設定（讀取 DATABASE_URL）
    ├── script.py.mako    # Migration 模板
    └── versions/
        ├── 0001_initial_schema.py        # 建立 users / agendas / members
        ├── 0002_seed_admin_user.py       # 初始 admin 帳號
        ├── 0003_add_clubs.py             # 建立 clubs 資料表、members 加 club_id
        ├── 0004_add_roles.py             # users 加 role / club_id、agendas 加 club_id
        ├── 0005_merge_members_to_users.py # users 加 level，廢棄 members 資料表
        ├── 0006_add_must_change_pw.py    # users 加 must_change_pw（首次登入改密）
        ├── 0007_add_status.py            # users 加 status（active / pending 審核制）
        └── 0008_add_club_branding.py     # clubs 加品牌欄位 + template_key（分會專屬版型）
```

---

## 重大架構變更（v2）

> **members 資料表已廢棄。** 每位 `user` 就是一位 club member，`level` 直接存在 `users` 資料表。

| 舊版 | 新版 |
|------|------|
| `members` 獨立資料表 | 改為 `users.level` 欄位 |
| 自行註冊即可登入 | 自行註冊 → `pending`，需管理員審核 |
| 無首次改密機制 | admin 建立帳號後 `must_change_pw=true`，首次登入強制改密碼 |
| `/api/members` | 由 `/api/users` 取代 |

---

## 議程版型引擎（分會專屬版型）

每個分會可擁有**自己的品牌**與**獨立的議程版型**。版型與其所有相關設定（欄位、預設素材、語言能力）**集中定義於 `templates.js`，是單一事實來源**——新增/調整版型基本上只動這個檔案（＋樣式）。

### 版型物件（`AGENDA_TEMPLATES[key]`）

| 屬性 | 說明 |
|------|------|
| `key` / `label` | 版型代號（對應 `clubs.template_key`）與下拉顯示名稱 |
| `render(data, club, ctx)` | 產出 HTML（回傳字串＝單頁；字串陣列＝多頁） |
| `langToggle` | `false` → 隱藏語言切換並固定 `fixedLang`（見「語言能力」） |
| `fixedLang` / `bilingualNames` | 固定渲染語言；`bilingualNames` 讓成員姓名顯示「English 中文」 |
| `assetDefaults` | 分會未上傳時的預設圖（key 用 `logo_url` / `fb_qr_url`…） |
| `fieldDefaults` | 預設值（如 `timeRange` / `venue`） |
| `settings` | **版型專屬欄位 manifest**（見下） |

輔助函式：`templateAssetDefaults(key)`、`templateFieldDefaults(key)`、`applyTmplVisibility(root, key)`。

### 運作方式

- `app.js` 渲染時 `getActiveClub()` 解析目前分會 → 依 `template_key` 取版型 → `render()` 產出 HTML，外層套 `.tmpl-<key>` class。
  - `system_admin`：版型 / 品牌取自議程上方「所屬分會」下拉（從 `/home` 點「新建議程」會以 `?club_id=` 自動帶入所選分會）。
  - `club_admin` / `club_member`：自動取自己所屬分會。
- 品牌與版型為**即時解析**（不快照進 `agendas.data`）。
  - ✅ 編輯分會品牌後，該分會所有議程自動套用新資料。
  - ⚠️ 變更某分會的 `template_key` 會讓其**既有議程**也改用新版型呈現。
- 未設定欄位的 fallback 鏈：分會設定 → 該版型 `fieldDefaults` / `assetDefaults` → 標準版預設。預設圖集中於 `media/Entrepreneur/`（標準版）與 `media/ChillHiHigh/`（Chill Hi High）。

### 語言能力（依版型）

- `standard` / `compact`：提供中/英切換（設定選單的「語言」）。
- `chillhihigh`：中英混用，**隱藏「語言」切換**、固定渲染語言，且成員姓名顯示「English 中文」。
- `app.js` 於 `updatePreview()` 依版型旗標顯示/隱藏「語言」選單並 pin 語言。

### 版型專屬欄位 manifest（`template.settings`）

每個版型專屬欄位**只在 manifest 宣告一次**，`club.html` 的「版型設定」modal 會據此**動態產生**欄位（含填值與存檔）：

```js
{ key, label, type:'text|textarea|image', store:'column|setting',
  group:'basic|template', section, row, placeholder }
```

- `store`：`column` = 存 `clubs` 頂層欄位（如 `charter_no`）；`setting` = 存 `clubs.settings` JSONB。
- `group`：`basic`（分會管理頁「編輯」視窗）/ `template`（「版型」視窗）。分會列表每列有「編輯」「版型」兩顆按鈕，開啟同一 modal 的兩種檢視。
- 圖片欄位透過既有 `/api/upload/presign` **延後上傳**；未上傳時預覽顯示 `assetDefaults`。
- 存檔採 **merge-based**：以現有分會記錄為基底，只覆寫當前版型 manifest 管的欄位（後端 PUT 為 full-replace，避免洗掉他版型欄位）。

目前 `clubs.settings` 內的鍵：
- 表頭/結尾：`slogan`（標語）、`transit`（交通）、`closingLine`（結尾句）
- 議程資訊：`timeRange`（預設時間；日期仍動態帶入當日）、`venue`（預設地點）、`scheduleZh` / `scheduleEn`（會議日期行，隨語言顯示；標準版 fallback 到 `t('meetingSchedule')`）
- 第二頁宣傳後頁：`upcomingMeetings`、`specialEvent`、`membershipFee`、`ig_qr_url`、`page2_hero_url`、`page2_img2_url`

> `venue` / `timeRange` 為**每場可覆寫的預設值**：`applyDefaultState()` 依「分會設定 → 版型 `fieldDefaults` → 標準版」帶入議程表單，仍可逐場修改。

### 每場欄位（存 `agendas.data`，跨版型相容、optional）

- `boardWriter`、`photographer`、`tableTopicsQuestion`
- `signals`：時間管理綠/黃/紅牌（每類別可手動編輯，預設帶入標準計時規則）
- `speeches[].speechLang`：每篇演講語言（`en` / `zh`）。**Chill Hi High** 依此把對應（同索引）的個別講評員標示為「英語講評員 / 國語講評員」。

### 多頁版型

版型 `render()` 可回傳 **字串（單頁）或字串陣列（多頁）**。`#agendaPages` 把第 1 頁放進 `#agendaPreview`、其餘頁以 `.extra-page` 兄弟節點呈現；PDF 匯出用 html2pdf 的 `pagebreak: { before: '.extra-page' }` 自動分頁。`chillhihigh` 即回傳 `[議程頁, 宣傳後頁]` 兩頁。

### 依版型顯示表單區塊（統一 `data-tmpl`）

議程表單中版型專屬區塊以 `data-tmpl="<key>"` 標記；`app.js` 的 `applyTemplateFields()` 呼叫共用的 `applyTmplVisibility()` 依目前版型顯示 / 隱藏。（「版型設定」modal 則直接依 manifest 產生欄位，不需此屬性。）

### 新增一個版型

1. 在 `templates.js` 的 `AGENDA_TEMPLATES` 新增 entry：`key` / `label` / `render`，視需要加 `langToggle` 等語言旗標、`assetDefaults` / `fieldDefaults`、`settings` manifest。
2. 在 `style.css` 以 `.tmpl-<key>` 命名空間撰寫樣式（勿污染其他版型）。

> 「版型設定」modal 欄位、預設值/預設圖、分會版型下拉（`TEMPLATE_OPTIONS`）皆會**自動跟上**——欄位只需在 manifest 宣告一次。

> 內建版型：
> - `standard`（標準版／企業家）
> - `compact`（精簡單欄示範版）
> - `chillhihigh`（雙語幽默版／Chill Hi High：中英混用、內嵌綠/黃/紅時間牌欄、個別講評員依演講語言標示、底部 Meeting Roles 說明；**兩頁**：議程頁 + 宣傳後頁）

---

## 權限系統（RBAC）

系統共有三種角色：

| 角色 | 說明 |
|------|------|
| `system_admin` | 最高權限，可 CRUD 所有分會、所有用戶、所有議程 |
| `club_admin` | 可新增 / 編輯 / 刪除**自己分會**的 `club_member`；可審核 / 拒絕自行註冊的 pending 用戶；可 CRUD 自己分會的議程 |
| `club_member` | 僅能閱覽頁面，無法寫入任何資料 |

### 特殊規則

- `admin` 帳號由 migration `0002` 初始化，**不可刪除，不可變更角色**
- 自行註冊的用戶預設 `status = 'pending'`，**無法登入**，需由 `club_admin` 或 `system_admin` 審核通過 (`approve`) 才能登入
- 管理員直接建立（`POST /api/users`）的帳號 `must_change_pw = true`，首次登入後系統強制導向改密碼頁面
- `club_admin` 建立用戶或議程時，`club_id` 自動設為其所屬分會（不可指定其他分會）
- `club_admin` 只能刪除同分會的 `club_member`，不可刪除其他管理員

### 用戶 status 說明

| status | 說明 |
|--------|------|
| `active` | 正常，可登入 |
| `pending` | 自行註冊，等待管理員審核 |

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
| `R2_ACCOUNT_ID` | Cloudflare 帳號 ID |
| `R2_ACCESS_KEY_ID` | R2 API Token Access Key ID |
| `R2_SECRET_ACCESS_KEY` | R2 API Token Secret |
| `R2_BUCKET_NAME` | R2 Bucket 名稱 |
| `R2_PUBLIC_URL` | R2 Public Development URL（`https://pub-xxx.r2.dev`） |

> ⚠️ `INVITE_CODE` 已移除：自行註冊改為審核制，不再需要邀請碼。

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
| `/login` | `login.html` | 登入 / 自行註冊（送出後等待審核） |
| `/home` | `home.html` | 會務 Dashboard |
| `/index` | `index.html` | 議程表產生器 |
| `/member` | `member.html` | 會員管理（管理 users） |
| `/club` | `club.html` | 分會管理 |
| `/admin` | `admin.html` | 用戶管理（system_admin only） |
| `/change-password` | `change-password.html` | 修改密碼 / 首次登入強制改密碼 |

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
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=your-bucket-name
R2_PUBLIC_URL=https://pub-xxx.r2.dev
```

---

## Database Migration（Alembic）

Schema 版本管理使用 **Alembic**。

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
5. `0005` — `users` 加 `level`；廢棄並刪除 `members` 資料表
6. `0006` — `users` 加 `must_change_pw`（admin 建立帳號首次登入強制改密碼）
7. `0007` — `users` 加 `status`（`active` / `pending` 審核制）
8. `0008` — `clubs` 加品牌欄位 + `template_key`（分會專屬品牌與版型）

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
alembic revision -m "add_avatar_to_users"

# 2. 編輯產生的檔案，填入 upgrade / downgrade
#    migrations/versions/xxxx_add_avatar_to_users.py

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
.\venv\Scripts\alembic.exe current   # 應顯示 0008 (head)
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

圖片命名規則（presign 依 `club_id` 分資料夾）：

- 帶 `club_id`：`media/clubs/{club_id}/...`
  - 議程主題圖：`media/clubs/3/2026-05-20_No280_213022.jpg`
  - 分會 logo/QR/第二頁圖：`media/clubs/3/{時間}_{uuid}.png`
- 未帶 `club_id`：fallback 到扁平 `media/{時間}_{uuid}.png`

> **分會圖片採「延後上傳」**：在 `club.html` 選圖時只在瀏覽器本地預覽快取，按「儲存」才上傳 R2。
> - 新增分會：先 `POST` 建立分會拿到 id → 把快取的圖上傳到 `media/clubs/{新id}/` → `PUT` 寫回 URL。
> - 編輯既有分會：直接上傳到該分會資料夾後存檔。
> - 按「取消」不會上傳，不留孤兒檔。
>
> 議程主題圖（`app.js`）仍為選檔即時上傳，帶該議程所屬分會（system_admin 用所選分會、其餘用自己分會）。

---

## 前端頁面

| 頁面（Vercel URL） | 檔案 | 說明 | 最低權限 |
|--------------------|------|------|----------|
| `/login` | `login.html` | 登入 / 自行註冊（送出後需等待審核） | 無 |
| `/home` | `home.html` | 會務管理 Dashboard，含統計卡片、議程列表 | 任何登入用戶 |
| `/index` | `index.html` | 議程表產生器，即時預覽並可匯出 PDF / JPG | 任何登入用戶 |
| `/member` | `member.html` | 會員管理，新增、編輯、批量匯入、審核、移除會員 | `club_admin`（寫入） |
| `/club` | `club.html` | 分會管理，新增、編輯、刪除分會 | `system_admin`（寫入） |
| `/admin` | `admin.html` | 用戶管理，設定角色與所屬分會 | `system_admin` |
| `/change-password` | `change-password.html` | 修改密碼；admin 建立帳號後首次登入強制跳轉 | 任何登入用戶 |

`auth.js` 會自動偵測環境：
- **本地**（localhost）→ `http://localhost:8001`
- **Vercel**（正式）→ 相對路徑（同網域）

---

## API 端點

### 認證

| 方法 | 路徑 | 說明 | 權限 |
|------|------|------|------|
| POST | `/api/auth/register` | 自行註冊；帳號預設 `status=pending`，**需審核後才能登入** | 無 |
| POST | `/api/auth/login` | 登入，回傳 JWT token（有效期 24 小時）；`pending` 帳號拒絕登入 | 無 |
| GET  | `/api/auth/verify` | 驗證 token，回傳 username / role / club_id / must_change_pw | 已登入 |
| PUT  | `/api/auth/change-password` | 修改自己的密碼；成功後清除 `must_change_pw` 旗標 | 已登入 |

### 議程管理（需 Bearer Token）

| 方法 | 路徑 | 說明 | 權限 |
|------|------|------|------|
| GET    | `/api/agendas` | 取得議程列表（支援 `date`、`page`、`limit`、`club_id`） | 已登入 |
| POST   | `/api/agendas` | 新增議程 | `club_admin` 以上 |
| GET    | `/api/agendas/{id}` | 取得單一議程 | 已登入 |
| PUT    | `/api/agendas/{id}` | 更新議程 | `club_admin` 以上 |
| DELETE | `/api/agendas/{id}` | 刪除議程 | `club_admin` 以上 |

> `club_admin` 只能看到 / 操作自己分會的議程；`system_admin` 可看到全部。

### 分會管理（需 Bearer Token）

| 方法 | 路徑 | 說明 | 權限 |
|------|------|------|------|
| GET    | `/api/clubs` | 取得分會列表（含品牌與 `template_key` 等欄位；**不需登入**，註冊表單只取 `id/name`） | 無 |
| POST   | `/api/clubs` | 新增分會（可帶品牌欄位 + `template_key`） | `system_admin` |
| PUT    | `/api/clubs/{id}` | 更新分會名稱與品牌 / 版型 | `system_admin` |
| DELETE | `/api/clubs/{id}` | 刪除分會 | `system_admin` |

> `/api/clubs` 回傳每個分會的 `name_zh / name_en / charter_no / founded_date / fee / logo_url / fb_qr_url / line_qr_url / template_key / settings`。Logo/QR 透過既有的 `/api/upload/presign` 上傳至 R2 後，URL 存進對應欄位。

### 用戶 / 會員管理（需 Bearer Token）

> **注意：** `members` 資料表已廢棄，會員資料統一由 `users` 管理。

| 方法 | 路徑 | 說明 | 權限 |
|------|------|------|------|
| GET    | `/api/users` | 取得用戶列表（含 level、status；`?club_id=X` 可篩選） | 已登入 |
| POST   | `/api/users` | 新增單一用戶（直接 `active`，`must_change_pw=true`） | `club_admin` 以上 |
| POST   | `/api/users/bulk` | 批量建立 `club_member`（username 自動從 name_en 產生） | `club_admin` 以上 |
| PUT    | `/api/users/{username}` | 更新用戶資料（club_admin：僅 name / level；system_admin：含 role / club_id） | `club_admin` 以上 |
| PUT    | `/api/users/{username}/approve` | 審核通過 pending 用戶（設 status = 'active'） | `club_admin` 以上 |
| DELETE | `/api/users/{username}/reject` | 拒絕並刪除 pending 用戶 | `club_admin` 以上 |
| DELETE | `/api/users/{username}` | 刪除用戶（`admin` 不可刪；club_admin 只能刪同分會 club_member） | `club_admin` 以上 |

#### 批量建立（`/api/users/bulk`）

```json
{
  "members": [
    { "name_zh": "王小明", "name_en": "Wang Xiaoming", "level": "TM" }
  ],
  "club_id": 1,
  "default_password": "Toastmasters1"
}
```

- `username` 自動從 `name_en` 小寫去除特殊字元產生，重複時加流水號
- 所有帳號建立後 `must_change_pw = true`

### 圖片上傳（需 Bearer Token）

| 方法 | 路徑 | 說明 | 權限 |
|------|------|------|------|
| POST | `/api/upload/presign` | 取得 R2 Presigned URL（前端直傳） | `club_admin` 以上 |
| GET  | `/api/image-proxy` | 代理取得 R2 私有圖片（`?url=...`） | 已登入 |

---

## 資料庫 Schema

```sql
CREATE TABLE clubs (
    id           SERIAL PRIMARY KEY,
    name         VARCHAR(100) NOT NULL UNIQUE,   -- 選單顯示用名稱
    name_zh      VARCHAR(150),                   -- 議程表頭中文全名
    name_en      VARCHAR(150),                   -- 議程表頭英文名
    charter_no   VARCHAR(50),                    -- 章程編號
    founded_date VARCHAR(20),                    -- 成立日（字串）
    fee          VARCHAR(50),                    -- 會費字串
    logo_url     TEXT,                           -- R2 Logo URL
    fb_qr_url    TEXT,                           -- R2 Facebook QR URL
    line_qr_url  TEXT,                           -- R2 LINE QR URL
    template_key VARCHAR(50) NOT NULL DEFAULT 'standard',  -- 議程版型代號
    settings     JSONB DEFAULT '{}'::jsonb,      -- 版型專屬設定（slogan/venue/scheduleZh…，依版型 manifest）
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
    id             SERIAL PRIMARY KEY,
    username       VARCHAR(50) UNIQUE NOT NULL,
    password_hash  TEXT NOT NULL,
    name_en        VARCHAR(100),
    name_zh        VARCHAR(100),
    role           VARCHAR(20)  NOT NULL DEFAULT 'club_member',
    club_id        INTEGER REFERENCES clubs(id) ON DELETE SET NULL,
    level          VARCHAR(100) NOT NULL DEFAULT 'TM',
    must_change_pw BOOLEAN      NOT NULL DEFAULT false,
    status         VARCHAR(20)  NOT NULL DEFAULT 'active',
    created_at     TIMESTAMPTZ DEFAULT NOW()
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
```

> `members` 資料表已於 migration `0005` 廢棄並刪除。

議程的 `data` JSONB 欄位包含 `themeImgUrl`，用於儲存 R2 主題圖片的公開網址。

### users 欄位說明

| 欄位 | 說明 |
|------|------|
| `role` | `system_admin` / `club_admin` / `club_member` |
| `level` | TM 等級（`TM`、`ACB`、`DTM` 等），預設 `TM` |
| `must_change_pw` | `true` → 登入後強制導向改密碼頁；admin 建立帳號時自動設為 `true` |
| `status` | `active`（正常）/ `pending`（自行註冊，等待審核） |

### Role 值說明

| role | 說明 |
|------|------|
| `system_admin` | 最高管理員（`admin` 帳號為唯一預設值，不可改、不可刪） |
| `club_admin` | 分會管理員，需指定 `club_id` |
| `club_member` | 一般會員（預設值） |
