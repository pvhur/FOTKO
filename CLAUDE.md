# FOTKO / Kickoff — 축구 뉴스·이적시장 웹앱

> 프로젝트 기능 기록 (Claude Code 작업 정리)
> 저장소: `https://github.com/pvhur/FOTKO` · 배포 브랜치: `production` · 배포: Vercel (`https://fotko.vercel.app`)

---

## 1. 기술 스택

| 구분 | 내용 |
|------|------|
| 서버 | Node.js + Express (`front_server.js` 단일 파일) |
| DB | Neon PostgreSQL (`@neondatabase/serverless` HTTP 드라이버) |
| 세션 | PostgreSQL 커스텀 세션 스토어 (`config/database.js`) |
| 인증 | 아이디/이메일 + bcrypt 로그인 (구글 로그인 제거됨) |
| 보안 | Helmet CSP, Rate Limiting, CORS, httpOnly 쿠키 |
| 배포 | Vercel (`VERCEL=1`이면 listen 안 함, module.exports) |
| 프론트 | 정적 HTML (`views/health/*.html`) + 공용 CSS (`public/css/kickoff.css`) |

### 디렉터리
```
front_server.js          메인 서버 (라우트 전체)
config/database.js       DB 연결 / 스키마 초기화 / 세션 스토어
data/football.json       샘플 데이터 (실제 데이터는 DB content 테이블)
views/health/            페이지: index, league, results, transfers, transfer-news,
                         analysis, login, signup, admin
public/css/kickoff.css   공용 스타일
public/js/kickoff-nav.js 네비게이션 (로그인 상태 표시)
```

---

## 2. 페이지 구성

| 경로 | 내용 |
|------|------|
| `/kickoff` | 홈 — Kickoff 히어로 헤더(로고+그라디언트 타이틀) → 인기뉴스 목록 → 오늘의 축구 뉴스 → 최신 이적 소식 → 뉴스레터 CTA |
| `/kickoff/transfers` | **이적 시장** (메인 기능) — 버닝 히어로 + 5대리그 팀 사이드바 + 게시판 목록 + 관련 뉴스 |
| `/kickoff/league` | 리그 — **업데이트 중** 화면 |
| `/kickoff/results` | 경기 결과 — **업데이트 중** 화면 |
| `/kickoff/analysis` | 분석 — **업데이트 중** 화면 |
| `/kickoff/login`, `/signup` | 로그인 / 회원가입 |
| `/kickoff/admin` | 관리자 페이지 (admin 권한만) |

> nav의 "이적 시장" 탭에는 🔥 표시. 이적시장 외 탭은 모두 "업데이트 중" 안내.

---

## 3. 홈 (`index.html`)

- 상단 **히어로 헤더**: Kickoff 로고 SVG(글로우) + 그라디언트 타이틀 "Kickoff" + 서브텍스트 (이적시장 버닝 히어로와 동일 구조, 블루 톤)
- **인기뉴스** 섹션: `popular` 데이터를 카드 그리드로, 클릭 시 전문 모달
- **오늘의 축구 뉴스**: `news` 데이터 카드, 클릭 시 전문 모달
- **최신 이적 소식**: `transfers` 카드, 클릭 시 상세 모달
- 기사 전문 모달 공통 (ESC/배경 클릭 닫기)
- 리그 순위/예정 경기 섹션은 제거됨

---

## 4. 이적 시장 (`transfers.html`) — 핵심 페이지

### 버닝 히어로
- 방사형 불빛 그라디언트 배경 + 떠오르는 불꽃 파티클 애니메이션
- 그라디언트 타이틀 "이적시장 버닝 🔥"
- 실시간 통계 칩: 총 이적 건 / 공식 발표 / 루머 / 완료 / 관련 기사
- 상태 필터 칩: 전체 / 공식 발표 / 루머 / 완료

### 게시판 목록
- 카드 그리드가 아닌 **커뮤니티 게시판 행** 스타일
- 각 행: 상태 배지 / 선수명·이적방향 / 이적료 / 유형 / 날짜
- 행 클릭 시 **상세 인라인 펼치기** (이전→이적 클럽, 이적료/유형, 세부사항)

### 5대리그 팀 사이드바 (좌측 sticky)
- 프리미어리그 / 라리가 / 분데스리가 / 세리에A / 리그1 — **96팀**
- 팀 로고(api-football CDN: `media.api-sports.io/football/teams/{id}.png`, 실패 시 이니셜)
- 리그별 접기/펼치기, **기본 전부 축소**
- 팀별 ⭐ **팔로우** 버튼 → 로그인 계정에 서버 저장
- 상단 "내 관심팀" 영역, 비로그인 시 로그인 유도

### 관련 뉴스
- `transferNews` 전용 데이터 (없으면 `news`의 transfer 배지로 폴백)
- 3열 카드, 클릭 시 전문 모달

---

## 5. 인증 & 사용자

