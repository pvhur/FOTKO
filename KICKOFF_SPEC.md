# Kickoff — 프로젝트 스펙 정리

> 작성: 2026-05-29 | 브랜치: fix-main → origin/main | 배포: Vercel (서버리스)

---

## 1. 프로젝트 개요

**Kickoff**는 한국어 축구 뉴스 · 이적 정보 웹사이트입니다.  
관리자가 어드민 페이지에서 콘텐츠를 입력하면, 방문자는 홈 · 리그 · 이적 · 피드 페이지에서 소비합니다.

---

## 2. 기술 스택

| 항목 | 내용 |
|---|---|
| 서버 | Node.js + Express v5 (ES 모듈) |
| 배포 | Vercel (Serverless Functions) |
| DB | Neon PostgreSQL — `@neondatabase/serverless` HTTP 드라이버 (TCP 불가) |
| 세션 | 커스텀 `PgSessionStore` (`config/database.js`) |
| 정적 파일 | `/public/css/kickoff.css`, `/public/js/kickoff-nav.js` |
| 폰트 | Google Fonts — Inter |
| 팀 로고 | `https://media.api-sports.io/football/teams/{id}.png` (인증 불요) |
| 리그 로고 | `https://media.api-sports.io/football/leagues/{id}.png` |

---

## 3. DB 테이블

```sql
-- 사용자
users (id TEXT PK, username TEXT, email TEXT, password_hash TEXT, role TEXT, created_at TEXT)

-- 콘텐츠 (단일 JSON 행)
content (key TEXT PK, data JSONB, updated_at TIMESTAMPTZ)

-- 세션
sessions (sid TEXT PK, sess JSONB, expire TIMESTAMPTZ)

-- 게시물 (커뮤니티 피드)
posts (
  id TEXT PK, title TEXT, content TEXT,
  category TEXT DEFAULT '이적',
  image_url TEXT, author TEXT, likes INTEGER DEFAULT 0,
  created_at TEXT
)
```

`content` 테이블의 key = `'football'`, data 구조는 아래 섹션 참고.

---

## 4. 콘텐츠 JSON 구조 (`/api/data`)

```jsonc
{
  "breaking":  [ "속보 문구1", "속보 문구2" ],
  "featured":  { "category", "label", "tag", "imgDate", "title", "desc", "author", "time" },
  "scores":    [ { "home", "away", "score", "status", "live" } ],
  "popular":   [ { "title", "meta" } ],
  "news":      [ { "category", "badge", "time", "title", "desc", "source", "content" } ],
  "standings": { "pl": [...], "laliga": [...], "bundesliga": [...], "seriea": [...] },
  "fixtures":  [ { "league", "home", "away", "date" } ],
  "transfers": [
    {
      "player", "from", "to",
      "fee",    // 이적료 (예: "80M €" / "미공개")
      "date",   // 날짜 문자열
      "type",   // 이적 유형 (예: "여름 이적")
      "source", // 출처 (예: "Fabrizio Romano")
      "badge",  // "official" | "rumor" | "done"
      "detail"  // 세부 설명 (메인 본문으로 크게 표시)
    }
  ],
  "articles":  [
    {
      "title", "category", "source", "time",
      "desc",    // 요약 (카드에 표시)
      "content", // 본문 전문 (모달에서 표시)
      "badge"    // 항상 "transfer" (자동 설정)
    }
  ]
}
```

---

## 5. 페이지 목록

| URL | 파일 | 설명 |
|---|---|---|
| `/kickoff` | `views/health/index.html` | 홈 (히어로, 속보, 최신 뉴스, 스코어) |
| `/kickoff/league` | `views/health/league.html` | 리그 순위표 |
| `/kickoff/results` | `views/health/results.html` | 경기 결과 |
| `/kickoff/transfers` | `views/health/transfers.html` | 이적 시장 (메인) |
| `/kickoff/analysis` | `views/health/analysis.html` | 분석 |
| `/kickoff/feed` | `views/health/feed.html` | 커뮤니티 피드 (X 스타일) |
| `/kickoff/write` | `views/health/write.html` | 글쓰기 (WYSIWYG 에디터) |
| `/kickoff/admin` | `views/health/admin.html` | 관리자 패널 |
| `/kickoff/login` | `views/health/login.html` | 로그인 |

---

## 6. 이적 페이지 (`transfers.html`) 상세

### 레이아웃
```
┌─ 240px 팀 사이드바 ─┬─────── 메인 영역 ───────────┐
│  5대리그 팀 목록     │  필터 바 (전체/공식/루머/완료) │
│  (클릭 → 팀 필터)   │  이적 카드 그리드 (3열)        │
│                      │  관련 기사 그리드 (3열)        │
└─────────────────────┴────────────────────────────────┘
```

### 이적 카드 구조
- **상단**: 뱃지 (공식/루머/완료) + 날짜
- **선수명**: 크고 굵게 (22px 800wt)
- **클럽 행**: 이전 클럽 → 이적 클럽 (박스 안)
- **이적료**: 작은 인라인 뱃지 (`tc-fee-chip`)
- **세부설명**: 메인 본문처럼 크게 (`tc-detail`, 14px 1.7lh)
- **푸터**: 이적 유형 / 날짜

### 팀 사이드바
- 5대리그 96팀 로고 + 이름
- 리그별 아코디언 (클릭해서 펼침)
- 팀 클릭 → 이적 + 관련 기사 동시 필터링
- 팀 키워드 매칭: `from`, `to`, `title`, `desc`, `content` 전문 검색

