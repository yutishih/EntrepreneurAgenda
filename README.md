# EntrepreneurAgenda

企業家國際演講會 Club Management 系統，含登入、議程管理、會員管理、分會管理與圖片雲端儲存。

## 專案結構

```
EntrepreneurAgenda/
├── auth.js               # 共用 auth 工具（API_BASE 自動偵測環境、角色輔助函式）
├── login.html            # 登入 / 註冊頁面
├── home.html             # 會務管理首頁（Dashboard 版型）
├── index.html            # 議程表產生器（需登入）
├── roles.html            # 角色安排頁面（多場例會 × 角色矩陣）
├── member.html           # 會員管理頁面（管理 users 資料表；含 system_admin 專屬的角色 / 分會指派）
├── club.html             # 分會管理頁面
├── change-password.html  # 修改密碼頁面（含首次登入強制改密碼）
├── app.js                # 議程產生器主邏輯
├── roles.js              # 角色安排邏輯（ROLE_GROUPS 角色清單 + 矩陣編輯 / merge 存檔）
├── member-ac.js          # 可重用的會員自動完成元件（下拉建議 + 可自由輸入）
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
- `timeOverrides`／`durationOverrides`／`durationLabels`：議程表上的時刻與時長覆寫（見下）

---

## 時間與時長：全部可手動覆寫（`/index` ⏱ 時間設定）

議程表上**每一個**時刻與時長都保留自動計算，同時都能逐場手動指定。**空白 = 自動**。

### 各段開始時刻（`timeOverrides`，議程表「時間」欄）

`receptionStart`、`openingStart`、`speechStart`（多元單元）、`preparedSpeechStart`、`photoStart`、`topicsStart`、`evalStart`、`closingStart`、`sharingStart`，另有 `endTime`（推算休息／即席問答彈性時間的目標結束時刻）。

> **釘住某一段後，後面各段會從該時刻往下推算**——所以指定一個時刻是「整場往後挪」，不會出現與後續各列互相矛盾的時間。上游的釘選仍然有效。
> 格式須為 `H:MM` / `HH:MM`，不合格式即忽略並回到自動值。

### 各段時長（`durationOverrides`，議程表「時長」欄）

`receptionMins`、`openingMins`、`speechMins`、`photoMins`、`intermissionMins`、`topicsMins`、`evalMins`、`closingMins`、`sharingMins`。

自動值的算法：

| 欄位 | 自動計算 |
|------|----------|
| `speechMins` | Σ 各篇演講時長上限 + 4′ 換場 + 總主持人串場（`durationSettings.tmeMins`） |
| `evalMins` | 每位個別講評 3′ + 固定報告 12′ + 總講評串場（`durationSettings.geMins`） |
| `topicsMins`／`intermissionMins` | 吸收距離 `endTime` 的剩餘時間（各上限 +10′）；任一邊被手動指定時，另一邊才吸收剩餘 |
| 其他 | 固定預設值（報到 20′、開幕 10′、拍照 5′、結尾 6′、分享 5′） |

### 講評區固定列時長（`durationLabels`）

`個別講評 2'~3'`、`計時員報告 1'`、`贅語報告 1'`、`語言講評 3'~5'`、`總講評 3'~5'` 原本寫死在版型裡，現在改為每場可編輯的**顯示字串**（可填區間，不參與加總運算），與 `signals` 同一套模式：載入時 merge 到預設值上，舊議程自動沿用原本字樣。

> 版型端從 `ctx.durationLabels` 取用，並以 `templates.js` 的 `DEFAULT_DURATION_LABELS` 作最後防線。`standard` 與 `compact` 已改為資料驅動；`chillhihigh` 的講評列本來就用 `signals` 的綠/黃/紅欄，不受影響。

### 每個欄位旁的「自動: X」與 ⟳

提示顯示的是**該欄自己解除釘選後會變成的值**（上游釘選仍計入），也就是 ⟳ 按下去會還原成的那個值——由 `autoValueFor(key)` 針對單一欄位重算得出，因此提示不會和實際結果矛盾。

> **相容性**：舊版曾把「報到開始」存成 `timeOverrides.openingStart`，而 `openingStart` 現在是「開幕」那一段的獨立釘選。載入時以「有沒有 `receptionStart` 這個鍵」判斷新舊格式，舊資料會遷移到 `receptionStart`，不會被誤讀成新的開幕釘選。

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

## 角色安排（`/roles`）

一頁規劃**多場例會**的角色：**每列一個角色、每欄一場例會**，直接在格子裡填人。

### 直接在矩陣裡新增例會

矩陣最右邊有一欄「＋」（沒有寫入權限的人看不到；完全沒有例會時空狀態畫面也有一顆等效的按鈕）：點下去彈出「新增例會」modal（`#addMeetingModal`，樣式比照 `/agenda` 既有的 modal 語彙），只要選日期、按「新增」就會呼叫跟「新建議程」頁一樣的 `POST /api/agendas`（只帶 `meetingDate`，其他欄位留給版型的 fallback 鏈補）。成功後直接把新例會插進目前的 `meetings` 陣列（依日期排序）並關閉 modal，不用整頁重新載入，馬上就能在新的那一欄填角色。新例會即使日期落在目前的日期篩選範圍之外也會顯示——避免建立後「消失」的錯覺；篩選範圍要到下次變更日期或重新整理才會重新套用。

