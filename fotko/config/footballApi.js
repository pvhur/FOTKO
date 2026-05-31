'use strict';

const LEAGUES = {
  pl:         { code: 'PL',  label: '프리미어리그' },
  laliga:     { code: 'PD',  label: '라 리가' },
  bundesliga: { code: 'BL1', label: '분데스리가' },
  seriea:     { code: 'SA',  label: '세리에 A' },
};

const BASE  = 'https://api.football-data.org/v4';
const _cache = new Map();

function fromCache(key) {
  const e = _cache.get(key);
  return e && Date.now() < e.exp ? e.data : null;
}

async function apiFetch(path, ttl = 300_000) {
  const cached = fromCache(path);
  if (cached) return cached;

  const apiKey = process.env.FOOTBALL_API_KEY;
  if (!apiKey) throw new Error('FOOTBALL_API_KEY 환경변수가 없습니다.');

  const res = await fetch(`${BASE}${path}`, {
    headers: { 'X-Auth-Token': apiKey },
  });

  if (res.status === 429) throw new Error('API 요청 한도 초과');
  if (!res.ok) throw new Error(`football-data API ${res.status}: ${path}`);

  const data = await res.json();
  _cache.set(path, { data, exp: Date.now() + ttl });
  return data;
}

/* ── 순위표 ─────────────────────────────────────────────────────── */
async function fetchStandings(leagueKey) {
  const lg = LEAGUES[leagueKey];
  if (!lg) throw new Error(`알 수 없는 리그: ${leagueKey}`);

  const data  = await apiFetch(`/competitions/${lg.code}/standings`);
  const table = data.standings?.find(s => s.type === 'TOTAL')?.table ?? [];

  return table.map(r => ({
    rank: r.position,
    name: r.team.shortName || r.team.name,
    p:    r.playedGames,
    w:    r.won,
    d:    r.draw,
    l:    r.lost,
    gd:   r.goalDifference > 0 ? `+${r.goalDifference}` : String(r.goalDifference),
    pts:  r.points,
    form: (r.form || '').split(',').map(f => f.charAt(0)).join('').slice(-5),
    tier: tierOf(r.position),
  }));
}

/* ── 오늘 경기 ──────────────────────────────────────────────────── */
async function fetchTodayMatches() {
  const today = toDateStr(new Date());
  const data  = await apiFetch(`/matches?dateFrom=${today}&dateTo=${today}`, 60_000);
  const supported = new Set(Object.values(LEAGUES).map(l => l.code));

  return (data.matches || [])
    .filter(m => supported.has(m.competition?.code))
    .slice(0, 6)
    .map(m => ({
      home:   m.homeTeam.shortName || m.homeTeam.name,
      away:   m.awayTeam.shortName || m.awayTeam.name,
      score:  scoreStr(m),
      status: statusLabel(m.status, m.minute),
      live:   m.status === 'IN_PLAY' || m.status === 'PAUSED',
    }));
}

/* ── 예정 경기 ──────────────────────────────────────────────────── */
async function fetchFixtures() {
  const from = toDateStr(new Date());
  const to   = toDateStr(new Date(Date.now() + 7 * 86_400_000));
  const data  = await apiFetch(`/matches?dateFrom=${from}&dateTo=${to}&status=SCHEDULED`, 300_000);

  const supported = new Set(Object.values(LEAGUES).map(l => l.code));
  const labelOf   = Object.fromEntries(
    Object.values(LEAGUES).map(v => [v.code, v.label])
  );

  return (data.matches || [])
    .filter(m => supported.has(m.competition?.code))
    .slice(0, 8)
    .map(m => ({
      league: labelOf[m.competition?.code] || m.competition?.name || '',
      home:   m.homeTeam.shortName || m.homeTeam.name,
      away:   m.awayTeam.shortName || m.awayTeam.name,
      date:   toKSTStr(m.utcDate),
    }));
}

/* ── 헬퍼 ───────────────────────────────────────────────────────── */
function tierOf(pos) {
  if (pos <= 4)  return 'cl';
  if (pos === 5) return 'uel';
  if (pos >= 18) return 'rel';
  return 'def';
}

function scoreStr(m) {
  const ft = m.score?.fullTime;
  if (!ft || ft.home == null) return 'vs';
  return `${ft.home} - ${ft.away}`;
}

function statusLabel(status, minute) {
  if (status === 'IN_PLAY')   return minute ? `${minute}'` : '진행중';
  if (status === 'PAUSED')    return 'HT';
  if (status === 'FINISHED')  return 'FT';
  if (status === 'POSTPONED') return '연기';
  if (status === 'CANCELLED') return '취소';
  return '예정';
}

function toDateStr(d) {
  return d.toISOString().split('T')[0];
}

function toKSTStr(utc) {
  const d = new Date(new Date(utc).getTime() + 9 * 3_600_000);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

module.exports = { fetchStandings, fetchTodayMatches, fetchFixtures, LEAGUES };
