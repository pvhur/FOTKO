function validateLogin() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const errorMessage = document.getElementById('errorMessage');

  if (!username || !password) {
    errorMessage.textContent = '아이디와 비밀번호를 모두 입력해주세요';
    errorMessage.style.display = 'block';
  } else {
    errorMessage.style.display = 'none';
    // 로그인 요청 보내기
    loginUser(username, password);
  }
}

// 서버에 로그인 요청 보내기
function loginUser(username, password) {
  // 이메일인지 아이디인지 확인
  const isEmail = username.includes('@');
  
  // 요청 본문 객체 생성
  const requestBody = {
    password: password
  };
  
  // 이메일 또는 아이디 키 설정
  if (isEmail) {
    requestBody.email = username;
  } else {
    requestBody.id = username;
  }
  
  // 서버 설정에서 로그인 URL 가져오기
  const loginUrl = SERVER_CONFIG.getApiUrl('LOGIN');
  
  // 로그인 요청
  fetch(loginUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  })
  .then(response => {
    if (response.ok) {
      return response.json();
    }
    throw new Error('로그인 실패');
  })
  .then(data => {
    console.log('로그인 성공:', data);
    // 토큰을 로컬 스토리지에 저장
    if (data.token) {
      localStorage.setItem('loginToken', data.token);
    } else if (data.access_token) {
      localStorage.setItem('loginToken', data.access_token);
    }
    // 로그인 성공 시 메인 페이지로 리다이렉트
    window.location.href = '/';
  })
  .catch(error => {
    console.error('에러:', error);
    document.getElementById('errorMessage').textContent = '아이디 또는 비밀번호가 일치하지 않습니다';
    document.getElementById('errorMessage').style.display = 'block';
  });
} 