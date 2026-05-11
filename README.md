# EntrepreneurAgenda

企業家國際演講會議程表產生器，含登入系統。

## 專案結構

```
EntrepreneurAgenda/
├── auth.js        # 共用 auth 工具
├── login.html     # 登入 / 註冊頁面
├── index.html     # 議程表主頁（需登入）
├── app.js
├── style.css
└── backend/
    ├── main.py
    ├── requirements.txt
    └── .env       # 資料庫連線字串（不進版控）
```

## 後端啟動（FastAPI）

### 第一次設定

```powershell
cd backend

# 若 PowerShell 不允許執行 .ps1，先執行一次：
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 之後每次啟動

```powershell
cd backend
.\venv\Scripts\Activate.ps1
uvicorn main:app --reload
```

後端預設跑在 `http://localhost:8000`，啟動時會自動建立 `users` 資料表。

## 前端

直接用瀏覽器開啟 `login.html`，登入後自動跳轉至 `index.html`。

## API 端點

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/api/auth/register` | 註冊（帳號 ≥ 3 字元，密碼 ≥ 6 字元） |
| POST | `/api/auth/login` | 登入，回傳 JWT token |
| GET  | `/api/auth/verify` | 驗證 token |
