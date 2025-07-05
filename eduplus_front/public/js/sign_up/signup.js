// 페이지 로드 시 이벤트 리스너 설정
document.addEventListener('DOMContentLoaded', function() {
  // 비밀번호 입력 필드에 이벤트 리스너 추가
  const passwordInput = document.getElementById('password');
  const checkPasswordInput = document.getElementById('checkPassword');
  const usernameInput = document.getElementById('username');
  
  passwordInput.addEventListener('input', validatePasswordInput);
  checkPasswordInput.addEventListener('input', validatePasswordInput);
  usernameInput.addEventListener('input', validateUsernameInput);
});

// 사용자 이름 입력 제한 함수
function validateUsernameInput(event) {
  const input = event.target;
  const errorMessage = document.getElementById('errorMessage');
  
  // @ 기호 체크
  if (input.value.includes('@')) {
    // @ 기호가 있으면 제거
    input.value = input.value.replace(/@/g, '');
    errorMessage.textContent = '사용자 이름에는 @ 기호를 사용할 수 없습니다';
    errorMessage.style.display = 'block';
  } else {
    errorMessage.style.display = 'none';
  }
}

// 비밀번호 입력 제한 함수
function validatePasswordInput(event) {
  const input = event.target;
  const errorMessage = document.getElementById('errorMessage');
  
  // 대문자를 소문자로 자동 변환
  let value = input.value.toLowerCase();
  
  // 허용되지 않는 문자 체크 (영어, 숫자, _, ! 이외의 문자)
  const invalidChars = value.match(/[^a-z0-9_!]/g);
  
  if (invalidChars) {
    // 허용되지 않는 문자가 있으면 제거
    value = value.replace(/[^a-z0-9_!]/g, '');
    errorMessage.textContent = '비밀번호는 영어, 숫자, _, ! 문자만 사용할 수 있습니다';
    errorMessage.style.display = 'block';
  } else {
    errorMessage.style.display = 'none';
  }
  
  // 새 값으로 설정
  input.value = value;
}

function validateForm() {
  const username = document.getElementById('username').value;
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const checkPassword = document.getElementById('checkPassword').value;
  const errorMessage = document.getElementById('errorMessage');

  // 이메일 형식 검사 - @ 기호가 정확히 1개 있어야 함
  const emailRegex = /^[^@]+@[^@]+$/;
  
  // 사용자 이름에 @ 기호가 있는지 확인
  if (username.includes('@')) {
    errorMessage.textContent = '사용자 이름에는 @ 기호를 사용할 수 없습니다';
    errorMessage.style.display = 'block';
    return;
  }
  
  if (!username || !email || !password || !checkPassword) {
    errorMessage.textContent = '모든 필드를 입력해주세요 (Please fill in all fields)';
    errorMessage.style.display = 'block';
  } else if (!emailRegex.test(email)) {
    errorMessage.textContent = '이메일 형식이 올바르지 않습니다';
    errorMessage.style.display = 'block';
  } else if (password !== checkPassword) {
    errorMessage.textContent = '비밀번호가 일치하지 않습니다 (Password and confirm password do not match)';
    errorMessage.style.display = 'block';
  } else {
    errorMessage.style.display = 'none';
    // 회원가입 서버 요청 보내기
    registerUser(email, username, password);
  }
}

// 서버에 회원가입 요청 보내기
function registerUser(email, username, password) {
  // 서버 설정에서 회원가입 URL 가져오기
  const signupUrl = SERVER_CONFIG.getApiUrl('SIGNUP');
  
  // 회원가입 요청
  fetch(signupUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: email,
      name: username,
      id: username,
      password: password
    })
  })
  .then(response => {
    if (response.ok) {
      return response.json();
    }
    throw new Error('회원가입 실패');
  })
  .then(data => {
    console.log('회원가입 성공:', data);
    
    // 회원가입 성공 알림 표시
    alert('회원가입이 성공적으로 완료되었습니다! 로그인 페이지로 이동합니다.');
    
    // 로그인 페이지로 리다이렉트
    window.location.href = '/login';
  })
  .catch(error => {
    console.error('에러:', error);
    document.getElementById('errorMessage').textContent = '회원가입 처리 중 오류가 발생했습니다';
    document.getElementById('errorMessage').style.display = 'block';
  });
}