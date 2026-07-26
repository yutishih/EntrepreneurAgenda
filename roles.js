'use strict';

/**
 * ROLE PLANNING (/roles)
 * ================================================================
 * A matrix editor for meeting roles: one column per meeting, one row per role.
 *
 * There is no separate storage for role plans — the cells read and write the
 * *same* fields of `agendas.data` that the agenda generator uses, so planning a
 * role here immediately shows up on that meeting's agenda sheet, and vice
 * versa. The role list below is therefore derived from the agenda fields in
 * `app.js` (`collectData()` / `collectSaveData()`).
 *
 * Because `PUT /api/agendas/{id}` replaces `data` wholesale, saving is
 * merge-based: re-read the agenda, overwrite only the role fields that were
 * edited here, then write it back. That keeps a concurrent edit in the agenda
 * editor from being clobbered by a stale copy.
 */

// ================================================================
// ROLE DEFINITIONS  (mirrors the agenda fields in app.js)
// ================================================================
const ROLE_GROUPS = [
  {
    label: '會議主持',
    roles: [
      { key: 'receptionHost',  label: '報到接待',     en: 'Reception Host' },
      { key: 'callingToOrder', label: '宣布例會開始', en: 'Calling to Order' },
      { key: 'welcomeTME',     label: '會長致歡迎詞', en: 'Welcome Guests & TME' },
      { key: 'tme',            label: '總主持人',     en: 'Toastmaster of the Evening' },
    ],
  },
  {
    label: '計時 / 記錄',
    roles: [
      { key: 'timer',        label: '計時員',     en: 'Timer' },
      { key: 'ahCounter',    label: '贅語記錄員', en: 'Ah-Counter' },
      { key: 'boardWriter',  label: '板書',       en: 'Board Writer' },
      { key: 'photographer', label: '攝影',       en: 'Photographer' },
    ],
  },
  {
    label: '單元主持',
    roles: [
      { key: 'varietyHost',       label: '多元單元主持人', en: 'Variety Session Host', kind: 'variety' },
      { key: 'tableTopicsMaster', label: '即席問答主持人', en: 'Table Topics Master' },
    ],
  },
  { label: '指定演講', dynamic: 'speech' },
  {
    label: '講評',
    dynamic: 'evaluator',
    // Rendered after the per-speaker evaluator rows.
    tail: [
      { key: 'langEvaluator',    label: '語言講評', en: 'Language Evaluator' },
      { key: 'generalEvaluator', label: '總講評',   en: 'General Evaluator' },
    ],
  },
  {
    label: '結尾',
    roles: [
      { key: 'awardsPresenter', label: '贈感謝狀',            en: 'Awards Presenter' },
      { key: 'sharingFeedback', label: '會後分享 & 來賓回饋', en: 'Sharing & Feedback' },
    ],
  },
];

/**
 * Per-meeting fields edited in the column header instead of as a matrix row.
 * They ride the same draft / dirty / merge machinery as roles — a plain
 * `data[key]` write — but are deliberately kept out of the role rows so they
 * never count toward the assignment tally or duplicate detection. They are also
 * not member fields, so they get no autocomplete.
 */
const META_FIELDS = [
  { key: 'meetingTheme', label: '例會主題', placeholder: '未設定主題' },
];

/** Same shape app.js uses, so a row added here stays valid in the editor. */
function blankSpeech() {
  return {
    title: '', speaker: '', duration: "5'-7'", speechLang: 'en',
    pathwayCode: '', pathwayLevel: '', pathwayProject: '',
  };
}

function roleGet(data, role) {
  if (role.kind === 'speech')    return (data.speeches   || [])[role.idx]?.speaker || '';
  if (role.kind === 'evaluator') return (data.evaluators || [])[role.idx] || '';
  if (role.kind === 'variety')   return data.varietySession?.host || '';
  return data[role.key] || '';
}

function roleSet(data, role, value) {
  if (role.kind === 'speech') {
    if (!Array.isArray(data.speeches)) data.speeches = [];
    while (data.speeches.length <= role.idx) data.speeches.push(blankSpeech());
    data.speeches[role.idx].speaker = value;
  } else if (role.kind === 'evaluator') {
    if (!Array.isArray(data.evaluators)) data.evaluators = [];
    while (data.evaluators.length <= role.idx) data.evaluators.push('');
    data.evaluators[role.idx] = value;
  } else if (role.kind === 'variety') {
    // Only the host is touched — whether the session runs stays the editor's call.
    if (!data.varietySession) data.varietySession = { enabled: false, duration: 15, host: '' };
    data.varietySession.host = value;
  } else {
    data[role.key] = value;
  }
}