每欄標題右上角也有一個「✕」可以刪除該場例會（同樣需要寫入權限），會先 `confirm()` 一次（若該場有未儲存的變更，訊息裡會多提醒一句），確認後呼叫 `DELETE /api/agendas/{id}`，成功就從 `meetings` 移除、矩陣就地重繪——議程本體跟角色安排是同一筆記錄，這裡刪掉之後 `/agenda` 那邊自然也不存在了，無法復原。

### 沒有另一套資料表

角色安排**不另存**——每一格讀寫的就是該場議程 `agendas.data` 裡**同一個欄位**（`app.js` 的 `collectData()` 那些）。因此：

- ✅ 在此頁排定角色 → 該場議程表**立即**顯示同一個人。
- ✅ 在議程產生器改角色 → 回到此頁重新載入即同步。
- ⚠️ 角色清單（`roles.js` 的 `ROLE_GROUPS`）是**從議程欄位推導**的。議程若新增角色欄位，記得同步加進 `ROLE_GROUPS`。

### 全站共用同一份角色 schema——不適用的欄位鎖住，不是拿掉

`agendas.data` 的角色欄位是**所有版型共用的同一份 schema**：每個角色（`ROLE_GROUPS` 裡的一筆定義）在每個分會的資料裡都是同一個欄位名，某個版型不需要的角色，該分會的資料裡就是空字串／未填，版型的 `render()` 自然不會讀它、也就不會印出來。

角色安排矩陣**永遠顯示 `ROLE_GROUPS` 全部角色**（不會因為版型不同而整列消失）；只有「目前分會的版型不適用」的角色列會被**鎖住**（`role.locked`，灰階、輸入框 `disabled`，不管有沒有寫入權限都鎖），跟「這場例會剛好沒有這個名額」（`slotNote`，可以直接輸入把名額補上）是兩種不同的視覺語言，不要混淆。

角色定義可加 `templates: string[]`，列出「哪些版型會用到這個角色」（不寫＝所有版型都用得到）：`buildRows()` 依 `activeTemplateKey()` 算出每個角色的 `locked` 旗標。目前有 `templates` 限制的角色：

| 角色 | 適用版型 | 為什麼 |
|------|------|------|
| `callingToOrder` | standard／compact／entrepreneur／china | Chill Hi High 的「致歡迎詞 Opening Remarks」那列讀的是 `welcomeTME`，不再需要這格 |
| `boardWriter`／`photographer` | chillhihigh | 只有 Chill Hi High 議程把板書、攝影列成獨立角色 |
| `voteCounter` | china | CHINA 專屬的計票員（歸在「計時 / 記錄」組） |
| `varietyHost` | standard／compact／entrepreneur／chillhihigh | CHINA 沒有多元單元 |
| `wordOfTheDay`／`quizHost` | china | CHINA 專屬的每日一字、問答遊戲主持（歸在「單元主持」組） |

