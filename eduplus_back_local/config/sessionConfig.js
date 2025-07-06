module.exports = {
    secret: "thisismysuperprecioussecretkeyfordkshisclub", // 비밀 키
    resave: true,  // 세션을 다시 저장할지 여부
    saveUninitialized: true,  // 초기화되지 않은 세션을 저장할지 여부
    cookie: {
      httpOnly: true, // JavaScript에서 쿠키 접근 불가 (XSS 방어)
      secure: false, // 개발환경에서는 false
      sameSite: 'lax' // 포트가 달라도 세션 공유를 위해 lax로 설정
    }
  };
  