// ================================================================
// STATE
// ================================================================
let meetings       = [];     // [{ id, meetingDate, meetingNo, meetingTheme, clubId, data, draft, dirty:Set }]
let rows           = [];     // flattened matrix rows: {type:'group'|'role', ...}
let roleById       = {};     // roleId → role descriptor
let allClubs       = [];
let selectedClubId = null;
let dateFrom       = '';    // inclusive meeting_date bounds; '' = unbounded
let dateTo         = '';

/** Safety net so an unbounded range cannot pull the whole history at once. */
const MAX_COLUMNS = 40;

const roleId = role => role.key;

// ---------------------------------------------------------------- date range
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function addMonths(iso, n) {
  const d = new Date(`${iso}T00:00:00`);
  const day = d.getDate();
  d.setMonth(d.getMonth() + n);
  if (d.getDate() < day) d.setDate(0);   // clamp e.g. 3/31 -1mo → 2/28
  return ymd(d);
}

/**
 * Default window: a couple of months back through the next quarter. Reaching
 * backwards matters — a club's newest agenda is often already in the past, and
 * an "upcoming only" default would open on an empty board.
 */
function defaultRange() {
  const today = ymd(new Date());
  return { from: addMonths(today, -2), to: addMonths(today, 3) };
}

const confirmDiscard = () =>
  !dirtyMeetings().length || confirm('有未儲存的變更，重新載入將會捨棄。要繼續嗎？');

function applyPreset(kind, arg) {
  if (!confirmDiscard()) return;
  const today = ymd(new Date());
  if (kind === 'around')        { const r = defaultRange(); dateFrom = r.from; dateTo = r.to; }
  else if (kind === 'upcoming') { dateFrom = today;                    dateTo = addMonths(today, 6); }
  else if (kind === 'year')     { const y = new Date().getFullYear();  dateFrom = `${y}-01-01`; dateTo = `${y}-12-31`; }
  else if (kind === 'all')      { dateFrom = ''; dateTo = ''; }
  else if (kind === 'shift') {
    // Shift the whole window; needs both bounds to be meaningful.
    if (!dateFrom || !dateTo) { const r = defaultRange(); dateFrom = r.from; dateTo = r.to; }
    dateFrom = addMonths(dateFrom, arg);
    dateTo   = addMonths(dateTo,   arg);
  }
  syncDateInputs();
  loadMeetings();
}

function syncDateInputs() {
  document.getElementById('dateFrom').value = dateFrom;
  document.getElementById('dateTo').value   = dateTo;
}

function onDateRangeChange() {
  const from = document.getElementById('dateFrom').value;
  const to   = document.getElementById('dateTo').value;
  if (from && to && from > to) {
    toast('開始日期不能晚於結束日期', true);
    syncDateInputs();     // revert to the last accepted range
    return;
  }
  if (!confirmDiscard()) { syncDateInputs(); return; }
  dateFrom = from;
  dateTo   = to;
  loadMeetings();
}

// ================================================================
// INIT
// ================================================================
async function init() {
  applyRoleUI();
  const token = getToken();
  if (!token) { location.href = '/login'; return; }
  try {
    const res = await fetch(`${API_BASE}/api/auth/verify`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) { clearAuth(); location.href = '/login'; return; }
    const d = await res.json();
    setAuth(getToken(), d.username, d.role, d.club_id, d.must_change_pw);
    if (d.must_change_pw) { location.href = '/change-password'; return; }
    document.getElementById('navUser').textContent   = d.username;
    document.getElementById('userAvatar').textContent = d.username.slice(0, 1).toUpperCase();
    applyRoleUI();
  } catch {
    clearAuth(); location.href = '/login'; return;
  }

  MemberAC.init();

  const r = defaultRange();
  dateFrom = r.from;
  dateTo   = r.to;
  syncDateInputs();

  // Registered before any early return so they are always active, including for
  // a system_admin who has not picked a club yet.
  document.addEventListener('keydown', e => {          // Ctrl/Cmd+S saves the board
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (canWrite()) saveAll();
    }
  });
  window.addEventListener('beforeunload', e => {
    if (dirtyMeetings().length) { e.preventDefault(); e.returnValue = ''; }
  });

  if (isSystemAdmin()) {
    await loadClubs();
    if (selectedClubId == null) { showPickClubHint(); return; }
  }
  await Promise.all([loadRoster(), loadMeetings()]);
}