- **구글 로그인 제거** (OAuth 라우트, 버튼 전부 삭제)
- **하드코딩 admin 계정 제거** — 대신 **최초 가입자가 자동으로 admin** 권한 (이후는 editor)
- 역할: `admin` / `editor`
- 회원가입 시 editor(또는 첫 가입자는 admin)
- 비밀번호 bcrypt, 세션 PostgreSQL 저장

---

## 6. 관리자 페이지 (`admin.html`)

좌측 메뉴 섹션별 편집:
- 속보 티커 / 메인 기사 / 경기 결과 / **인기 뉴스**(전문 입력 가능) / 최신 뉴스(전문 입력 가능)
- 순위표 / 경기 일정 / **이적 시장** / **이적 관련뉴스**(전문 입력 가능)
- 사용자 관리 (admin 전용)

### 이적 시장 편집 — 빅5 팀 피커
- From/To 입력에 **팀 선택 드롭다운** (이전 버전 복원)
- 리그 탭(PL/La Liga/BL/Serie A/Ligue 1) + 팀 로고 그리드에서 선택
- 직접 타이핑도 가능
- 드롭다운이 패널에서 잘리지 않도록 `#sec-transfers` overflow:visible 처리

---

## 7. 카카오톡 알림 (관심팀 이적 소식)

### 흐름
1. 이적시장 사이드바에서 **팀 팔로우** (⭐)
2. **"카카오 연결하기"** → 카카오 OAuth (`scope=talk_message`)
3. 어드민이 **새 이적 소식 저장** → 알림 켠 사용자에게 **카카오톡 "나에게 보내기"** 발송

### 서버 (front_server.js)
| 라우트 | 설명 |
|--------|------|
| `GET /api/auth/kakao` | 카카오 동의 화면으로 (로그인 필요) |
| `GET /api/auth/kakao/callback` | 토큰 교환·저장 (client_secret 지원) |
| `GET /api/auth/kakao/reset` | 연결 해제(unlink) 후 재동의 — talk_message 재동의용 |
| `GET /api/notify/kakao` | 연결 여부(linked)/알림(notify) 조회 |
| `POST /api/notify/kakao` | 알림 on/off 토글 |
| `GET /api/notify/test` | **진단용** — 본인에게 테스트 메모 발송, 카카오 응답 그대로 반환 |
| `GET/PUT/DELETE /api/follows[/:teamId]` | 팀 팔로우 CRUD |

### DB 컬럼 (users)
`kakao_id`, `kakao_notify`, `kakao_access_token`, `kakao_refresh_token`, `kakao_token_expires`

### follows 테이블
`user_id`, `team_id`, `team_name`, `league_id`, `created_at`

### 발송 로직
- `/api/data` 저장 시 이전 transfers와 비교해 **새 이적건 감지** → 발송
- ⚠️ **서버리스(Vercel)에서는 응답 전에 await 필수** (응답 후 비동기 작업은 함수 종료로 실행 안 됨)
- 토큰 만료 5분 전 자동 refresh (client_secret 포함)

### 필요 환경변수 (Vercel)
```
KAKAO_REST_API_KEY     카카오 앱 REST API 키
KAKAO_CLIENT_SECRET    카카오 로그인 > 보안 > Client Secret (사용함)
KAKAO_REDIRECT_URI     https://fotko.vercel.app/api/auth/kakao/callback
```

### 카카오 콘솔 설정 (필수)
- 카카오 로그인 **활성화 ON**
- **Redirect URI** 등록: `https://fotko.vercel.app/api/auth/kakao/callback`
- 동의항목 **talk_message(카카오톡 메시지 전송) = 선택 동의**
- 보안 **Client Secret = 사용함** (KOE010 방지)

### 트러블슈팅 기록
- **KOE006** = Redirect URI 미등록/불일치 → 콘솔에 정확히 등록
- **KOE010** = Bad client credentials → Client Secret 누락/불일치 (환경변수 등록)
- **insufficient scopes / allowed_scopes:[]** = 동의 화면에서 **"카카오톡 메시지 전송" 체크 안 함**
  → `/api/auth/kakao/reset`으로 unlink 후 재동의 시 **반드시 체크**
- 카카오는 이미 연결된 계정엔 추가 동의를 다시 안 물음 → unlink 필요

---

## 8. 알려진 한계 / 향후 작업

- **팀 매칭**: 현재 새 이적 소식은 알림 켠 사용자 **전원**에게 발송. "팔로우한 팀의 이적만" 보내려면 이적 데이터의 팀명(한글)과 팔로우 팀(영문 id) 매핑 필요
- 카카오 "나에게 보내기"는 **본인에게만** 발송 (채널/알림톡은 사업자 필요)
- 진단용 `/api/notify/test`는 운영 안정화 후 제거 권장
- Vercel 자동 배포가 느릴 때가 있어 수동 Redeploy 필요할 수 있음

---

## 9. 로컬 개발

```bash
npm install
# .env 에 POSTGRES_URL / DATABASE_URL, SESSION_SECRET, KAKAO_* 설정
node front_server.js   # http://localhost:3000
```
