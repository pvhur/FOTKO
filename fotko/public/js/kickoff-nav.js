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
      <button class="nav-logout-btn" onclick="kickoffLogout()">로그아웃</button>`;

    // 구독하기 버튼 앞에 삽입
    const subBtn = parent.querySelector('a[href="#"]');
    parent.insertBefore(wrap, subBtn || null);
  } catch (_) { /* 네트워크 오류: 무시 */ }
})();

async function kickoffLogout() {
  try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); } catch (_) {}
  window.location.href = '/kickoff';
}