### 관련 기사
- `_data.articles` (관련기사 섹션 작성분) + `_data.news` (badge=transfer) 합산 표시
- 카드 클릭 → 모달 팝업 (기사 본문 전문)
- 팀 필터 시 제목+요약+본문 내 팀명 검색

---

## 7. 어드민 패널 (`admin.html`) 상세

### 인증
- admin 계정만 접근 가능 (editor는 홈으로 리다이렉트)
- 기본 계정: `admin` / `kickoff2026`

### 섹션 목록
| 섹션 | 기능 |
|---|---|
| 대시보드 | 전체 현황 카드 + 최신 뉴스 |
| 속보 티커 | 상단 스크롤 배너 문구 |
| 메인 기사 | 히어로 섹션 주요 기사 (실시간 미리보기) |
| 경기 결과 | 스코어보드 데이터 |
| 인기 뉴스 | "많이 본 기사" 목록 |
| 최신 뉴스 | 뉴스 그리드 데이터 |
| 순위표 | 4개 리그 순위 (탭 전환) |
| 경기 일정 | 예정 경기 |
| 이적 시장 | 이적 아코디언 카드 |
| **관련 기사** | 이적 페이지 뉴스 기사 작성 |
| 사용자 관리 | 계정 역할 변경 / 삭제 |

### 이적 입력 카드 (아코디언)
- **헤더** (항상 표시): 뱃지 + 선수명 + 이전팀 → 이적팀 + 이적료
- **바디** (펼치면 표시):
  - Row 1: 선수명 / 이전팀 (팀피커) / 이적팀 (팀피커)
  - Row 2: 이적료 / 날짜 / 유형 / 출처 / 상태 select
  - Row 3: 세부사항 textarea (큰 본문으로 표시됨)

### 팀 피커 (이전팀/이적팀)
- 텍스트 입력 + "팀 선택 ▾" 버튼
- 클릭 시 드롭다운: 5대리그 탭 + 팀 버튼 그리드 (로고 포함)
- 팀 버튼 클릭 → 입력란 자동 완성
- 빅5 미포함 팀은 직접 텍스트 입력 가능

### 관련 기사 입력
- **제목** → 카드 미리보기 실시간 업데이트
- **카테고리** (기본: "이적 뉴스")
- **출처** + **시간** (나란히)
- **요약** (카드에 표시되는 한 줄 설명)
- **본문 전문** (클릭 시 모달에서 표시, 단락은 빈 줄로 구분)

---

## 8. 커뮤니티 피드 (`feed.html`)

- X/Twitter 스타일 타임라인
- `GET /api/posts` — 최신 100개 조회
- `POST /api/posts` — 에디터 이상 작성 가능
- `POST /api/posts/:id/like` — 누구나 좋아요 (localStorage 중복 방지)
- `DELETE /api/posts/:id` — 어드민만 삭제
- 카테고리 탭 필터 (이적/분석/결과/대표팀)
- 사이드바: 인기글 (좋아요순) + 카테고리 통계

---

## 9. 글쓰기 에디터 (`write.html`)

- FM2024 전술자료실 스타일 WYSIWYG
- `document.execCommand()` 기반 contentEditable
- **툴바 기능**:
  - 서식: H1~H3, 본문, 단락
  - 글꼴 크기 (8~72px), 행간
  - B / U / I / S (볼드/언더/이탤릭/취소선)
  - 글자색 32종 + 배경색 24종
  - 위첨자/아래첨자/코드
  - 정렬 (좌/중/우/양쪽)
  - 목록 (순서있음/없음), 들여쓰기
  - 인용구, 링크, HTML 직접 편집, HR, 이미지 삽입, 이모지
- **폴딩 섹션**:
  - 사진·파일 첨부 (기본 열림)
  - 게시 설정 (기본 닫힘)
- 임시저장: Ctrl+S → localStorage

---

## 10. API 엔드포인트

```
GET  /api/data                → 전체 콘텐츠 JSON 반환
POST /api/data                → 콘텐츠 저장 (editor 이상)

GET  /api/auth/me             → 현재 로그인 사용자
POST /api/auth/login          → 로그인
POST /api/auth/logout         → 로그아웃
POST /api/auth/signup         → 회원가입

GET  /api/posts               → 게시물 목록 (최신 100개)
POST /api/posts               → 게시물 작성 (editor 이상)
POST /api/posts/:id/like      → 좋아요
DELETE /api/posts/:id         → 게시물 삭제 (admin만)

GET  /api/users               → 사용자 목록 (admin만)
PATCH /api/users/:id          → 역할 변경 (admin만)
DELETE /api/users/:id         → 계정 삭제 (admin만)
```

---

## 11. 미들웨어

```js
requireEditor  // role === 'editor' || 'admin'
requireAdmin   // role === 'admin'
```

세션 쿠키 기반. `PgSessionStore`가 sessions 테이블에 저장.

---

## 12. 향후 추가 가능한 기능

- [ ] 이적 카드 팀 클릭 시 해당 팀 전용 페이지
- [ ] 관련 기사 이미지 썸네일 지원
- [ ] 피드 댓글 기능
- [ ] 실시간 이적 알림 (WebSocket / SSE)
- [ ] 이적료 단위 자동 포맷 (€ → 유로, M → 백만)
- [ ] 관리자 이적 데이터 CSV 일괄 import
