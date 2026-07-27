'use client';

import { useEffect } from 'react';
import { apiJson } from '@/lib/api';
import { setAuth, clearAuth, applyRoleUI, isSystemAdmin } from '@/lib/auth';
import Sidebar from '@/components/Sidebar';
import './admin.css';

let users = [];
let clubs = [];
let editingUsername = null;
let sortKey = null;
let sortDir = 'asc';
let filterStatus = 'active'; // 'active' | 'pending'

const ROLE_LABEL = { system_admin: '系統管理員', club_admin: '分會管理員', club_member: '一般會員' };

async function checkAdminAuth() {
  try {
    const data = await apiJson('/auth/verify');
    setAuth(data.username, data.role, data.club_id, data.must_change_pw);
    if (data.must_change_pw) { location.href = '/change-password'; return false; }
    document.getElementById('navUser').textContent = data.username;
    document.getElementById('userAvatar').textContent = data.username.slice(0, 1).toUpperCase();
    applyRoleUI();
    if (!isSystemAdmin()) { location.href = '/home'; return false; }
    return true;
  } catch {
    clearAuth();
    location.href = '/login';
    return false;
  }
}

async function fetchClubs() {
  try {
    clubs = await apiJson('/clubs');
    const sel = document.getElementById('fClubId');
    sel.innerHTML = '<option value="">— 未分配 —</option>' +
      clubs.map((c) => `<option value="${c.id}">${c.name}</option>`).join('');
  } catch { /* ignore */ }
}

async function fetchUsers() {
  document.getElementById('userTableBody').innerHTML =
    '<tr><td colspan="4"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>';
  try {
    users = await apiJson('/users');
    updateStats();
    renderList();
  } catch {
    document.getElementById('userTableBody').innerHTML =
      '<tr><td colspan="4"><div class="table-empty">載入失敗</div></td></tr>';
  }
}

function setFilter(status) {
  filterStatus = status;
  document.getElementById('filterActive').classList.toggle('active', status === 'active');
  document.getElementById('filterPending').classList.toggle('active', status === 'pending');
  document.getElementById('searchInput').value = '';
  renderList();
}

