# Kickoff — 축구 뉴스·이적시장 디자인 시스템

## Overview

Kickoff은 축구 뉴스와 이적 시장을 다루는 **다크 테마** 콘텐츠/커머스 하이브리드 웹앱이다. 비주얼 언어는 Linear 계열의 절제된 다크 인터페이스에서 출발한다 — 거의 검정에 가까운 캔버스({colors.canvas}) 위에 미세한 표면 단계(surface-1~4)와 헤어라인 보더로 위계를 만들고, 인디고-바이올렛 액센트({colors.primary})를 포인트로 쓴다. 색이 아니라 **타이포 위계와 여백**이 화면 대부분을 끌어간다.

시스템의 시그니처는 두 가지다. 첫째, **그라디언트 타이틀** — 히어로 헤더의 대형 제목은 흰색→연보라→인디고(홈) 또는 흰색→금색→주황(이적시장 "버닝")으로 흐르는 텍스트 그라디언트를 쓴다. 둘째, **pill 버튼 + 1px 헤어라인 카드** — 모든 인터랙티브 요소는 둥근 약버튼이고, 카드는 그림자 대신 `{colors.hairline}` 보더와 상단 미세 그라디언트 라인(`::before`)으로 떠 보이게 한다.

768px 이하에서 시스템은 깔끔하게 접힌다: 히어로가 쌓이고, nav 링크/검색은 숨고, 3열 그리드는 1열로, 이적시장의 좌측 sticky 사이드바는 본문 위로 올라온다.

**Key Characteristics:**
- 거의 검정 캔버스({colors.canvas}, `#010102`) 위 다층 surface + 헤어라인 보더로 만드는 무채색 위계
- 인디고-바이올렛 단일 액센트({colors.primary}, `#5e6ad2`) — 버튼·링크·활성 상태에만 절제해서 사용
- **Inter** 가변 폰트를 디스플레이/본문 공통으로, 음수 자간(`-0.05px ~ -1.5px`)으로 타이트하게
- pill 버튼({rounded.full})과 `{rounded.lg}`~`{rounded.xl}` 카드가 지배적 기하
- 그림자 대신 **헤어라인 보더 + 상단 그라디언트 라인(`::before`)** 으로 표현하는 평면 입체감
- 이적시장 "버닝" 히어로: 방사형 주황 글로우 + 불꽃 파티클 애니메이션 (한정적·시그니처)

---

## Colors

> 정의 위치: `public/css/kickoff.css` `:root`. 전 페이지(홈/이적시장/리그/어드민/로그인)에서 동일 토큰을 사용한다.

### Brand & Accent
- **Primary Indigo** ({colors.primary}, `#5e6ad2`): 주 버튼, 링크, 활성 탭, 포커스 링의 기준색.
- **Primary Hover** ({colors.primary-hover}, `#828fff`): 버튼 hover 및 밝은 액센트 텍스트(그라디언트 로고, 강조 라벨).
- **Primary Focus** ({colors.primary-focus}, `#5e69d1`): 입력 포커스 보더 + `0 0 0 2px rgba(94,106,210,.2)` 글로우.
- **Burn Orange** (`#f97316` / `#fb923c`): 이적시장 전용 — 버닝 히어로 글로우, 통계 칩, "진행 중" 배지, 카카오 외 강조. 시스템 토큰이 아니라 이적시장 surface 한정 액센트.

### Surface (다크 단계)
- **Canvas** ({colors.canvas}, `#010102`): 페이지 배경.
- **Surface 1** ({colors.surface-1}, `#0d0e11`): 기본 카드·패널 표면.
- **Surface 2** ({colors.surface-2}, `#16181d`): 패널 헤더, hover 표면, 입력 배경.
- **Surface 3** ({colors.surface-3}, `#1e2128`): 칩/뱃지 배경, 크레스트 플레이스홀더.
- **Surface 4** ({colors.surface-4}, `#252830`): 가장 밝은 표면(닫기 버튼 hover 등).
- **Hairline** ({colors.hairline}, `#23252a`): 1px 카드·입력 보더, 구분선.
- **Hairline Strong** ({colors.hairline-strong}, `#2e3039`): hover 시 강조 보더, 드롭다운 보더.

