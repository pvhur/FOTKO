fetch('http://127.0.0.1:80/auth/get_session', { credentials: 'include' })
  .then(res => res.json())
  .then(data => {
    if (!data.isLoggedIn) {
      window.location.href = '/';
    }
  });