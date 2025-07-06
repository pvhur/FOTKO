// 서버 연결 설정
const SERVER_CONFIG = {
  // 서버 기본 URL
  BASE_URL: 'http://localhost:80',
  
  // API 엔드포인트
  ENDPOINTS: {
    LOGIN: '/auth/login',
    SIGNUP: '/auth/signup',
    LOGOUT: '/auth/logout'
  },
  
  // 전체 URL 가져오기
  getApiUrl: function(endpoint) {
    return this.BASE_URL + this.ENDPOINTS[endpoint];
  }
};

// 다른 JavaScript 파일에서 사용할 수 있도록 전역으로 노출
window.SERVER_CONFIG = SERVER_CONFIG; 