### Text (밝은 잉크)
- **Ink** ({colors.ink}, `#f7f8f8`): 주 제목·본문.
- **Ink Muted** ({colors.ink-muted}, `#d0d6e0`): 본문 보조, 모달 본문.
- **Ink Subtle** ({colors.ink-subtle}, `#8a8f98`): 섹션 보조 카피, 비활성 탭.
- **Ink Tertiary** ({colors.ink-tertiary}, `#62666d`): 캡션, 메타 정보, 푸터 약링크.
- **On Primary** ({colors.on-primary}, `#ffffff`): 인디고 버튼 위 텍스트.

### Semantic
- **Success** ({colors.success}, `#4ade80`): "완료", "재고 있음", 폼 W(승) 표시.
- **Danger** ({colors.danger}, `#f87171`): LIVE 도트, 검증 오류, 강등권 순위, 패(L) 표시.
- **Warn** ({colors.warn}, `#fbbf24`): 이적료 강조, "업데이트 중" 배지, 한정 프로모.

---

## Typography

### Font Family
**Inter** (Google Fonts, weight 400/500/600/700). Fallback: `-apple-system, system-ui, sans-serif`. 디스플레이와 본문을 한 패밀리로 통일하고, **음수 자간**으로 타이트하게 조인다. 큰 제목일수록 자간을 더 강하게 좁힌다(`-1.5px`까지).

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `{typography.hero-burn}` | clamp(40–80px) | 700 | 1.05 | -2px | 이적시장 버닝 타이틀(그라디언트 텍스트) |
| `{typography.home-hero}` | clamp(40–78px) | 700 | 1.05 | -2px | 홈 히어로 "Kickoff"(그라디언트 텍스트) |
| `{typography.t-display-lg}` | clamp(28–52px) | 700 | 1.1 | -1.5px | 대형 디스플레이 |
| `{typography.t-display-md}` | clamp(22–38px) | 600 | 1.15 | -0.9px | 섹션 오프너("오늘의 축구 뉴스", "최신 이적 소식") |
| `{typography.t-headline}` | clamp(18–24px) | 600 | 1.2 | -0.5px | 카드/모달 헤드라인, 관련 뉴스 |
| `{typography.subtitle-lg}` | 16px | 600 | 1.4 | 0 | 강조 카피, FAQ 질문 |
| `{typography.body-md}` | 15–16px | 400 | 1.6–1.85 | -0.05px | 본문, 모달 전문 |
| `{typography.body-sm}` | 13–14px | 400 | 1.5 | 0 | 보조 본문, 메타, 네비 링크 |
| `{typography.eyebrow}` | 12px | 500 | 1.4 | .5px (uppercase) | 섹션 라벨(앞에 16px 인디고 바) |
| `{typography.badge}` | 12px | 500 | 1.4 | 0 | 배지·칩 라벨 |
| `{typography.caption}` | 11px | 500 | 1.33 | .3–.5px (uppercase) | 캡션, 헤더 라벨, 푸터 |
| `{typography.btn}` | 13–14px | 500 | 1.2 | 0 | pill 버튼 라벨 |

### Principles
- 모든 본문 역할에 미세 음수 자간(`-0.05px`)을 깔아 Inter를 타이트하게 세팅한다.
- 히어로 타이틀은 **그라디언트 텍스트**(`-webkit-background-clip:text`)로만 색을 입힌다 — 홈은 인디고 톤, 이적시장은 주황 톤.
- eyebrow 라벨(`{typography.eyebrow}`)은 항상 앞에 `16px×2px` 인디고 바(`::before`)를 달고 대문자로 쓴다.
- 카드/패널 헤더 라벨은 `{typography.caption}`(11px·대문자·자간)으로 통일해 인터랙티브 영역과 시각적 결속을 만든다.

---

## Layout