async function loadClubs() {
  try {
    const res = await fetch(`${API_BASE}/api/clubs`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) throw new Error();
    allClubs = await res.json();
    const sel = document.getElementById('clubPickerSelect');
    sel.innerHTML = '<option value="">— 請選擇分會 —</option>' +
      allClubs.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    document.getElementById('clubPickerBar').style.display = '';
  } catch {
    toast('載入分會失敗', true);
  }
}

async function onClubChange() {
  if (dirtyMeetings().length && !confirm('有未儲存的變更，切換分會將會捨棄。要繼續嗎？')) {
    document.getElementById('clubPickerSelect').value = selectedClubId ?? '';
    return;
  }
  const v = document.getElementById('clubPickerSelect').value;
  selectedClubId = v ? parseInt(v, 10) : null;
  if (selectedClubId == null) { showPickClubHint(); return; }
  await Promise.all([loadRoster(), loadMeetings()]);
}

function showPickClubHint() {
  meetings = [];
  document.getElementById('matrixWrap').innerHTML =
    '<div class="matrix-empty">請先於上方選擇分會，以規劃該分會的例會角色</div>';
  updateSaveBar();
  document.getElementById('pagerLabel').textContent = '';
}

/** Roster that feeds the cell dropdowns. Guests can still be typed freely. */
async function loadRoster() {
  try {
    let url = `${API_BASE}/api/users`;
    if (isSystemAdmin() && selectedClubId != null) url += `?club_id=${selectedClubId}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${getToken()}` } });
    if (!res.ok) throw new Error();
    const users = await res.json();
    MemberAC.setRoster(users.filter(u => (u.status || 'active') === 'active'));
    document.getElementById('rosterCount').textContent = `${MemberAC.getRoster().length} 位會員可選`;
  } catch {
    toast('載入會員名單失敗，仍可手動輸入姓名', true);
  }
}

async function loadMeetings() {
  const wrap = document.getElementById('matrixWrap');
  wrap.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
  try {
    const params = new URLSearchParams({
      full: '1', order: 'date', limit: String(MAX_COLUMNS), page: '1',
    });
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo)   params.set('date_to',   dateTo);
    if (isSystemAdmin() && selectedClubId != null) params.set('club_id', selectedClubId);
    const res = await fetch(`${API_BASE}/api/agendas?${params}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) throw new Error();
    const json = await res.json();

    // API returns newest first; show them left→right chronologically.
    meetings = (json.items || [])
      .map(it => ({ ...it, data: it.data || {}, draft: {}, dirty: new Set() }))
      .sort((a, b) => String(a.meetingDate).localeCompare(String(b.meetingDate)));

    buildRows();
    meetings.forEach(resetDraft);
    renderMatrix();
    updateRangeLabel(json.total || 0);
  } catch {
    wrap.innerHTML = '<div class="matrix-empty">載入例會失敗</div>';
    document.getElementById('pagerLabel').textContent = '';
  }
}

/** (Re)seed a meeting's editable draft from its saved agenda data. */
function resetDraft(m) {
  m.dirty.clear();
  rows.filter(r => r.type === 'role')
      .forEach(r => { m.draft[roleId(r.role)] = roleGet(m.data, r.role); });
  META_FIELDS.forEach(f => { m.draft[f.key] = roleGet(m.data, f); });
}

function updateRangeLabel(total) {
  const label = document.getElementById('pagerLabel');
  if (!total) { label.textContent = '此範圍內沒有例會'; return; }
  label.textContent = total > meetings.length
    ? `顯示最近 ${meetings.length} 場（範圍內共 ${total} 場，請縮小日期範圍）`
    : `顯示 ${meetings.length} 場`;
}

// ================================================================
// MATRIX BUILD / RENDER
// ================================================================
function buildRows() {
  // Show as many speech / evaluator slots as the busiest loaded meeting needs.
  const maxSpeech = Math.max(3, ...meetings.map(m => (m.data.speeches   || []).length));
  const maxEval   = Math.max(3, ...meetings.map(m => (m.data.evaluators || []).length));

  rows     = [];
  roleById = {};

  const pushRole = role => {
    roleById[roleId(role)] = role;
    rows.push({ type: 'role', role });
  };

  // Resolvable by the save path, but intentionally absent from `rows`.
  META_FIELDS.forEach(f => { roleById[f.key] = f; });

  ROLE_GROUPS.forEach(group => {
    rows.push({ type: 'group', label: group.label });
    (group.roles || []).forEach(pushRole);

    if (group.dynamic === 'speech') {
      for (let i = 0; i < maxSpeech; i++) {
        pushRole({ key: `speech${i + 1}`, kind: 'speech', idx: i,
                   label: `指定演講者 #${i + 1}`, en: `Speaker #${i + 1}` });
      }
    }
    if (group.dynamic === 'evaluator') {
      for (let i = 0; i < maxEval; i++) {
        pushRole({ key: `evaluator${i + 1}`, kind: 'evaluator', idx: i,
                   label: `個別講評員 #${i + 1}`, en: `Evaluator #${i + 1}` });
      }
    }
    (group.tail || []).forEach(pushRole);
  });
}

