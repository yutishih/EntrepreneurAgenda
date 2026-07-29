'use client';

import { useEffect } from 'react';
import { apiJson } from '@/lib/api';
import { setAuth, clearAuth, applyRoleUI } from '@/lib/auth';
import { AGENDA_TEMPLATES, TEMPLATE_OPTIONS, templateAssetDefaults } from '@/lib/agendaTemplates';
import Sidebar from '@/components/Sidebar';
import './club.css';

let clubs = [];
let members = [];
let editingId = null;
let sortKey = null;
let sortDir = 'asc';
// Branding image URLs for the club currently open in the modal.
// logo/fb/line are top-level club columns; ig_qr/page2_hero live in settings.
let modalImgUrls = {};
// Files chosen in the modal but not yet uploaded — uploaded to R2 on save so a
// brand-new club's images land under media/clubs/{newId}/ (and nothing is
// uploaded if the user cancels).
let pendingFiles = {};

// Populate the template <select> from lib/agendaTemplates once on load.
function populateTemplateOptions() {
  const sel = document.getElementById('fTemplate');
  sel.innerHTML = TEMPLATE_OPTIONS
    .map((o) => `<option value="${o.key}">${o.label}</option>`)
    .join('');
}

async function checkClubAuth() {
  try {
    const data = await apiJson('/auth/verify');
    setAuth(data.username, data.role, data.club_id, data.must_change_pw);
    if (data.must_change_pw) { location.href = '/change-password'; return false; }
    document.getElementById('navUser').textContent = data.username;
    document.getElementById('userAvatar').textContent = data.username.slice(0, 1).toUpperCase();
    applyRoleUI();
    return true;
  } catch {
    clearAuth();
    location.href = '/login';
    return false;
  }
}

async function fetchClubs() {
  document.getElementById('clubTableBody').innerHTML =
    '<tr><td colspan="3"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>';
  try {
    clubs = await apiJson('/clubs');
    updateStats();
    renderList();
  } catch {
    document.getElementById('clubTableBody').innerHTML =
      '<tr><td colspan="3"><div class="table-empty">載入失敗</div></td></tr>';
  }
}

async function fetchMembers() {
  try {
    members = await apiJson('/users');
    updateStats();
    renderList();
  } catch { /* ignore */ }
}

function countMembers(clubId) {
  return members.filter((m) => m.clubId === clubId).length;
}

function updateStats() {
  document.getElementById('statTotal').textContent = clubs.length;
  const assigned = members.filter((m) => m.clubId !== null && m.clubId !== undefined).length;
  document.getElementById('statAssigned').textContent = assigned;
}

