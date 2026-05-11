'use strict';

const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:8001' : '';

function getToken()    { return localStorage.getItem('auth_token'); }
function getUsername() { return localStorage.getItem('auth_username'); }

function setAuth(token, username) {
  localStorage.setItem('auth_token', token);
  localStorage.setItem('auth_username', username);
}

function clearAuth() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_username');
}