### Spacing System
- **Base unit**: 4px. 주 스텝은 8px 단위.
- 핵심 값: `4 · 8 · 12 · 16 · 20 · 24 · 28 · 32 · 48 · 56 · 64`px.
- **섹션 리듬**: `.section { padding: 64px 0 }`, 연속 섹션은 `padding-top:0`로 붙임. 히어로 상하 패딩은 이적시장 `56px+`, 홈 히어로 `120px+130px`로 크게.
- **카드 내부 패딩**: 표준 16~24px, 게시판 행 `14px 20px`, 프로모/CTA 패널 `52px`.

### Grid & Container
- `.wrap { max-width: 1280px; margin: 0 auto; padding: 0 32px }` (모바일 16px).
- 이적시장: `tf-layout` = `260px(사이드바) + 1fr(메인)` grid, 사이드바 sticky.
- 뉴스/이적/인기뉴스 그리드: 3열(`repeat(3,1fr)`), 1024px에서 2열, 768px에서 1열.
- 게시판 행: `grid-template-columns: 80px 1fr 120px 90px 80px` (모바일 `72px 1fr 80px`).

### Whitespace Philosophy
여백은 콘텐츠-우선이다. 히어로는 그라디언트 타이틀과 통계 칩에 충분한 상하 여백을 주고, 본문 카드 그리드는 16px gap으로 촘촘히 정렬한다. 이적시장 게시판은 행 단위로 정보 밀도를 높이되, 클릭 시 인라인 펼치기로 상세를 분리한다.

---

## Elevation & Depth

시스템은 거의 평면이다. 그림자는 모달/sticky에만 제한적으로 쓰고, 입체감은 보더와 그라디언트 라인으로 만든다.

| Level | Treatment | Use |
|---|---|---|
| 0 (flat) | 그림자 없음; `{colors.hairline}` 1px 보더 + 상단 `::before` 그라디언트 라인 | 기본 카드, 패널, 뉴스 카드 |
| 1 (hover) | 보더가 `{colors.hairline-strong}`로, 배경이 한 단계 밝은 surface로 | 카드/행 hover |
| 2 (overlay) | `rgba(0,0,0,.75)` + `backdrop-filter: blur(6px)` 오버레이 | 기사 전문 모달 |
| 2 (dropdown) | `0 12px 40px rgba(0,0,0,.6)` | 어드민 팀 피커 드롭다운 |

### Decorative Depth
- **상단 그라디언트 라인**: 카드·패널·모달 상단에 `linear-gradient(90deg, transparent, rgba(255,255,255,.05~.07), transparent)` 1px 라인을 `::before`로 깔아 미세한 광택을 준다.
- **버닝 글로우**: 이적시장 히어로는 방사형 주황 그라디언트 3겹을 배경에 깔고, 떠오르는 불꽃 파티클(`spark-rise` keyframe)을 얹는다.
- **로고 글로우**: 홈 히어로 로고 SVG에 `drop-shadow(0 0 24px rgba(94,106,210,.5))`.

---

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `{rounded.xs}` | 4px | 미세 코너, 크레스트, 칩 내부 |
| `{rounded.sm}` | 6px | 작은 컨트롤, 팀 행 |
| `{rounded.md}` | 8px | 입력, 닫기 버튼, 아이콘 박스 |
| `{rounded.lg}` | 12px | 표준 카드, 뉴스 카드, 사이드바, 배너 |
| `{rounded.xl}` | 16px | 패널, 게시판, 모달, 히어로 강조 박스 |
| `{rounded.pill}` / `{rounded.full}` | 9999px | pill 버튼, 칩, 배지, 토글 |
| `{rounded.circle}` | 50% | 아바타, 라이브 도트, 토글 노브 |

### Photography / Crest Geometry
- 팀 로고는 `{rounded.xs}` 정사각 또는 원형 배지(이니셜 폴백).
- 뉴스 카드 썸네일은 `aspect-ratio:16/9`, 상단 모서리만 카드 라운딩 상속.
- 색/상태 칩은 항상 `{rounded.pill}`.

---

## Components

> hover 상태는 정의 표면이 다크 hover(밝은 surface 전환)로 일관되므로 default/active만 기재.

### Buttons