function sortBy(key) {
  sortDir = (sortKey === key && sortDir === 'asc') ? 'desc' : 'asc';
  sortKey = key;
  document.querySelectorAll('th.sortable').forEach((th) => {
    th.classList.remove('sort-asc', 'sort-desc');
    const ic = th.querySelector('.sort-icon');
    if (ic) ic.textContent = '↕';
  });
  const active = document.querySelector(`th[data-key="${key}"]`);
  if (active) {
    active.classList.add(sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
    const ic = active.querySelector('.sort-icon');
    if (ic) ic.textContent = sortDir === 'asc' ? '↑' : '↓';
  }
  renderList();
}

function renderList() {
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  let filtered = q ? clubs.filter((c) => c.name.toLowerCase().includes(q)) : clubs;

  if (sortKey) {
    filtered = [...filtered].sort((a, b) => {
      if (sortKey === 'count') {
        const diff = countMembers(a.id) - countMembers(b.id);
        return sortDir === 'asc' ? diff : -diff;
      }
      const av = (a[sortKey] ?? '').toString().toLowerCase();
      const bv = (b[sortKey] ?? '').toString().toLowerCase();
      const cmp = av.localeCompare(bv, 'zh-TW');
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }

  document.getElementById('badgeCount').textContent = `${filtered.length} 個`;

  const tbody = document.getElementById('clubTableBody');
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="3"><div class="table-empty">沒有符合的分會</div></td></tr>';
    return;
  }
  tbody.innerHTML = filtered.map((c) => {
    const count = countMembers(c.id);
    return `
    <tr>
      <td class="td-club-name">${c.name}</td>
      <td><span class="td-member-count">${count} 位</span></td>
      <td class="td-actions">
        <button class="btn-edit-row system-admin-only" onclick="window.__clubOpenModal(${c.id})" style="display:none">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          編輯
        </button>
        <button class="btn-edit-row system-admin-only" onclick="window.__clubOpenModal(${c.id}, 'template')" style="display:none">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
          版型
        </button>
        <button class="btn-del-row system-admin-only" onclick="window.__clubDelete(${c.id})" title="刪除" style="display:none">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
        </button>
      </td>
    </tr>`;
  }).join('');
  // rows are created after the initial applyRoleUI(); re-apply so the
  // system-admin-only edit/delete buttons become visible for admins.
  applyRoleUI();
}

function setPreview(imgId, url) {
  const el = document.getElementById(imgId);
  if (!el) return;
  el.src = url || '';
  el.style.visibility = url ? 'visible' : 'hidden';
}

// group: 'basic' (編輯 — name/branding/images) or 'template' (版型 — template-
// specific + page-2 promo). Both views populate and save the full record, so
// toggling visibility never drops the fields the other view manages.
function openModal(id = null, group = 'basic') {
  editingId = id;
  const c = id ? clubs.find((c) => c.id === id) : null;
  const isTpl = group === 'template';
  document.getElementById('modalTitle').textContent =
    isTpl ? '版型設定' : (id ? '編輯分會' : '新增分會');
  document.getElementById('modalGroupBasic').style.display = isTpl ? 'none' : '';
  document.getElementById('modalGroupTemplate').style.display = isTpl ? '' : 'none';

  const tk = (c && c.template_key) || 'compact';
  // Universal fields (shared by every template).
  document.getElementById('fName').value = c ? (c.name || '') : '';
  document.getElementById('fNameZh').value = c ? (c.name_zh || '') : '';
  document.getElementById('fNameEn').value = c ? (c.name_en || '') : '';
  document.getElementById('fFee').value = c ? (c.fee || '') : '';
  document.getElementById('fTemplate').value = tk;
  // Template-specific fields: generate from the manifest, then fill values.
  renderTemplateFields(tk);
  populateTemplateFields(c, tk);

  document.getElementById('modal').classList.add('open');
  if (!isTpl) document.getElementById('fName').focus();
}

// ---- Template-specific field generation (driven by template.settings) ----
// A field is declared once in lib/agendaTemplates.js; here we build its DOM,
// fill its value, and (in buildClubPayload) read it back. Generated id
// conventions: text/textarea → f_<key>   image → prev_<key> / stat_<key>
function escAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '&#10;');
}
function fieldHtml(f) {
  const ph = f.placeholder ? ` placeholder="${escAttr(f.placeholder)}"` : '';
  if (f.type === 'image') {
    return `<div class="modal-field">
      <label>${f.label}</label>
      <div class="img-up-row">
        <img id="prev_${f.key}" class="img-up-preview" alt="">
        <div class="img-up-controls">
          <input type="file" accept="image/*" onchange="window.__clubUploadImage(this, '${f.key}')">
          <div class="img-up-status" id="stat_${f.key}"></div>
        </div>
      </div>
    </div>`;
  }
  if (f.type === 'textarea') {
    return `<div class="modal-field"><label>${f.label}</label><textarea rows="3" id="f_${f.key}"${ph}></textarea></div>`;
  }
  return `<div class="modal-field"><label>${f.label}</label><input type="text" id="f_${f.key}"${ph}></div>`;
}
// Emit fields in order; insert a section label when it changes; group fields
// sharing the same `row` (within one section) into a 2-column grid.
function buildFieldsHtml(fields) {
  let html = '', lastSection = null;
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (f.section && f.section !== lastSection) {
      html += `<div class="modal-section-label">${f.section}</div>`;
      lastSection = f.section;
    }
    if (f.row) {
      const grp = [f];
      while (i + 1 < fields.length && fields[i + 1].row === f.row && fields[i + 1].section === f.section) {
        grp.push(fields[++i]);
      }
      html += `<div class="modal-grid2">${grp.map(fieldHtml).join('')}</div>`;
    } else {
      html += fieldHtml(f);
    }
  }
  return html;
}
function renderTemplateFields(tk) {
  const fields = (AGENDA_TEMPLATES[tk] || {}).settings || [];
  document.getElementById('tmplFieldsBasic').innerHTML =
    buildFieldsHtml(fields.filter((f) => f.group === 'basic'));
  document.getElementById('tmplFieldsTemplate').innerHTML =
    buildFieldsHtml(fields.filter((f) => f.group !== 'basic'));
}
// Fill generated inputs/previews from the club record (blank for a new club).
function populateTemplateFields(c, tk) {
  const set = (c && c.settings) || {};
  const fields = (AGENDA_TEMPLATES[tk] || {}).settings || [];
  const dflt = templateAssetDefaults(tk);
  modalImgUrls = {};
  fields.forEach((f) => {
    const stored = f.store === 'column' ? (c ? (c[f.key] ?? null) : null) : (set[f.key] ?? null);
    if (f.type === 'image') {
      modalImgUrls[f.key] = stored || null;
      setPreview(`prev_${f.key}`, modalImgUrls[f.key] || dflt[f.key] || null);
    } else {
      const el = document.getElementById(`f_${f.key}`);
      if (el) el.value = stored || '';
    }
  });
  document.querySelectorAll('#modal input[type=file]').forEach((el) => { el.value = ''; });
  pendingFiles = {};
}
// Re-render fields when the template select changes (keeps saved values).
function onTemplateChange() {
  const tk = document.getElementById('fTemplate').value || 'compact';
  const c = editingId ? clubs.find((x) => x.id === editingId) : null;
  renderTemplateFields(tk);
  populateTemplateFields(c, tk);
}

