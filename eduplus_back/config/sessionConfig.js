module.exports = {
    secret: "thisismysuperprecioussecretkeyfordkshisclub", // 비밀 키
    resave: true,  // 세션을 다시 저장할지 여부
    saveUninitialized: true,  // 초기화되지 않은 세션을 저장할지 여부
    cookie: {
      httpOnly: true, // JavaScript에서 쿠키 접근 불가 (XSS 방어)
      secure: true, //  HTTPS에서만 전송 (보안 강화)
      sameSite: 'none', // 크로스도메인 허용
      domain: '.dksh.site' // 모든 하위 도메인에서 쿠키 공유
    }
  };
  