**`btn-primary`** — 인디고 주 버튼("구독하기", "저장", 주 CTA).
- 배경 `{colors.primary}`, 텍스트 `{colors.on-primary}`, `{typography.btn}`, 패딩 `8px 14px`, `{rounded.md}`. hover 시 `{colors.primary-hover}`.

**`btn-secondary`** — 보조 버튼("로그인", "전체 보기").
- 배경 `{colors.surface-1}`, 텍스트 `{colors.ink}`, 보더 `1px solid {colors.hairline}`, `{rounded.md}`. hover 시 surface-2 + hairline-strong.

**`btn-ghost`** — 약버튼(인라인 텍스트 액션).
- 배경 투명, 텍스트 `{colors.ink-subtle}`, hover 시 `{colors.ink}`.

**`btn-sm`** — 위 버튼들의 컴팩트 변형(`6px 11px`, 13px).

**`chip` / `chip.active`** — 상태 필터(전체/공식 발표/루머/완료), 카테고리.
- Inactive: 배경 `{colors.surface-1}`, 텍스트 `{colors.ink-subtle}`, 보더 `1px {colors.hairline}`, `{rounded.pill}`, `5px 13px`.
- Active: 배경 `{colors.primary}`, 보더 `{colors.primary}`, 텍스트 `{colors.on-primary}`.

**카카오 연결 버튼** — 이적시장 사이드바 한정.
- 배경 `#FEE500`(카카오 옐로), 텍스트 `#191600`, `{rounded.md}`, full-width.

### Badges

| 토큰 | 배경 | 텍스트 | 용도 |
|---|---|---|---|
| `badge-live` | `rgba(239,68,68,.12)` | `#f87171` | LIVE(앞에 펄스 도트) |
| `badge-new` | `rgba(94,106,210,.14)` | `{colors.primary-hover}` | 새 기사·공식 발표 |
| `badge-result` | `{colors.surface-3}` | `{colors.ink-subtle}` | 결과·루머·이적 |
| `badge-green` | `rgba(39,166,68,.12)` | `#4ade80` | 완료·대표팀 |
| `badge-warn` | `rgba(251,191,36,.12)` | `#fbbf24` | 업데이트 중·한정 |

- 공통: `{typography.badge}`, `{rounded.pill}`, `2px 9px`. `live-dot`은 6px 원, `pulse 1.4s` 애니메이션.

### Cards & Containers

**`card`** — 기본 카드.
- 배경 `{colors.surface-1}`, 보더 `1px {colors.hairline}`, `{rounded.lg}`, 상단 `::before` 그라디언트 라인. hover 시 surface-2 + hairline-strong.

**`news-card`** — 뉴스/인기뉴스/관련뉴스 카드.
- 배경 `{colors.surface-1}`, `{rounded.lg}`, 상단 16:9 썸네일(`news-thumb`, 대각선 줄무늬 패턴), 본문 16px 패딩. 카테고리(인디고 캡션) → 제목 → 요약 → 푸터(배지+시간). 클릭 시 전문 모달.

**`panel`** — 섹션 패널(어드민, 순위표).
- 배경 `{colors.surface-1}`, 보더 `1px {colors.hairline}`, `{rounded.xl}`, 상단 그라디언트 라인. `panel-head`는 surface-2 배경 + 하단 헤어라인.

**`transfer-board`** — 이적 게시판.
- 배경 `{colors.surface-1}`, 보더 `1px {colors.hairline}`, `{rounded.xl}`. `board-header`(surface-2, 캡션 라벨) + 행 목록. 행 클릭 시 `board-detail` 인라인 펼치기(이전→이적 클럽, 이적료/유형, 세부사항).

**`tf-sidebar`** — 이적시장 5대리그 사이드바.
- 배경 `{colors.surface-1}`, `{rounded.lg}`, sticky `top:72px`. "내 관심팀" 영역 + 리그 그룹(접기/펼치기, 기본 축소) + 팀 행(로고 22px + 이름 + ⭐ 팔로우). 카카오 알림 박스 포함.