其餘角色（`receptionHost`、`welcomeTME`、`tme`、`timer`、`ahCounter`、`tableTopicsMaster`、`speeches[i].speaker`、`evaluators[i]`、`langEvaluator`、`generalEvaluator`、`awardsPresenter`、`sharingFeedback`）沒有 `templates` 限制，5 個版型都共用。

### 角色清單（`ROLE_GROUPS`）

| 分組 | 角色（`agendas.data` 欄位） |
|------|------|
| 會議主持 | `receptionHost`、`callingToOrder`、`welcomeTME`、`tme` |
| 計時 / 記錄 | `timer`、`ahCounter`、`boardWriter`、`photographer`、`voteCounter` |
| 單元主持 | `varietyHost`（＝`varietySession.host`）、`tableTopicsMaster`、`wordOfTheDay`、`quizHost` |
| 指定演講 | `speeches[i].speaker`（動態，至少 3 列） |
| 講評 | `evaluators[i]`（動態，至少 3 列）、`langEvaluator`、`generalEvaluator` |
| 結尾 | `awardsPresenter`、`sharingFeedback` |

演講 / 講評的列數取**目前載入場次中的最大值**（最少 3 列）——CHINA 的 3 篇指定演講／3 位個別講評也是走這同一套 `speeches`/`evaluators` 陣列，沒有另外的資料結構。

### CHINA 版型：跟其他版型一樣的固定欄位

CHINA 議程曾經是一份自由格式的逐列清單（`agendaRows`），已經改成跟其他版型相同的固定角色欄位——`templates.js` 的 `china` 版型內部有一張不對外匯出的 `CHINA_SCHEDULE`（該分會目前的週會流程表），每一列綁定要讀的欄位（例如 `Timer` 這一列讀 `data.timer`），純粹是 render() 排版用，角色安排矩陣完全不需要知道它的存在，就跟 standard/compact 一樣。

CHINA 議程表右側原本每列都有一欄「下一場負責人」（`assigneeNext`），現在**不再存進資料庫**，改成**列印/預覽議程時即時查詢**：`app.js` 的 `ensureNextMeetingRoles()` 依「分會 + 這場日期」查詢同分會日期最近的下一場例會（`GET /api/agendas?order=date_asc&date_from=<+1天>&limit=1`），把該場的角色欄位整包當作 `ctx.nextMeetingRoles` 傳給 `render()`；查不到（還沒建立下一場）就顯示空白。查詢結果有 cache（只在分會/日期真的改變時才重查），不會每次打字都打 API。議程編輯頁因此不再有「下次 Next Meeting Assignee」的手動輸入欄。

### 欄標題可編輯的每場欄位（`META_FIELDS`）

欄標題的**例會主題**（`meetingTheme`）也可直接編輯，走與角色**完全相同**的 draft / dirty / merge 流程，但刻意**不列入角色列**——因此不算進「已指派」計數（主題不是人），且不套用會員自動完成。

要再開放其他每場欄位（例如 `meetingNo`），在 `roles.js` 的 `META_FIELDS` 加一筆即可：

```js
const META_FIELDS = [
  { key: 'meetingTheme', label: '例會主題', placeholder: '未設定主題' },
];
```

### 人選輸入：下拉建議 + 可自由輸入

每格都是 `<input class="member-ac">`，由 `member-ac.js` 提供下拉建議（↑↓ 選擇、Enter 確認、Esc 關閉），**同時可以直接打字**——來賓、代理人、`TBD` 都填得進去，下拉只是建議，不會限制輸入值。

- 建議名單來自 `/api/users`（僅 `active`），系統管理員依所選分會取用。
- 插入格式為 `姓名, 等級`，依**該場議程自己的 `data.lang`** 決定中文名或英文名（`data-ac-lang`）。

### 存檔是 merge-based

`PUT /api/agendas/{id}` 是 **full-replace**，所以存檔時：**重新讀取該場議程 → 只覆寫此頁真正改過的角色欄位 → 寫回**。這樣即使有人同時在議程產生器編輯同一場，也不會被舊資料覆蓋。（讀回的 `_clubId` 是編輯器用的提示欄位，寫回前會移除。）