// Stage a chosen image locally (preview only). Actual R2 upload happens in
// saveClub(), once the club id is known, so files are filed under the club.
function uploadClubImage(input, field) {
  const file = input.files[0];
  if (!file) return;
  pendingFiles[field] = file;
  setPreview(`prev_${field}`, URL.createObjectURL(file)); // local preview
  const st = document.getElementById(`stat_${field}`);
  if (st) st.textContent = '已選擇，儲存時上傳';
}

// Upload one staged file to R2 under the given club, return its public URL.
async function uploadStagedImage(file, clubId) {
  const { uploadUrl, publicUrl } = await apiJson('/upload/presign', {
    method: 'POST',
    body: { filename: file.name, content_type: file.type, club_id: clubId },
  });
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT', headers: { 'Content-Type': file.type }, body: file,
  });
  if (!uploadRes.ok) throw new Error('上傳至雲端失敗');
  return publicUrl;
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
  editingId = null;
}

// Build the club payload from the form + current modalImgUrls. The backend
// PUT is a full replace, so we start from the existing record and override
// only the fields the active template manages (per its manifest); columns/
// settings other templates own are preserved.
function buildClubPayload() {
  const nn = (id) => { const el = document.getElementById(id); const v = el ? el.value.trim() : ''; return v || null; };
  const c = editingId ? clubs.find((x) => x.id === editingId) : null;
  const tk = document.getElementById('fTemplate').value || 'compact';
  const fields = (AGENDA_TEMPLATES[tk] || {}).settings || [];
  const payload = {
    name: document.getElementById('fName').value.trim(),
    name_zh: nn('fNameZh'),
    name_en: nn('fNameEn'),
    fee: nn('fFee'),
    template_key: tk,
    charter_no: c ? (c.charter_no ?? null) : null,
    founded_date: c ? (c.founded_date ?? null) : null,
    logo_url: c ? (c.logo_url ?? null) : null,
    fb_qr_url: c ? (c.fb_qr_url ?? null) : null,
    line_qr_url: c ? (c.line_qr_url ?? null) : null,
    settings: { ...((c && c.settings) || {}) },
  };
  fields.forEach((f) => {
    let val;
    if (f.type === 'image') {
      val = modalImgUrls[f.key] ?? null;
    } else {
      const el = document.getElementById(`f_${f.key}`);
      const v = el ? el.value.trim() : '';
      val = v || null;
    }
    if (f.store === 'column') payload[f.key] = val;
    else payload.settings[f.key] = val;
  });
  return payload;
}

async function apiSaveClub(method, id, payload) {
  return apiJson(id ? `/clubs/${id}` : '/clubs', { method, body: payload });
}

async function saveClub() {
  if (!document.getElementById('fName').value.trim()) { alert('請填入分會名稱'); return; }
  const saveBtn = document.querySelector('.btn-modal-save');
  saveBtn.disabled = true;
  try {
    let id = editingId;
    const staged = Object.entries(pendingFiles);
    // New club: create first (without the staged images) to obtain its id.
    if (!id) id = (await apiSaveClub('POST', null, buildClubPayload())).id;
    // Upload any staged files under media/clubs/{id}/, fill their URLs.
    for (const [field, file] of staged) {
      modalImgUrls[field] = await uploadStagedImage(file, id);
    }
    // Persist the final record (existing club, or new club that had images).
    if (editingId || staged.length) await apiSaveClub('PUT', id, buildClubPayload());
    closeModal();
    await fetchClubs();
  } catch (e) {
    alert(e.message);
  } finally {
    saveBtn.disabled = false;
  }
}