**`burn-hero`** — 이적시장 버닝 히어로.
- `{colors.canvas}` 배경 + 방사형 주황 글로우 `::before` + 불꽃 파티클. LIVE 배지 → 그라디언트 타이틀 → 통계 칩 5종 → "이적 창구 열림" 오렌지 배너 → 상태 필터 칩.

**`home-hero`** — 홈 히어로 헤더.
- `{colors.canvas}` + 방사형 인디고 글로우 `::before`. 글로우 로고 SVG → 그라디언트 타이틀 "Kickoff" → 서브텍스트.

**`cta-panel`** — 뉴스레터 CTA.
- 배경 `{colors.surface-1}`, `{rounded.xl}`, 패딩 52px, 좌측 방사형 인디고 글로우. eyebrow + 헤드라인 + 이메일 입력 + `btn-primary`.

### 기사 전문 모달 (`article-modal`)
- 오버레이 `rgba(0,0,0,.75)` + blur(6px). 모달 `{colors.surface-1}`, `{rounded.xl}`, max-width 720px, max-height 88vh 스크롤.
- 헤더(sticky): 카테고리 캡션 + 닫기 버튼(`{rounded.md}`, surface-3). 본문: 제목 → 메타(시간·작성자) → 요약(이탤릭) → 전문(`white-space:pre-wrap`).
- ESC / 배경 클릭으로 닫힘.

### Inputs & Forms

**`inp` (text-input)** — 표준 입력.
- 배경 `{colors.surface-2}`, 텍스트 `{colors.ink}`, 보더 `1px {colors.hairline}`, `{rounded.md}`. 포커스 시 `{colors.primary-focus}` 보더 + `0 0 0 2px rgba(94,106,210,.2)`.

**`nav-search`** — 상단 검색 pill.
- 배경 `{colors.surface-1}`, 텍스트 `{colors.ink-subtle}`, `{rounded.md}`, min-width 160px. 768px 이하 숨김.

**팀 피커 (`tp-*`)** — 어드민 이적 입력 전용.
- `tp-btn`("선택 ▾") 클릭 시 `tp-dropdown`(surface-2, `{rounded.lg}`, `0 12px 40px` 그림자) 펼침. 리그 탭(PL/La Liga/BL/Serie A/Ligue 1) + 팀 로고 3열 그리드. `#sec-transfers` 패널은 `overflow:visible`로 잘림 방지.

**`tf-toggle`** — 카카오 알림 on/off 토글.
- 38×22px, `{rounded.pill}`. off는 surface-3, on은 `{colors.primary}` + 노브(16px 흰 원) 우측 이동.

### Navigation

**Top Nav (Desktop)** — 고정 상단 바.
- 배경 `rgba(1,1,2,.88)` + `backdrop-filter: blur(14px)`, height 56px, 하단 `1px {colors.hairline}`.
- 좌: Kickoff 로고(육각 SVG, 인디고). 중앙: 카테고리 링크(홈/리그/경기 결과/이적 시장 🔥/분석). 우: 검색 pill + 로그인/구독 버튼(또는 로그인 후 유저 pill + 관리자 링크 + 로그아웃).
- 활성 링크: `{colors.ink}` + surface-2 배경.

**Top Nav (Mobile)** — 768px 이하: 링크·검색 숨김, 로고 + 우측 버튼만.

**Ticker** — nav 아래 속보 띠.
- 배경 `{colors.surface-1}`, height 36px, 좌측 인디고 "속보" 라벨 + `ticker 30s linear infinite` 무한 스크롤.

### Status / 표

**`standings-table`** — 리그 순위표(어드민·홈 잔재).
- `standings-tabs`(surface-2, 활성 탭 하단 인디고 보더) + 테이블. 순위 뱃지 tier별 색(cl=인디고, uel=초록, rel=빨강, def=회색), 폼 도트(W/D/L 색상).

**업데이트 중 화면** — 리그/경기결과/분석 페이지.
- 중앙 정렬 풀스크린: 회전 아이콘 박스 + warn 배지("업데이트 중") + 제목 + 안내.