function updateStats() {
  const activeUsers = users.filter((u) => (u.status || 'active') === 'active');
  const pendingUsers = users.filter((u) => u.status === 'pending');
  document.getElementById('statTotal').textContent = activeUsers.length;
  document.getElementById('statAdmins').textContent =
    activeUsers.filter((u) => u.role === 'system_admin' || u.role === 'club_admin').length;
  document.getElementById('statMembers').textContent =
    activeUsers.filter((u) => u.role === 'club_member').length;

  const badge = document.getElementById('pendingBadge');
  if (badge) {
    badge.textContent = pendingUsers.length;
    badge.className = 'pending-badge' + (pendingUsers.length === 0 ? ' zero' : '');
  }
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

  let filtered = users.filter((u) => (u.status || 'active') === filterStatus);

  if (q) {
    filtered = filtered.filter((u) =>
      u.username.toLowerCase().includes(q) ||
      (u.nameEn || '').toLowerCase().includes(q) ||
      (u.nameZh || '').toLowerCase().includes(q));
  }

  if (sortKey) {
    filtered = [...filtered].sort((a, b) => {
      const av = (a[sortKey] ?? '').toString().toLowerCase();
      const bv = (b[sortKey] ?? '').toString().toLowerCase();
      const cmp = av.localeCompare(bv, 'zh-TW');
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }

  document.getElementById('badgeCount').textContent = `${filtered.length} 位`;
  const tbody = document.getElementById('userTableBody');
  if (!filtered.length) {
    const emptyMsg = filterStatus === 'pending' ? '目前沒有待審核的申請' : '沒有符合的用戶';
    tbody.innerHTML = `<tr><td colspan="4"><div class="table-empty">${emptyMsg}</div></td></tr>`;
    return;
  }
  tbody.innerHTML = filtered.map((u) => {
    const isAdmin = u.username === 'admin';
    const isPending = filterStatus === 'pending';
    const actions = isPending
      ? `<button class="btn-approve-row" onclick="window.__adminApprove('${u.username}')">批准</button>
         <button class="btn-del-row" onclick="window.__adminDelete('${u.username}')" title="拒絕並刪除">
           <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
         </button>`
      : `<button class="btn-edit-row" onclick="window.__adminOpenModal('${u.username}')">
           <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
           編輯
         </button>
         <button class="btn-del-row" onclick="window.__adminDelete('${u.username}')" title="刪除" ${isAdmin ? 'disabled' : ''}>
           <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
         </button>`;
    return `
    <tr>
      <td>
        <div class="td-user">
          <div class="ua-avatar">${u.username.slice(0, 1).toUpperCase()}</div>
          <div>
            <div class="ua-username">${u.username}</div>
            <div class="ua-name">${u.nameZh || ''} ${u.nameEn ? '/ ' + u.nameEn : ''}</div>
            <div class="ua-level">${isPending ? (u.clubName || '未指定分會') : '等級：' + (u.level || 'TM')}</div>
          </div>
        </div>
      </td>
      <td><span class="role-badge ${u.role}">${ROLE_LABEL[u.role] || u.role}</span></td>
      <td style="font-size:12px;color:${u.clubName ? '#0f172a' : '#94a3b8'}">${u.clubName || '—'}</td>
      <td class="td-actions">${actions}</td>
    </tr>`;
  }).join('');
}

async function approveUser(username) {
  try {
    await apiJson(`/users/${username}/approve`, { method: 'PUT' });
    await fetchUsers();
  } catch (e) { alert(e.message); }
}

function openAddModal() {
  editingUsername = null;
  document.getElementById('modalTitle').textContent = '新增用戶';
  document.getElementById('addFields').style.display = '';
  document.getElementById('editInfo').style.display = 'none';
  document.getElementById('fUsername').value = '';
  document.getElementById('fPassword').value = '';
  document.getElementById('fNameZh').value = '';
  document.getElementById('fNameEn').value = '';
  document.getElementById('fLevel').value = 'TM';
  document.getElementById('fRole').value = 'club_member';
  document.getElementById('fRole').disabled = false;
  document.getElementById('fClubId').value = '';
  document.getElementById('modal').classList.add('open');
  document.getElementById('fUsername').focus();
}

function openModal(username) {
  const u = users.find((u) => u.username === username);
  editingUsername = username;
  document.getElementById('modalTitle').textContent = '編輯用戶';
  document.getElementById('addFields').style.display = 'none';
  document.getElementById('editInfo').style.display = '';
  document.getElementById('mUsername').textContent = u.username;
  document.getElementById('mUserFullname').textContent = [u.nameZh, u.nameEn].filter(Boolean).join(' / ');
  document.getElementById('fNameZh').value = u.nameZh || '';
  document.getElementById('fNameEn').value = u.nameEn || '';
  document.getElementById('fLevel').value = u.level || 'TM';
  document.getElementById('fRole').value = u.role;
  document.getElementById('fClubId').value = u.clubId ?? '';
  document.getElementById('fRole').disabled = username === 'admin';
  document.getElementById('modal').classList.add('open');
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
  editingUsername = null;
}

async function saveUser() {
  const role = document.getElementById('fRole').value;
  const clubVal = document.getElementById('fClubId').value;
  const name_zh = document.getElementById('fNameZh').value.trim();
  const name_en = document.getElementById('fNameEn').value.trim();
  const level = document.getElementById('fLevel').value.trim() || 'TM';
  const club_id = clubVal ? parseInt(clubVal) : null;

  try {
    if (!editingUsername) {
      const username = document.getElementById('fUsername').value.trim();
      const password = document.getElementById('fPassword').value;
      if (!username) { alert('請輸入帳號'); return; }
      if (!password) { alert('請輸入密碼'); return; }
      if (!name_zh || !name_en) { alert('請輸入中英文姓名'); return; }
      await apiJson('/users', { method: 'POST', body: { username, password, name_zh, name_en, role, club_id, level } });
    } else {
      await apiJson(`/users/${editingUsername}`, { method: 'PUT', body: { role, club_id, name_zh, name_en, level } });
    }
    closeModal();
    await fetchUsers();
  } catch (e) { alert(e.message); }
}

async function deleteUser(username) {
  if (username === 'admin') return;
  if (!confirm(`確定要刪除用戶「${username}」嗎？`)) return;
  try {
    await apiJson(`/users/${username}`, { method: 'DELETE' });
    await fetchUsers();
  } catch (e) { alert(e.message); }
}

export default function AdminPage() {
  useEffect(() => {
    window.__adminApprove = approveUser;
    window.__adminDelete = deleteUser;
    window.__adminOpenModal = openModal;

    const modalOutsideClick = (e) => {
      const modal = document.getElementById('modal');
      if (e.target === modal) closeModal();
    };
    document.getElementById('modal').addEventListener('click', modalOutsideClick);

    applyRoleUI();

    (async function init() {
      applyRoleUI();
      const ok = await checkAdminAuth();
      if (!ok) return;
      await Promise.all([fetchClubs(), fetchUsers()]);
    })();

    return () => {
      document.getElementById('modal')?.removeEventListener('click', modalOutsideClick);
      delete window.__adminApprove;
      delete window.__adminDelete;
      delete window.__adminOpenModal;
    };
  }, []);

  return (
    <>
      <Sidebar active="admin" />

      <div className="main-area">
        <header className="topbar">
          <div className="topbar-title">用戶管理</div>
          <div>
            <button className="btn-primary" onClick={openAddModal}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
              新增用戶
            </button>
          </div>
        </header>

        <div className="content">
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-icon blue">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </div>
              <div className="stat-body">
                <div className="stat-value" id="statTotal">—</div>
                <div className="stat-label">用戶總數</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon red">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/><path d="M16 11l1.5 1.5L21 9"/></svg>
              </div>
              <div className="stat-body">
                <div className="stat-value" id="statAdmins">—</div>
                <div className="stat-label">管理員數</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon green">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
              </div>
              <div className="stat-body">
                <div className="stat-value" id="statMembers">—</div>
                <div className="stat-label">一般用戶數</div>
              </div>
            </div>
          </div>

          <div className="table-card">
            <div className="table-header">
              <div className="table-header-left">
                <span className="table-title">用戶名單</span>
                <span className="badge-count" id="badgeCount">0 位</span>
              </div>
            </div>

            <div className="filter-tabs">
              <button className="filter-tab active" id="filterActive" onClick={() => setFilter('active')}>正式用戶</button>
              <button className="filter-tab" id="filterPending" onClick={() => setFilter('pending')}>
                待審核申請 <span className="pending-badge zero" id="pendingBadge">0</span>
              </button>
            </div>

            <div className="search-wrap">
              <input type="text" className="search-input" id="searchInput" placeholder="搜尋帳號或姓名…" onInput={renderList} />
            </div>
            <div className="user-table-wrap">
              <table className="user-list">
                <thead>
                  <tr>
                    <th className="sortable" data-key="username" onClick={() => sortBy('username')}>用戶 <i className="sort-icon">↕</i></th>
                    <th className="sortable" data-key="role" onClick={() => sortBy('role')}>角色 <i className="sort-icon">↕</i></th>
                    <th className="sortable" data-key="clubName" onClick={() => sortBy('clubName')}>所屬分會 <i className="sort-icon">↕</i></th>
                    <th style={{ textAlign: 'right' }}>操作</th>
                  </tr>
                </thead>
                <tbody id="userTableBody">
                  <tr><td colSpan="4"><div className="loading-spinner"><div className="spinner"></div></div></td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="modal-overlay" id="modal">
        <div className="modal">
          <div className="modal-header">
            <h3 id="modalTitle">新增用戶</h3>
            <button className="modal-close" onClick={closeModal}>✕</button>
          </div>

          <div id="addFields">
            <div className="modal-field">
              <label>帳號（至少 3 字元）</label>
              <input type="text" id="fUsername" placeholder="john_wang" autoComplete="off" />
            </div>
            <div className="modal-field">
              <label>密碼（至少 6 字元）</label>
              <input type="password" id="fPassword" placeholder="請輸入初始密碼" autoComplete="new-password" />
            </div>
          </div>

          <div id="editInfo" style={{ display: 'none' }} className="modal-user-info">
            <div className="modal-user-info-name" id="mUsername"></div>
            <div className="modal-user-info-sub" id="mUserFullname"></div>
          </div>

          <div className="modal-field">
            <label>中文姓名</label>
            <input type="text" id="fNameZh" placeholder="王小明" />
          </div>
          <div className="modal-field">
            <label>英文姓名</label>
            <input type="text" id="fNameEn" placeholder="John Wang" />
          </div>
          <div className="modal-field">
            <label>等級</label>
            <input type="text" id="fLevel" placeholder="TM / L1 / L2 / L3 / L4 / L5 / DTM" />
          </div>
          <div className="modal-field">
            <label>角色</label>
            <select id="fRole">
              <option value="club_member">club_member — 一般會員（唯讀）</option>
              <option value="club_admin">club_admin — 分會管理員（可編輯本分會）</option>
              <option value="system_admin">system_admin — 系統管理員（全權限）</option>
            </select>
          </div>
          <div className="modal-field">
            <label>所屬分會</label>
            <select id="fClubId">
              <option value="">— 未分配 —</option>
            </select>
          </div>
          <div className="modal-actions">
            <button className="btn-modal-cancel" onClick={closeModal}>取消</button>
            <button className="btn-modal-save" onClick={saveUser}>儲存</button>
          </div>
        </div>
      </div>
    </>
  );
}