async function deleteClub(id) {
  const club = clubs.find((c) => c.id === id);
  const memberCount = countMembers(id);
  const msg = memberCount > 0
    ? `「${club.name}」有 ${memberCount} 位會員，刪除後會員的分會欄位將清空。確定刪除？`
    : `確定要刪除「${club.name}」嗎？`;
  if (!confirm(msg)) return;
  try {
    await apiJson(`/clubs/${id}`, { method: 'DELETE' });
    await Promise.all([fetchClubs(), fetchMembers()]);
  } catch {
    alert('刪除失敗');
  }
}

export default function ClubPage() {
  useEffect(() => {
    window.__clubOpenModal = openModal;
    window.__clubDelete = deleteClub;
    window.__clubUploadImage = uploadClubImage;

    // Intentionally no backdrop-click-to-close: editing has many fields, and
    // an accidental outside click would discard everything. Close only via
    // the ✕ / 取消 buttons (matches the legacy club.html behavior).

    applyRoleUI();
    populateTemplateOptions();

    (async function init() {
      applyRoleUI();
      const ok = await checkClubAuth();
      if (!ok) return;
      await Promise.all([fetchClubs(), fetchMembers()]);
    })();

    return () => {
      delete window.__clubOpenModal;
      delete window.__clubDelete;
      delete window.__clubUploadImage;
    };
  }, []);

  return (
    <>
      <Sidebar active="club" />

      <div className="main-area">
        <header className="topbar">
          <div className="topbar-title">分會管理</div>
          <div className="topbar-actions">
            <button className="btn-primary system-admin-only" onClick={() => openModal()} style={{ display: 'none' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
              新增分會
            </button>
          </div>
        </header>

        <div className="content">
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-icon blue">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              </div>
              <div className="stat-body">
                <div className="stat-value" id="statTotal">—</div>
                <div className="stat-label">分會總數</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon green">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <div className="stat-body">
                <div className="stat-value" id="statAssigned">—</div>
                <div className="stat-label">已分配會員數</div>
              </div>
            </div>
          </div>

          <div className="table-card">
            <div className="table-header">
              <div className="table-header-left">
                <span className="table-title">分會名單</span>
                <span className="badge-count" id="badgeCount">0 個</span>
              </div>
            </div>

            <div className="search-wrap">
              <input type="text" className="search-input" id="searchInput" placeholder="搜尋分會名稱…" onInput={renderList} />
            </div>

            <div className="club-table-wrap">
              <table className="club-list">
                <thead>
                  <tr>
                    <th className="sortable" data-key="name" onClick={() => sortBy('name')}>分會名稱 <i className="sort-icon">↕</i></th>
                    <th className="sortable" data-key="count" onClick={() => sortBy('count')}>會員人數 <i className="sort-icon">↕</i></th>
                    <th style={{ textAlign: 'right' }}>操作</th>
                  </tr>
                </thead>
                <tbody id="clubTableBody">
                  <tr><td colSpan="3"><div className="loading-spinner"><div className="spinner"></div></div></td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="modal-overlay" id="modal">
        <div className="modal modal-wide">
          <div className="modal-header">
            <h3 id="modalTitle">新增分會</h3>
            <button className="modal-close" onClick={closeModal}>✕</button>
          </div>

          <div className="modal-body">
            <div id="modalGroupBasic" className="modal-group">
              <div className="modal-field">
                <label>分會名稱（選單顯示用）</label>
                <input type="text" id="fName" placeholder="例：企業家" />
              </div>

              <div className="modal-field">
                <label>議程版型 Template</label>
                <select id="fTemplate" onChange={onTemplateChange}></select>
              </div>

              <div className="modal-section-label">議程表頭品牌（留空則沿用預設）</div>
              <div className="modal-grid2">
                <div className="modal-field">
                  <label>中文全名</label>
                  <input type="text" id="fNameZh" placeholder="企業家國際演講會" />
                </div>
                <div className="modal-field">
                  <label>英文名</label>
                  <input type="text" id="fNameEn" placeholder="Entrepreneur Toastmasters Club" />
                </div>
                <div className="modal-field">
                  <label>會費</label>
                  <input type="text" id="fFee" placeholder="NTD150" />
                </div>
              </div>

              {/* 版型專屬欄位（依 template manifest 動態產生：編輯區，如 Chill Hi High 的 Logo） */}
              <div id="tmplFieldsBasic"></div>
            </div>

            <div id="modalGroupTemplate" className="modal-group">
              {/* 版型專屬欄位（依 template manifest 動態產生：版型區） */}
              <div id="tmplFieldsTemplate"></div>
            </div>
          </div>

          <div className="modal-actions">
            <button className="btn-modal-cancel" onClick={closeModal}>取消</button>
            <button className="btn-modal-save" onClick={saveClub}>儲存</button>
          </div>
        </div>
      </div>
    </>
  );
}
