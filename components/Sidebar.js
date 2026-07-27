'use client';

import { logout } from '@/lib/auth';
import './sidebar.css';

const NAV_ITEMS = [
  {
    key: 'home', href: '/home', label: '總覽', systemAdminOnly: false,
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  },
  {
    key: 'index', href: '/index', label: '新建議程', systemAdminOnly: false,
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>,
  },
  {
    key: 'roles', href: '/roles', label: '角色安排', systemAdminOnly: false,
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="9" y1="10" x2="9" y2="20"/></svg>,
  },
  {
    key: 'member', href: '/member', label: '會員管理', systemAdminOnly: false,
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  },
  {
    key: 'club', href: '/club', label: '分會管理', systemAdminOnly: true,
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  },
];

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  const tab = document.getElementById('sidebarToggleTab');
  const open = sidebar.classList.toggle('sidebar-open');
  backdrop.classList.toggle('visible', open);
  tab.classList.toggle('open', open);
}

// `active`: one of NAV_ITEMS[].key — which nav item to highlight.
// `navOverrides`: optional { [key]: () => void } — when a nav item's key has
// an override, clicking it runs the handler instead of a plain navigation
// (used by /home to carry the selected club through to "新建議程").
export default function Sidebar({ active, navOverrides = {} }) {
  return (
    <>
      <div className="sidebar-backdrop" id="sidebarBackdrop" onClick={toggleSidebar}></div>
      <div className="sidebar-toggle-tab" id="sidebarToggleTab" onClick={toggleSidebar}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
      <aside className="sidebar" id="sidebar">
        <div className="sidebar-brand">
          <img src="/media/toastmasters_logo.png" className="sidebar-brand-logo" alt="TM Logo" />
          <div className="sidebar-brand-text">
            <div className="sidebar-brand-name">分會管理平台</div>
            <div className="sidebar-brand-sub">Club Management</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">主選單</div>
          {NAV_ITEMS.map((item) => (
            <a
              key={item.key}
              className={`nav-item ${item.key === active ? 'active' : ''} ${item.systemAdminOnly ? 'system-admin-only' : ''}`}
              href={item.href}
              onClick={navOverrides[item.key] ? (e) => { e.preventDefault(); navOverrides[item.key](); } : undefined}
              style={item.systemAdminOnly ? { display: 'none' } : undefined}
            >
              {item.icon}
              <span>{item.label}</span>
            </a>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-avatar" id="userAvatar">—</div>
            <div className="user-info">
              <div className="user-name" id="navUser">—</div>
              <div className="user-role">成員</div>
            </div>
            <button className="btn-logout-sidebar" onClick={logout} title="登出">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