/**
 * '' when the role is a real slot on that meeting, otherwise why it is not —
 * the matrix shows more speech/evaluator rows than some meetings actually have,
 * and filling one of those *adds* a slot to that agenda when saved.
 */
function slotNote(m, role) {
  if (role.kind === 'variety' && !m.data.varietySession?.enabled) {
    return '此場未啟用多元單元';
  }
  if (role.kind === 'speech' && role.idx >= (m.data.speeches || []).length) {
    return '此場原本沒有這個演講名額，填入並儲存後會為該議程新增一篇演講';
  }
  if (role.kind === 'evaluator' && role.idx >= (m.data.evaluators || []).length) {
    return '此場原本沒有這個講評名額，填入並儲存後會為該議程新增一位講評員';
  }
  return '';
}

function fmtDate(iso) {
  if (!iso) return '未設定日期';
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d)) return iso;
  const wd = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()} (${wd})`;
}

function renderMatrix() {
  const wrap = document.getElementById('matrixWrap');
  if (!meetings.length) {
    wrap.innerHTML = '<div class="matrix-empty">這個分會還沒有議程。請先到「新建議程」建立例會，再回來安排角色。</div>';
    updateSaveBar();
    return;
  }

  const readOnly = !canWrite();

  const head = meetings.map(m => `
    <th class="rm-meeting" data-mid="${m.id}">
      <div class="rm-m-date">${esc(fmtDate(m.meetingDate))}<span class="rm-dot" id="dot_${m.id}"></span></div>
      <div class="rm-m-no">${m.meetingNo ? `第 ${esc(m.meetingNo)} 次` : '—'}</div>
      ${META_FIELDS.map(f => `
        <input type="text" class="rm-m-meta" id="cell_${m.id}_${f.key}"
               value="${esc(m.draft[f.key] ?? '')}" data-mid="${m.id}" data-rid="${f.key}"
               placeholder="${esc(f.placeholder)}" ${readOnly ? 'disabled' : ''}
               title="${esc(f.label)}（可編輯）" oninput="onCellInput(this)">`).join('')}
      <div class="rm-m-foot">
        <span class="rm-m-fill" id="fill_${m.id}"></span>
        <a class="rm-m-link" href="/index?id=${m.id}" title="開啟此場議程">議程 ↗</a>
      </div>
    </th>`).join('');

  const body = rows.map(r => {
    if (r.type === 'group') {
      return `<tr class="rm-group-row">
        <th class="rm-role rm-group">${esc(r.label)}</th>
        <td class="rm-group-fill" colspan="${meetings.length}"></td>
      </tr>`;
    }
    const rid = roleId(r.role);
    const cells = meetings.map(m => {
      const v      = m.draft[rid] ?? '';
      const acLang = m.data.lang === 'zh' ? 'zh' : 'en';

      const note = slotNote(m, r.role);

      return `<td class="rm-cell${note ? ' rm-inactive' : ''}">
        <input type="text" class="member-ac rm-input" id="cell_${m.id}_${rid}"
               value="${esc(v)}" data-ac-lang="${acLang}" data-mid="${m.id}" data-rid="${rid}"
               placeholder="${note ? '＋' : '—'}" ${readOnly ? 'disabled' : ''}
               data-base-title="${esc(note)}"
               oninput="onCellInput(this)">
      </td>`;
    }).join('');
    return `<tr>
      <th class="rm-role" title="${esc(r.role.en || '')}">
        <span class="rm-role-zh">${esc(r.role.label)}</span>
        <span class="rm-role-en">${esc(r.role.en || '')}</span>
      </th>${cells}
    </tr>`;
  }).join('');

  wrap.innerHTML = `
    <table class="role-matrix">
      <thead><tr><th class="rm-corner">角色 / 例會</th>${head}</tr></thead>
      <tbody>${body}</tbody>
    </table>`;

  refreshDecorations();
  updateSaveBar();
}

/** Called on every keystroke — must never rebuild the table (would drop focus). */
function onCellInput(el) {
  const m = meetings.find(x => String(x.id) === el.dataset.mid);
  if (!m) return;
  const rid = el.dataset.rid;
  m.draft[rid] = el.value;
  if (el.value === (roleGet(m.data, roleById[rid]) || '')) m.dirty.delete(rid);
  else m.dirty.add(rid);
  refreshDecorations();
  updateSaveBar();
}

const norm = s => String(s || '').trim().toLowerCase();

/**
 * Decorations only (no DOM rebuild): the unsaved highlight per cell, plus the
 * per-column dirty dot and assignment count.
 *
 * One person holding several roles in a meeting is deliberately *not* flagged —
 * it is normal practice, so highlighting it would only add noise.
 */
function refreshDecorations() {
  const roleRows = rows.filter(r => r.type === 'role');

  meetings.forEach(m => {
    // Slots this meeting does not have only count once someone is put in them.
    let filled = 0, slots = 0;
    roleRows.forEach(r => {
      const rid = roleId(r.role);
      const el  = document.getElementById(`cell_${m.id}_${rid}`);
      if (!el) return;
      if (norm(m.draft[rid])) filled++;
      if (norm(m.draft[rid]) || !slotNote(m, r.role)) slots++;
      el.classList.toggle('rm-edited', m.dirty.has(rid));
      el.title = el.dataset.baseTitle || '';
    });

    // Header fields: edited highlight only — they take no part in the tally.
    META_FIELDS.forEach(f => {
      const el = document.getElementById(`cell_${m.id}_${f.key}`);
      if (el) el.classList.toggle('rm-edited', m.dirty.has(f.key));
    });

    const dot = document.getElementById(`dot_${m.id}`);
    if (dot) dot.classList.toggle('visible', m.dirty.size > 0);

    const fill = document.getElementById(`fill_${m.id}`);
    if (fill) {
      fill.textContent = `${filled}/${slots}`;
      fill.title       = '已指派 / 總角色數';
    }
  });
}

// ================================================================
// SAVE
// ================================================================
const dirtyMeetings = () => meetings.filter(m => m.dirty.size > 0);

function updateSaveBar() {
  const dirty = dirtyMeetings();
  const n     = dirty.reduce((s, m) => s + m.dirty.size, 0);
  const btn   = document.getElementById('btnSaveAll');
  const label = document.getElementById('saveState');
  if (btn) btn.disabled = n === 0;
  if (label) {
    label.textContent = n === 0 ? '已同步' : `${n} 項未儲存（${dirty.length} 場）`;
    label.className   = 'save-state' + (n === 0 ? '' : ' unsaved');
  }
}

async function saveAll() {
  const dirty = dirtyMeetings();
  if (!dirty.length) return;
  const btn = document.getElementById('btnSaveAll');
  btn.disabled = true;
  btn.textContent = '儲存中…';

  let ok = 0;
  const failed = [];
  for (const m of dirty) {
    try {
      // Re-read so a concurrent edit in the agenda editor is not overwritten:
      // only the fields touched here are replaced.
      const res = await fetch(`${API_BASE}/api/agendas/${m.id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error();
      const fresh = await res.json();
      delete fresh._clubId;              // editor-only hint, must not be persisted

      m.dirty.forEach(rid => roleSet(fresh, roleById[rid], m.draft[rid]));

      const put = await fetch(`${API_BASE}/api/agendas/${m.id}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body:    JSON.stringify({ data: fresh, club_id: m.clubId }),
      });
      if (!put.ok) throw new Error();

      m.data = fresh;
      // Keep the list-level mirrors in step with what the API would now return.
      m.meetingTheme = fresh.meetingTheme || '';
      m.dirty.clear();
      ok++;
    } catch {
      failed.push(fmtDate(m.meetingDate));
    }
  }

  btn.textContent = '儲存變更';
  refreshDecorations();
  updateSaveBar();
  if (failed.length) toast(`${ok} 場已儲存，${failed.length} 場失敗：${failed.join('、')}`, true);
  else toast(`已儲存 ${ok} 場例會的角色安排`);
}

function discardChanges() {
  if (!dirtyMeetings().length) return;
  if (!confirm('確定要捨棄所有未儲存的變更嗎？')) return;
  meetings.forEach(resetDraft);
  renderMatrix();
}

// ================================================================
// MISC
// ================================================================
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

let toastTimer = null;
function toast(msg, isError = false) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = 'toast visible' + (isError ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, 3200);
}

function toggleSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  const tab      = document.getElementById('sidebarToggleTab');
  const open = sidebar.classList.toggle('sidebar-open');
  backdrop.classList.toggle('visible', open);
  tab.classList.toggle('open', open);
}

function doLogout() {
  if (!confirm('確定要登出嗎？')) return;
  clearAuth(); location.href = '/login';
}

applyRoleUI();   // run immediately to avoid a flash of admin-only controls
document.addEventListener('DOMContentLoaded', init);