### 介面行為

| 行為 | 說明 |
|------|------|
| 未儲存標示 | 改過的格子（含欄標題的例會主題）變黃底；該欄標題出現橘點；上方顯示未儲存項目數 |
| 例會主題 | 欄標題的主題平時看起來就是說明文字，hover / focus 才浮出輸入框，改完與角色一起儲存 |
| 已指派計數 | 每欄顯示 `已指派 / 該場角色數` |
| 額外名額 | 某場原本沒有的演講 / 講評名額，格子淡化並以 `＋` 提示：填入並儲存**會為該議程新增一列** |
| 未啟用多元單元 | 該場 `varietySession.enabled` 為 false 時淡化提示（只寫 host，不會自動啟用單元） |
| 日期範圍 | 以**例會日期**篩選要顯示的場次（起訖皆含），欄位由左至右由舊到新。預設為今天往前 2 個月 ～ 往後 3 個月——會往回抓，是因為分會最新一場議程往往已經過去，只看「未來」會開在空白畫面。快捷鍵：`←` / `→` 整段平移一個月，另有「近期 / 未來 / 今年 / 全部」。單邊留空即為不限。上限 40 欄，超過時提示縮小範圍（保留最新的場次） |
| 快捷鍵 | `Ctrl/Cmd + S` 儲存全部；有未儲存變更時離開頁面會提示 |
| 權限 | `club_member` 唯讀（欄位 disabled、寫入按鈕隱藏）；`club_admin` 以上可儲存 |

> 例會必須**先有議程**才會出現在此頁。要規劃新的一場，請先用「新建議程」建立該場次。

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
| `/roles` | `roles.html` | 角色安排（多場例會 × 角色矩陣） |
| `/member` | `member.html` | 會員管理（管理 users；system_admin 另可設定角色與所屬分會） |
| `/club` | `club.html` | 分會管理 |
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
| `/roles` | `roles.html` | 角色安排，多場例會 × 角色矩陣，人選可下拉選取或自由輸入 | `club_admin`（寫入） |
| `/member` | `member.html` | 會員管理，新增、編輯、批量匯入、審核、移除會員；system_admin 另可設定角色與所屬分會 | `club_admin`（寫入） |
| `/club` | `club.html` | 分會管理，新增、編輯、刪除分會 | `system_admin`（寫入） |
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
| GET    | `/api/agendas` | 取得議程列表（支援 `date`、`date_from`、`date_to`、`page`、`limit`、`club_id`、`full`、`order`） | 已登入 |
| POST   | `/api/agendas` | 新增議程 | `club_admin` 以上 |
| GET    | `/api/agendas/{id}` | 取得單一議程 | 已登入 |
| PUT    | `/api/agendas/{id}` | 更新議程 | `club_admin` 以上 |
| DELETE | `/api/agendas/{id}` | 刪除議程 | `club_admin` 以上 |

> `club_admin` 只能看到 / 操作自己分會的議程；`system_admin` 可看到全部。

`GET /api/agendas` 的選用參數：

| 參數 | 說明 |
|------|------|
| `full=1` | 每筆額外回傳完整的 `data` JSONB，避免一場一次 GET 的 N+1 請求（角色安排頁一次取多場用） |
| `order=date` | 改以 `meeting_date DESC NULLS LAST` 排序（預設為 `updated_at DESC`） |
| `order=date_asc` | 同上，但由舊到新（`meeting_date ASC NULLS LAST`）——CHINA 議程頁靠 `date_from` + `limit=1` 查「日期最近的下一場」時用 |
| `date_from` / `date_to` | `meeting_date` 範圍（起訖皆含），可只給單邊。給任一邊時，沒有 `meeting_date` 的議程會被排除 |

> `total` 回傳的是**篩選後**的總數，因此可用來判斷是否被 `limit` 截斷。

> 列表每筆另含 `clubId`。未帶這兩個參數時回傳格式與行為不變。

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