### Footer
- 배경 `{colors.canvas}`, 상단 `1px {colors.hairline}`, 패딩 `64px 0 24px`.
- `footer-grid` = `240px + repeat(4,1fr)`(1024px에서 2열, 768px에서 1열). 브랜드 + 리그/콘텐츠/대회/Kickoff 컬럼. 헤딩 `{typography.caption}`, 링크 `{typography.body-sm}` `{colors.ink-subtle}`.

---

## Do's and Don'ts

### Do
- `{colors.primary}` 인디고는 버튼·링크·활성 상태에만 절제해서 쓴다 — 무게가 있는 이유는 흔하지 않기 때문이다.
- 모든 버튼·칩·배지·토글에 `{rounded.pill}`을 적용한다 — 약버튼은 시그니처다.
- 카드는 그림자 대신 `{colors.hairline}` 보더 + 상단 `::before` 그라디언트 라인으로 떠 보이게 한다.
- 히어로 타이틀은 그라디언트 텍스트로만 색을 입힌다(홈=인디고, 이적시장=주황).
- eyebrow 라벨은 항상 앞 인디고 바 + 대문자로 쓴다.
- 주황(버닝) 액센트는 **이적시장 surface 안에서만** 쓴다.

### Don't
- 주황(버닝) 톤을 홈·리그·어드민 등 일반 surface에 끌어오지 않는다 — 이적시장 정체성이 흐려진다.
- 인디고 외 추가 액센트 색을 도입하지 않는다(주황은 이적시장 전용 예외). 나머지는 의도적으로 무채색이다.
- pill 버튼을 `{rounded.pill}` 미만으로 깎지 않는다.
- 마케팅 카드에 무거운 그림자를 넣지 않는다 — 그림자는 모달/드롭다운 신호다.
- 본문 line-height를 1.5 미만으로 줄이지 않는다 — 음수 자간이 이미 조여 있다.

---

## Responsive Behavior

### Breakpoints
| Name | Width | Key Changes |
|---|---|---|
| Mobile | < 768px | 단일 열. nav 링크·검색 숨김. 3열 그리드 → 1열. 이적시장 사이드바가 본문 위로(static, max-height 420px). 게시판 5열 → 3열. 푸터 1열. |
| Tablet | 768 – 1023px | 2열 그리드. nav 전체 노출. |
| Desktop | ≥ 1024px | 3열 그리드. 이적시장 `260px + 1fr` 사이드바 분할. |

### Touch Targets
- pill 버튼 실효 높이 약 32–40px(13–14px 텍스트 + 패딩). 모바일에서 충분히 탭 가능.
- 토글 38×22px, 닫기/아이콘 버튼 30–40px.

### Collapsing Strategy
- **Ticker**: 전 폭 유지, 무한 스크롤 지속.
- **이적시장 사이드바**: 1024px 미만에서 sticky 해제 + 본문 위로 이동(max-height 420px 스크롤).
- **그리드**(3열): 1024px에서 2열, 768px에서 1열.
- **히어로 타이틀**: `clamp()`로 뷰포트에 따라 40→80px 가변.
- **푸터**: 6영역 → 2열(태블릿) → 1열(모바일).

### Image Behavior
- 팀 로고: api-football CDN(`media.api-sports.io/football/teams/{id}.png`), 실패 시 이니셜 배지 폴백.
- 뉴스 썸네일: 16:9, 대각선 줄무늬 패턴 플레이스홀더(실제 이미지 없을 때).

---

## Known Gaps

- **라이트 모드**: 정의되지 않음. 시스템은 다크 전용으로 설계됐다.
- **애니메이션 타이밍**: 대부분 `.12s~.2s` 트랜지션. 모달/아코디언 표준 타이밍은 미정의 — 150~250ms ease-out 권장.
- **주황(버닝) 토큰**: 이적시장 인라인 스타일로만 존재, `:root` 토큰으로 승격되지 않음 — 이적시장 한정 액센트로 취급.
- **폼 컨트롤 선택 상태**(멀티셀렉트 등): 현재 라디오/토글만 존재 — 추가 시 인디고-on-다크 패턴을 따른다.
