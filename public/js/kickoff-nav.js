/**
 * kickoff-nav.js
 * 모든 Kickoff 페이지에 포함되는 네비게이션 인증 처리 스크립트.
 * 세션 확인 → 로그인 버튼을 유저 정보/관리자 링크로 교체.
 */
(async function initNav() {
  try {
    const r = await fetch('/api/auth/me', { credentials: 'include' });
    if (!r.ok) return; // 미로그인: 로그인 버튼 그대로 유지

    const user = await r.json();
    const btn  = document.getElementById('nav-login-btn');
    if (!btn) return;

    const parent = btn.parentElement;

    // 로그인 버튼 제거
    btn.remove();

    // 유저 정보 + (admin이면 관리자 링크) 삽입
    const wrap = document.createElement('div');
    wrap.className = 'nav-user-wrap';
    wrap.innerHTML = `
      ${user.role === 'admin'
        ? `<a href="/kickoff/admin" class="nav-admin-link">
             <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1" y="1" width="4.5" height="4.5" rx="1" stroke="currentColor" stroke-width="1.2"/><rect x="7.5" y="1" width="4.5" height="4.5" rx="1" stroke="currentColor" stroke-width="1.2"/><rect x="1" y="7.5" width="4.5" height="4.5" rx="1" stroke="currentColor" stroke-width="1.2"/><rect x="7.5" y="7.5" width="4.5" height="4.5" rx="1" stroke="currentColor" stroke-width="1.2"/></svg>
             관리자
           </a>`
        : ''}
      <div class="nav-user-pill">
        <div class="nav-user-avatar">${user.username[0].toUpperCase()}</div>
        <span class="nav-user-name">${user.username}</span>
        <span class="nav-user-role nav-user-role-${user.role}">${user.role === 'admin' ? '관리자' : '편집자'}</span>
      </div>
      <button class="nav-logout-btn">로그아웃</button>`;

    wrap.querySelector('.nav-logout-btn').addEventListener('click', kickoffLogout);

    // 구독하기 버튼 앞에 삽입
    const subBtn = parent.querySelector('a[href="#"]');
    parent.insertBefore(wrap, subBtn || null);
  } catch (_) { /* 네트워크 오류: 무시 */ }
})();

async function kickoffLogout() {
  try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); } catch (_) {}
  window.location.replace('/kickoff');
}

/* ── 좋아요(하트) 공통 모듈 ── */
window.Likes = (function () {
  let map = {};
  let liked = new Set();
  try { liked = new Set(JSON.parse(localStorage.getItem('kickoffLiked') || '[]')); } catch (_) {}

  async function load() {
    try { map = await fetch('/api/likes', { credentials: 'include' }).then(r => r.json()); }
    catch (_) { map = {}; }
  }
  function count(key) { return map[key] || 0; }
  function isLiked(key) { return liked.has(key); }
  function heartHTML(key) {
    const on = liked.has(key);
    const safe = key.replace(/"/g, '&quot;');
    return `<button class="heart-btn${on ? ' on' : ''}" data-key="${safe}" onclick="event.stopPropagation();Likes.toggle('${key.replace(/'/g, "\\'")}',this)" aria-label="좋아요">
      <svg viewBox="0 0 20 20" fill="${on ? 'currentColor' : 'none'}"><path d="M10 17s-6.5-4.3-6.5-9A3.5 3.5 0 0 1 10 5.5 3.5 3.5 0 0 1 16.5 8c0 4.7-6.5 9-6.5 9z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>
      <span class="heart-cnt">${count(key)}</span>
    </button>`;
  }
  async function toggle(key, btn) {
    const on = liked.has(key);
    const delta = on ? -1 : 1;
    if (on) liked.delete(key); else liked.add(key);
    try { localStorage.setItem('kickoffLiked', JSON.stringify([...liked])); } catch (_) {}
    map[key] = Math.max((map[key] || 0) + delta, 0);
    if (btn) {
      btn.classList.toggle('on', !on);
      const c = btn.querySelector('.heart-cnt'); if (c) c.textContent = map[key];
      const svg = btn.querySelector('svg'); if (svg) svg.setAttribute('fill', !on ? 'currentColor' : 'none');
    }
    try {
      const r = await fetch('/api/likes/' + encodeURIComponent(key), {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta }),
      });
      const d = await r.json();
      if (typeof d.count === 'number') { map[key] = d.count; if (btn) { const c = btn.querySelector('.heart-cnt'); if (c) c.textContent = d.count; } }
    } catch (_) {}
  }
  return { load, count, isLiked, heartHTML, toggle };
})();
