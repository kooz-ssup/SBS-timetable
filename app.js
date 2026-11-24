'use strict';
// ============================================================
// AIX 홍대 운영툴 — 시간표 편성 + 강사 배정
// 구조: [데이터 저장소(Firebase 또는 데모)] → [화면 그리기] → [버튼 동작]
// 새 기능은 아래 TABS 배열에 탭 하나를 추가하는 방식으로 늘려 갑니다.
// ============================================================

const CFG = window.APP_CONFIG || {};
const FB = CFG.firebase || null;
const DEMO = !FB || !FB.apiKey || String(FB.apiKey).startsWith('여기에');
const OWNERS = (CFG.ownerEmails || []).map(e => String(e).toLowerCase().trim());

const ROLE_LABEL = { viewer: '열람', editor: '편집', admin: '관리자' };
const SECTIONS = ['weekday', 'weekend'];
const COLORS = { '': '없음', yellow: '노랑', green: '초록', red: '빨강', blue: '파랑', purple: '보라', gray: '회색' };

// ---------- 작은 도구들 ----------
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toMin = t => { const [h, m] = String(t).split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const fromMin = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const clone = o => JSON.parse(JSON.stringify(o));
const ymNow = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const ymLabel = ym => { if (!ym) return ''; const [y, m] = ym.split('-'); return `${y}년 ${Number(m)}월`; };
const nextYm = ym => { let [y, m] = (ym || ymNow()).split('-').map(Number); m++; if (m > 12) { m = 1; y++; } return `${y}-${String(m).padStart(2, '0')}`; };
const num = v => { const n = Number(v); return isFinite(n) ? n : 0; };
const fmtH = h => (Math.round(h * 10) / 10).toString();

function defaultSettings() {
  return {
    weekday: {
      label: '평일', times: ['09:30', '11:30', '14:00', '16:00', '18:00', '19:00', '20:00'], defaultHours: 2,
      dayGroups: [{ label: '월수', days: 2 }, { label: '화목', days: 2 }, { label: '금', days: 1 }],
      dayOptions: [{ label: '월/수', col: 0, colSpan: 1 }, { label: '화/목', col: 1, colSpan: 1 }, { label: '월~목', col: 0, colSpan: 2 }, { label: '금', col: 2, colSpan: 1 }],
      rooms: [...'ABCDEFGHIJKLMNOPQRS'.split(''), '비대면']
    },
    weekend: {
      label: '주말', times: ['10:00', '14:00'], defaultHours: 4,
      dayGroups: [{ label: '토일', days: 2 }],
      dayOptions: [{ label: '토일', col: 0, colSpan: 1 }],
      rooms: [...'ABCDEFGHIJKLMNOPQRS'.split(''), '비대면']
    }
  };
}

// 화면 확인용 가상 예시 데이터 (실제 강사명 없음 — 공개 저장소에 올라가므로 실명 금지)
function seedCells() {
  const W = (room, col, colSpan, start, subject, instructor, extra = {}) =>
    ({ section: 'weekday', room, col, colSpan, start, hours: 2, subject, instructor, color: '', note: '', ...extra });
  const E = (room, start, subject, extra = {}) =>
    ({ section: 'weekend', room, col: 0, colSpan: 1, start, hours: 4, subject, instructor: '', color: '', note: '', ...extra });
  const list = [
    W('A', 0, 2, '11:30', '유툽/AI유툽', '강사A'),
    W('A', 0, 1, '14:00', '영포', '강사A'), W('A', 1, 1, '14:00', '영실', '강사A'),
    W('A', 0, 2, '16:00', 'AI유툽/유툽', '강사A'),
    W('A', 0, 1, '18:00', '영실', '강사A'), W('A', 1, 1, '18:00', '영포', '강사A'),
    W('A', 0, 2, '20:00', '유툽/AI유툽', '강사A'),
    W('B', 0, 2, '09:30', '자습실', '', { hours: 12.5, noInstructor: true, color: 'gray' }),
    W('C', 0, 2, '09:30', '디드-T', '강사E'), W('C', 0, 2, '11:30', '디드-T', '강사E'),
    W('C', 0, 2, '14:00', '디드-T', '강사E'), W('C', 0, 2, '16:00', '디드-T', '강사E'),
    W('C', 0, 2, '18:00', '디드-T', '강사C'), W('C', 0, 2, '20:00', '디드-스토리', '강사C'),
    W('D', 0, 2, '09:30', '에이전트(서포터/프로젝트)', '강사F'),
    W('D', 0, 2, '14:00', '레퍼런스/모델링', '강사C2'), W('D', 0, 2, '16:00', '모델링/레퍼런스', '강사C2'),
    W('D', 0, 2, '18:00', '디자인포폴', '강사G'),
    W('E', 0, 1, '18:00', '웹툰', '강사H', { hours: 4 }), W('E', 1, 1, '18:00', '컨셉', '강사H', { hours: 4 }),
    W('F', 0, 2, '09:30', '디자인포폴', '강사G'),
    W('F', 0, 2, '11:30', '공간/인디자인', '공강/강사I'),
    W('F', 0, 1, '14:00', '어드밴스', '강사J'), W('F', 1, 1, '14:00', '브랜딩', '강사J'),
    W('F', 0, 1, '16:00', '브랜딩', '강사J'), W('F', 1, 1, '16:00', '어드밴스', '강사J'),
    W('F', 0, 2, '18:00', '코딩포폴', '강사K'),
    W('F', 0, 2, '20:00', '크롱', '강사L', { color: 'yellow', note: '원본 시트에서 노랑(수업)·초록(강사) 표시된 칸' }),
    W('G', 0, 2, '20:00', '에이전트(서포터/프로젝트)', '강사M'),
    W('H', 0, 2, '18:00', '에이전트(서포터/프로젝트)', '강사M'),
    W('H', 0, 2, '20:00', '인디/디렉터', '강사I/강사K'),
    W('I', 0, 2, '14:00', '합성/플렛', '강사C5'), W('I', 0, 2, '16:00', '플렛/합성', '강사C5'),
    W('I', 0, 1, '18:00', '애니/컴포지팅', '강사N'), W('I', 1, 1, '18:00', '모델링/언리얼', '강사N'),
    W('I', 0, 1, '20:00', '룩뎁/언리얼', '강사N'), W('I', 1, 1, '20:00', '언리얼/후디니', '강사N'),
    E('B', '10:00', '포/일'), E('B', '14:00', '일/포'),
    E('C', '10:00', '디드'), E('C', '14:00', '디드'),
    E('G', '10:00', 'GTQ(시험)'), E('G', '14:00', '영실+영포'),
    E('H', '10:00', '모스(시험)', { hours: 8 }),
    E('I', '10:00', 'GTQ(시험)'), E('J', '10:00', 'AI프롬프트'),
    E('K', '10:00', 'ACP(시험)', { hours: 8 }),
    E('L', '14:00', '세무'),
    E('M', '10:00', '캐드'), E('M', '14:00', '전응건'),
    E('N', '10:00', 'AICE'), E('N', '14:00', 'ADSP'),
    E('O', '10:00', '스케치', { hours: 8 }),
    E('P', '10:00', '프리미어'), E('P', '14:00', '인벤터/전응기'),
    E('Q', '10:00', '모/엑/컴'), E('Q', '14:00', '엑/컴/모')
  ];
  return list.map(c => ({ ...c, id: uid() }));
}

// ============================================================
// 데이터 저장소 1) 데모 모드 — Firebase 연결 전, 이 브라우저에만 저장
// ============================================================
function demoStore() {
  const KEY = 'aix_tt_demo_v3';
  let db = null;
  try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* 저장소 사용 불가 */ }
  if (!db || !db.months) {
    db = {
      months: { '2026-12': { settings: defaultSettings(), cells: Object.fromEntries(seedCells().map(c => [c.id, c])) } },
      users: { 'demo@local': { email: 'demo@local', name: '데모 사용자', role: 'admin' } }
    };
  }
  const subs = new Set();
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { } subs.forEach(f => f()); };
  const sub = f => { subs.add(f); f(); return () => subs.delete(f); };
  let role = 'admin';
  try { role = localStorage.getItem(KEY + '_role') || 'admin'; } catch (e) { }
  return {
    demo: true,
    init(onUser) { onUser({ email: 'demo@local', name: '데모 사용자' }, role); },
    setDemoRole(r) { role = r; try { localStorage.setItem(KEY + '_role', r); } catch (e) { } },
    reset() { try { localStorage.removeItem(KEY); localStorage.removeItem(KEY + '_role'); } catch (e) { } location.reload(); },
    async signIn() { }, async signOut() { },
    watchMonths(cb) { return sub(() => cb(Object.keys(db.months).sort())); },
    watchMonth(ym, cb) {
      return sub(() => { const m = db.months[ym]; cb(m ? { settings: clone(m.settings), cells: Object.values(m.cells).map(clone) } : null); });
    },
    async createMonth(ym, data) { db.months[ym] = { settings: clone(data.settings), cells: Object.fromEntries(data.cells.map(c => [c.id, clone(c)])) }; persist(); },
    async deleteMonth(ym) { delete db.months[ym]; persist(); },
    async saveSettings(ym, s) { db.months[ym].settings = clone(s); persist(); },
    async saveCell(ym, c) { db.months[ym].cells[c.id] = { ...clone(c), updatedBy: 'demo@local', updatedAt: Date.now() }; persist(); },
    async deleteCell(ym, id) { delete db.months[ym].cells[id]; persist(); },
    watchUsers(cb) { return sub(() => cb(Object.values(db.users))); },
    async saveUser(u) { db.users[u.email] = u; persist(); },
    async deleteUser(email) { delete db.users[email]; persist(); }
  };
}

// ============================================================
// 데이터 저장소 2) Firebase — 구글 로그인 + Firestore(실시간 공유 저장)
// ============================================================
async function firebaseStore() {
  const V = '10.12.2';
  const [appMod, authMod, fs] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`)
  ]);
  const { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } = authMod;
  const { getFirestore, doc, getDoc, collection, onSnapshot, setDoc, deleteDoc, writeBatch, getDocs } = fs;
  const app = appMod.initializeApp(FB);
  const auth = getAuth(app);
  const db = getFirestore(app);
  let me = null;
  const onErr = e => { console.error(e); toast(e.code === 'permission-denied' ? '권한이 없어 처리하지 못했습니다.' : '저장소 오류: ' + (e.message || e)); };
  const clean = c => { const o = { ...c }; delete o.id; Object.keys(o).forEach(k => o[k] === undefined && delete o[k]); return o; };
  async function commitInChunks(ops) {
    for (let i = 0; i < ops.length; i += 400) {
      const b = writeBatch(db);
      ops.slice(i, i + 400).forEach(fn => fn(b));
      await b.commit();
    }
  }
  return {
    demo: false,
    init(onUser) {
      onAuthStateChanged(auth, async u => {
        if (!u) { me = null; onUser(null, null); return; }
        const email = (u.email || '').toLowerCase();
        me = email;
        let role = null;
        if (OWNERS.includes(email)) role = 'admin';
        else {
          try { const s = await getDoc(doc(db, 'users', email)); if (s.exists()) role = s.data().role || null; }
          catch (e) { console.warn(e); }
        }
        onUser({ email, name: u.displayName || email }, role);
      });
    },
    signIn() { return signInWithPopup(auth, new GoogleAuthProvider()); },
    signOut() { return signOut(auth); },
    watchMonths(cb) { return onSnapshot(collection(db, 'months'), s => cb(s.docs.map(d => d.id).sort()), onErr); },
    watchMonth(ym, cb) {
      let settings = null, cells = [], gotS = false, gotC = false, exists = true;
      const emit = () => { if (gotS && gotC) cb(exists && settings ? { settings, cells } : null); };
      const u1 = onSnapshot(doc(db, 'months', ym), s => { gotS = true; exists = s.exists(); settings = exists ? s.data().settings : null; emit(); }, onErr);
      const u2 = onSnapshot(collection(db, 'months', ym, 'cells'), s => { gotC = true; cells = s.docs.map(d => ({ ...d.data(), id: d.id })); emit(); }, onErr);
      return () => { u1(); u2(); };
    },
    async createMonth(ym, data) {
      const ops = [b => b.set(doc(db, 'months', ym), { settings: data.settings, createdAt: Date.now(), createdBy: me })];
      data.cells.forEach(c => ops.push(b => b.set(doc(db, 'months', ym, 'cells', c.id), { ...clean(c), updatedBy: me, updatedAt: Date.now() })));
      await commitInChunks(ops);
    },
    async deleteMonth(ym) {
      const s = await getDocs(collection(db, 'months', ym, 'cells'));
      const ops = s.docs.map(d => b => b.delete(d.ref));
      ops.push(b => b.delete(doc(db, 'months', ym)));
      await commitInChunks(ops);
    },
    async saveSettings(ym, settings) { await setDoc(doc(db, 'months', ym), { settings, updatedAt: Date.now(), updatedBy: me }, { merge: true }); },
    async saveCell(ym, c) { await setDoc(doc(db, 'months', ym, 'cells', c.id), { ...clean(c), updatedBy: me, updatedAt: Date.now() }); },
    async deleteCell(ym, id) { await deleteDoc(doc(db, 'months', ym, 'cells', id)); },
    watchUsers(cb) { return onSnapshot(collection(db, 'users'), s => cb(s.docs.map(d => ({ ...d.data(), email: d.id }))), onErr); },
    async saveUser(u) { await setDoc(doc(db, 'users', u.email), { name: u.name || '', role: u.role }); },
    async deleteUser(email) { await deleteDoc(doc(db, 'users', email)); }
  };
}

// ============================================================
// 화면 상태
// ============================================================
const S = {
  loading: true, error: null,
  user: null, role: null,
  months: [], ym: null, month: null,
  tab: 'timetable', view: 'weekday', hl: '', statSec: 'all',
  users: [], modal: null
};
let store = null;
let unsubs = { months: null, month: null, users: null };

const canEdit = () => S.role === 'editor' || S.role === 'admin';
const isAdmin = () => S.role === 'admin';

// 새 탭은 여기에 한 줄 추가 (need: 'edit' 또는 'admin'이면 해당 권한만 보임)
const TABS = [
  { id: 'timetable', label: '시간표', render: renderTimetable },
  { id: 'instructors', label: '강사별 집계', render: renderInstructors },
  { id: 'settings', label: '시간표 설정', render: renderSettings, need: 'edit' },
  { id: 'users', label: '사용자 관리', render: renderUsers, need: 'admin' }
];
const visibleTabs = () => TABS.filter(t => !t.need || (t.need === 'edit' && canEdit()) || (t.need === 'admin' && isAdmin()));

// ============================================================
// 계산: 칸 배치, 겹침, 강사 집계
// ============================================================
function sortedTimes(st) { return [...new Set(st.times)].sort((a, b) => toMin(a) - toMin(b)); }
function cellHours(c, st) { return num(c.hours) > 0 ? num(c.hours) : num(st.defaultHours) || 2; }
function cellDays(c, st) {
  let d = 0; const cs = Math.max(1, c.colSpan | 0);
  for (let j = c.col | 0; j < (c.col | 0) + cs; j++) d += num(st.dayGroups[j]?.days);
  return d;
}
// 수업 팝업의 '요일' 선택 항목 (예: 월/수, 화/목, 월~목, 금). 설정에 없으면 묶음별 + 전체로 자동 생성
function dayOptions(st) {
  const G = st.dayGroups.length;
  const list = (st.dayOptions || []).filter(o => (o.col | 0) >= 0 && (o.col | 0) + Math.max(1, o.colSpan | 0) <= G && o.label);
  if (list.length) return list;
  const out = st.dayGroups.map((g, i) => ({ label: g.label, col: i, colSpan: 1 }));
  if (G > 1) out.push({ label: st.dayGroups.map(g => g.label).join('+'), col: 0, colSpan: G });
  return out;
}
function dayLabel(c, st) {
  const s = c.col | 0, cs = Math.max(1, c.colSpan | 0);
  const o = dayOptions(st).find(x => (x.col | 0) === s && Math.max(1, x.colSpan | 0) === cs);
  if (o) return o.label;
  return st.dayGroups.slice(s, s + cs).map(x => x.label).join('+') || '?';
}
function dayOptionsToText(st) {
  return dayOptions(st).map(o => `${o.label}=${st.dayGroups.slice(o.col | 0, (o.col | 0) + Math.max(1, o.colSpan | 0)).map(g => g.label).join('+')}`).join(', ');
}
function splitNames(str) {
  return String(str || '').split(/[\/,·]/).map(s => s.trim()).filter(n => n && n !== '공강');
}
function splitSubjects(str) {
  // '/'로 나누되 괄호 안의 '/'는 유지: 에이전트(서포터/프로젝트) → 1개
  const out = []; let depth = 0, cur = '';
  for (const ch of String(str || '')) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === '/' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim()).filter(Boolean);
}
function describe(c, month) {
  const st = month.settings[c.section];
  return `${st.label} ${c.room} ${dayLabel(c, st)} ${c.start}(${fmtH(cellHours(c, st))}H) ${c.subject || ''}`;
}

function layout(month, sec) {
  const st = month.settings[sec];
  const times = sortedTimes(st); const mins = times.map(toMin);
  const rooms = st.rooms; const G = st.dayGroups.length;
  const occ = new Map(); const anchors = new Map(); const unplaced = []; const overlaps = [];
  const cells = month.cells.filter(c => c.section === sec)
    .sort((a, b) => toMin(a.start) - toMin(b.start) || rooms.indexOf(a.room) - rooms.indexOf(b.room) || String(a.id).localeCompare(String(b.id)));
  for (const c of cells) {
    const r = times.indexOf(c.start); const col = c.col | 0, cs = Math.max(1, c.colSpan | 0);
    if (r < 0 || !rooms.includes(c.room) || col + cs > G) { unplaced.push(c); continue; }
    const end = toMin(c.start) + cellHours(c, st) * 60;
    let rs = 0; for (let i = r; i < times.length && mins[i] < end; i++) rs++;
    rs = Math.max(1, rs);
    let clash = null;
    for (let i = r; i < r + rs; i++) for (let j = col; j < col + cs; j++) { const k = `${c.room}|${j}|${i}`; if (occ.has(k) && !clash) clash = occ.get(k); }
    if (clash) { overlaps.push([clash, c]); continue; }
    for (let i = r; i < r + rs; i++) for (let j = col; j < col + cs; j++) occ.set(`${c.room}|${j}|${i}`, c);
    anchors.set(`${c.room}|${col}|${r}`, { c, rs, cs });
  }
  return { st, times, rooms, G, occ, anchors, unplaced, overlaps };
}

function instructorConflicts(month) {
  const out = [];
  for (const sec of SECTIONS) {
    const st = month.settings[sec];
    const cs = month.cells.filter(c => c.section === sec && splitNames(c.instructor).length);
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
      const a = cs[i], b = cs[j];
      if (a.room === b.room) continue; // 같은 강의실 겹침은 '칸 겹침'에서 따로 표시
      const shared = splitNames(a.instructor).filter(n => splitNames(b.instructor).includes(n));
      if (!shared.length) continue;
      const a0 = a.col | 0, a1 = a0 + Math.max(1, a.colSpan | 0) - 1, b0 = b.col | 0, b1 = b0 + Math.max(1, b.colSpan | 0) - 1;
      if (!(a0 <= b1 && b0 <= a1)) continue;
      const aS = toMin(a.start), aE = aS + cellHours(a, st) * 60, bS = toMin(b.start), bE = bS + cellHours(b, st) * 60;
      if (!(aS < bE && bS < aE)) continue;
      shared.forEach(name => out.push({ name, a, b }));
    }
  }
  return out;
}

function instructorStats(month, secFilter = 'all') {
  const map = new Map(); const unassigned = [];
  for (const c of month.cells) {
    if (secFilter !== 'all' && c.section !== secFilter) continue;
    const st = month.settings[c.section]; if (!st) continue;
    const names = splitNames(c.instructor);
    if (!names.length) { if (!c.noInstructor && (c.subject || '').trim()) unassigned.push(c); continue; }
    const h = cellHours(c, st), days = cellDays(c, st);
    for (const n of names) {
      if (!map.has(n)) map.set(n, { name: n, time: 0, weekly: 0, subjects: new Set(), classes: [], secs: new Set() });
      const s = map.get(n);
      s.time += h; s.weekly += h * days; s.secs.add(c.section);
      splitSubjects(c.subject).forEach(x => s.subjects.add(x));
      s.classes.push(c);
    }
  }
  const list = [...map.values()].sort((a, b) => b.time - a.time || a.name.localeCompare(b.name, 'ko'));
  return { list, unassigned };
}

function allInstructorNames(month) {
  const set = new Set();
  (month?.cells || []).forEach(c => splitNames(c.instructor).forEach(n => set.add(n)));
  return [...set].sort((a, b) => a.localeCompare(b, 'ko'));
}

// ============================================================
// 화면 그리기
// ============================================================
function render() {
  S.dirty = false;
  const app = $('#app');
  const wrap = $('.grid-scroll'); const scroll = wrap ? [wrap.scrollLeft, window.scrollY] : null;
  if (S.error) { app.innerHTML = `<div class="center-card"><h2>문제가 생겼습니다</h2><p>${esc(S.error)}</p></div>`; return; }
  if (S.loading) { app.innerHTML = `<div class="center-card"><p>불러오는 중…</p></div>`; return; }
  if (!S.user) {
    app.innerHTML = `<div class="center-card">
      <div class="brand big">AIX 홍대 <b>운영툴</b></div>
      <p class="muted">허용된 계정만 볼 수 있습니다.</p>
      <button class="btn primary" data-act="signin">Google 계정으로 로그인</button></div>`;
    return;
  }
  if (!S.role) {
    app.innerHTML = `<div class="center-card">
      <h2>허가된 계정이 아닙니다</h2>
      <p>로그인한 계정: <b>${esc(S.user.email)}</b></p>
      <p class="muted">이 계정은 사용 허가가 없습니다. 관리자에게 등록을 요청하거나 다른 계정으로 로그인하세요.</p>
      <button class="btn" data-act="signout">로그아웃</button></div>`;
    return;
  }
  const tabs = visibleTabs();
  if (!tabs.find(t => t.id === S.tab)) S.tab = 'timetable';
  const tab = tabs.find(t => t.id === S.tab);
  app.innerHTML = `
    ${store.demo ? demoBar() : ''}
    <header class="top">
      <div class="brand">AIX 홍대 <b>운영툴</b></div>
      <div class="month-pick">
        <select id="monthSel" ${S.months.length ? '' : 'disabled'}>
          ${S.months.length ? S.months.slice().reverse().map(m => `<option value="${m}" ${m === S.ym ? 'selected' : ''}>${ymLabel(m)}</option>`).join('') : '<option>시간표 없음</option>'}
        </select>
        ${canEdit() ? `<button class="btn sm" data-act="newMonth">+ 새 달 만들기</button>` : ''}
      </div>
      <div class="me"><span class="role r-${S.role}">${ROLE_LABEL[S.role]}</span> ${esc(S.user.name)}
        ${store.demo ? '' : `<button class="btn sm ghost" data-act="signout">로그아웃</button>`}</div>
    </header>
    <nav class="tabs">${tabs.map(t => `<button class="tab ${t.id === S.tab ? 'on' : ''}" data-tab="${t.id}">${t.label}</button>`).join('')}</nav>
    <main>${S.ym && !S.month ? '<p class="muted pad">불러오는 중…</p>' : (S.ym || S.tab === 'users') ? tab.render() : emptyMonths()}</main>
    ${S.modal ? renderModal() : ''}
    <div id="toast"></div>`;
  const w2 = $('.grid-scroll');
  if (scroll && w2) { w2.scrollLeft = scroll[0]; window.scrollTo(0, scroll[1]); }
}

function demoBar() {
  return `<div class="demobar">
    <b>데모 모드</b> Firebase 설정 전 미리보기입니다. 수정 내용은 이 브라우저에만 저장됩니다.
    <label>권한 미리보기 <select id="demoRole">${Object.entries(ROLE_LABEL).map(([k, v]) => `<option value="${k}" ${k === S.role ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    <button class="btn sm ghost" data-act="demoReset">예시 데이터로 초기화</button></div>`;
}

function emptyMonths() {
  return `<div class="center-card inline"><h2>아직 만든 시간표가 없습니다</h2>
    ${canEdit() ? `<p class="muted">'새 달 만들기'로 첫 시간표를 만드세요. 첨부 시트 예시 데이터로 시작할 수도 있습니다.</p>
    <button class="btn primary" data-act="newMonth">+ 새 달 만들기</button>` : `<p class="muted">편집 권한자가 시간표를 만들면 여기에 보입니다.</p>`}</div>`;
}

// ---------- 탭 1: 시간표 ----------
function renderTimetable() {
  const m = S.month; if (!m) return '';
  const names = allInstructorNames(m);
  if (S.hl && !names.includes(S.hl)) S.hl = '';
  const secs = S.view === 'all' ? SECTIONS : [S.view];
  const lays = Object.fromEntries(SECTIONS.map(s => [s, layout(m, s)]));
  const conflicts = instructorConflicts(m);
  const warn = [];
  SECTIONS.forEach(s => {
    lays[s].overlaps.forEach(([a, b]) => warn.push(`<li><b>칸 겹침</b> ${esc(describe(b, m))} ↔ ${esc(describe(a, m))} <button class="link" data-open="${b.id}">열기</button></li>`));
    lays[s].unplaced.forEach(c => warn.push(`<li><b>배치 안 됨</b> ${esc(describe(c, m))} — 설정에 없는 강의실·시간·요일입니다 <button class="link" data-open="${c.id}">열기</button></li>`));
  });
  conflicts.forEach(x => warn.push(`<li><b>강사 중복</b> ${esc(x.name)}: ${esc(describe(x.a, m))} ↔ ${esc(describe(x.b, m))} <button class="link" data-open="${x.b.id}">열기</button></li>`));
  return `
    <div class="toolbar">
      <div class="seg">${[['weekday', '평일'], ['weekend', '주말'], ['all', '전체']].map(([k, v]) => `<button class="${S.view === k ? 'on' : ''}" data-view="${k}">${v}</button>`).join('')}</div>
      <label class="hl">강사 강조
        <select id="hlSel"><option value="">— 선택 안 함 —</option>${names.map(n => `<option ${n === S.hl ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      <span class="hint">${canEdit() ? '빈 칸 클릭 = 수업 추가 · 수업 클릭 = 수정' : '수업을 클릭하면 상세가 보입니다'}</span>
    </div>
    ${warn.length ? `<details class="warnbox" open><summary>확인 필요 ${warn.length}건</summary><ul>${warn.join('')}</ul></details>` : `<div class="okbox">겹침·강사 중복 없음</div>`}
    ${secs.map(s => gridHTML(m, s, lays[s])).join('')}`;
}

function gridHTML(m, sec, L) {
  const { st, times, rooms, G, occ, anchors } = L;
  const groups = st.dayGroups;
  const hl = S.hl;
  let h = `<section class="gsec"><h3>${esc(st.label)}반 <span class="muted">${times.length}개 시간대 · 강의실 ${rooms.length}개 · 기본 ${fmtH(num(st.defaultHours))}H</span></h3>
  <div class="grid-scroll"><table class="grid ${hl ? 'has-hl' : ''}"><thead>
  <tr><th class="tcol" rowspan="2">시간</th>${rooms.map(r => `<th class="room rs" colspan="${G}">${esc(r)}</th>`).join('')}</tr>
  <tr>${rooms.map(() => groups.map((g, j) => `<th class="grp ${j === 0 ? 'rs' : ''}">${esc(g.label)}</th>`).join('')).join('')}</tr></thead><tbody>`;
  times.forEach((t, i) => {
    h += `<tr><th class="tcol">${t}</th>`;
    rooms.forEach(r => {
      for (let j = 0; j < G; j++) {
        const k = `${r}|${j}|${i}`;
        const a = anchors.get(k);
        if (a) {
          const c = a.c; const names = splitNames(c.instructor);
          const on = hl && names.includes(hl);
          const hrs = cellHours(c, st);
          h += `<td class="cell c-${c.color || 'none'} ${j === 0 ? 'rs' : ''} ${on ? 'hl' : ''}" rowspan="${a.rs}" colspan="${a.cs}" data-open="${c.id}" title="${esc(describe(c, m))}${c.note ? '\n메모: ' + esc(c.note) : ''}">
            <div class="subj">${esc(c.subject)}</div>
            <div class="inst">${c.instructor ? esc(c.instructor) : (c.noInstructor ? '' : '<span class="none">미배정</span>')}</div>
            ${hrs !== num(st.defaultHours) || c.note ? `<div class="meta">${hrs !== num(st.defaultHours) ? fmtH(hrs) + 'H' : ''}${c.note ? ' ✎' : ''}</div>` : ''}</td>`;
        } else if (!occ.has(k)) {
          h += `<td class="empty ${j === 0 ? 'rs' : ''} ${canEdit() ? 'can' : ''}" data-new="${sec}|${esc(r)}|${j}|${t}"></td>`;
        }
      }
    });
    h += `</tr>`;
  });
  return h + `</tbody></table></div></section>`;
}

// ---------- 탭 2: 강사별 집계 ----------
function renderInstructors() {
  const m = S.month; if (!m) return '';
  const { list, unassigned } = instructorStats(m, S.statSec);
  const conflicts = instructorConflicts(m).filter(x => S.statSec === 'all' || x.a.section === S.statSec);
  const totalCells = m.cells.filter(c => (S.statSec === 'all' || c.section === S.statSec) && !c.noInstructor).length;
  const totalTime = list.reduce((s, x) => s + x.time, 0);
  return `
    <div class="toolbar">
      <div class="seg">${[['all', '전체'], ['weekday', '평일'], ['weekend', '주말']].map(([k, v]) => `<button class="${S.statSec === k ? 'on' : ''}" data-statsec="${k}">${v}</button>`).join('')}</div>
      <span class="hint">타임 = 수업 1회 시간(1시간 = 1타임) 합계 · 주간 시간 = 타임 × 주당 수업일수(월/수=2일, 월~목=4일, 금=1일)</span>
      <button class="btn sm" data-act="csv">CSV 내려받기</button>
    </div>
    <div class="cards">
      <div class="card"><div class="k">강사 수</div><div class="v">${list.length}명</div></div>
      <div class="card"><div class="k">편성 수업</div><div class="v">${totalCells}개</div></div>
      <div class="card"><div class="k">배정 타임 합계</div><div class="v">${fmtH(totalTime)}</div></div>
      <div class="card ${unassigned.length ? 'bad' : ''}"><div class="k">강사 미배정</div><div class="v">${unassigned.length}개</div></div>
      <div class="card ${conflicts.length ? 'bad' : ''}"><div class="k">강사 중복 배정</div><div class="v">${conflicts.length}건</div></div>
    </div>
    <table class="stat"><thead><tr><th>강사</th><th class="n">담당 과목</th><th class="n">타임</th><th class="n">주간 시간</th><th>과목</th><th>담당 수업</th></tr></thead><tbody>
    ${list.map(s => `<tr>
      <td><button class="link strong" data-goinst="${esc(s.name)}">${esc(s.name)}</button>${conflicts.some(x => x.name === s.name) ? ' <span class="tag bad">중복</span>' : ''}</td>
      <td class="n">${s.subjects.size}</td><td class="n"><b>${fmtH(s.time)}</b></td><td class="n">${fmtH(s.weekly)}H</td>
      <td class="subjs">${[...s.subjects].map(x => `<span class="chip">${esc(x)}</span>`).join('')}</td>
      <td class="cls">${s.classes.sort((a, b) => a.section.localeCompare(b.section) || toMin(a.start) - toMin(b.start)).map(c => `<button class="chip ghost" data-open="${c.id}">${esc(describe(c, m))}</button>`).join('')}</td></tr>`).join('') || `<tr><td colspan="6" class="muted">배정된 강사가 없습니다.</td></tr>`}
    </tbody></table>
    ${unassigned.length ? `<h4>강사 미배정 수업</h4><div class="chips">${unassigned.map(c => `<button class="chip warn" data-open="${c.id}">${esc(describe(c, m))}</button>`).join('')}</div>` : ''}
    ${conflicts.length ? `<h4>강사 중복 배정</h4><ul class="plain">${conflicts.map(x => `<li><b>${esc(x.name)}</b> ${esc(describe(x.a, m))} ↔ ${esc(describe(x.b, m))}</li>`).join('')}</ul>` : ''}
    <p class="muted small">· 강사 칸에 '홍길동1/홍길동2'처럼 여러 명을 쓰면 각자에게 같은 타임이 잡힙니다. '공강'은 집계에서 빠집니다.<br>· 과목 수는 '/'로 나눠 셉니다(예: 유툽/AI유툽 = 2과목). 괄호 안 '/'는 나누지 않습니다.</p>`;
}

function downloadCSV() {
  const m = S.month; if (!m) return;
  const { list } = instructorStats(m, S.statSec);
  const rows = [['월', '강사', '담당과목수', '타임', '주간시간', '과목', '담당수업']];
  list.forEach(s => rows.push([S.ym, s.name, s.subjects.size, fmtH(s.time), fmtH(s.weekly), [...s.subjects].join(' / '), s.classes.map(c => describe(c, m)).join(' | ')]));
  const csv = '﻿' + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `강사별집계_${S.ym}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
}

// ---------- 탭 3: 시간표 설정 ----------
function renderSettings() {
  const m = S.month; if (!m) return '';
  const block = sec => {
    const st = m.settings[sec];
    return `<div class="setbox" data-sec="${sec}">
      <h3>${esc(st.label)}반</h3>
      <label>시간대 <small>(쉼표로 구분, 24시간 표기)</small><input class="f-times" value="${esc(sortedTimes(st).join(', '))}"></label>
      <label>기본 수업시간(H) <small>새 수업을 만들 때 기본값</small><input class="f-hours" type="number" step="0.5" min="0.5" value="${esc(st.defaultHours)}"></label>
      <label>강의실 <small>(쉼표로 구분, 화면 왼쪽부터 순서)</small><input class="f-rooms" value="${esc(st.rooms.join(', '))}"></label>
      <div class="lbl">요일 묶음 <small>열 이름과 주당 수업일수 — 예: 토일(2일) 하나 / 토(1일)·일(1일) 둘로 분리</small></div>
      <div class="groups">${st.dayGroups.map(g => `<div class="grow"><input class="g-label" value="${esc(g.label)}" placeholder="이름"><input class="g-days" type="number" min="1" max="7" value="${esc(g.days)}"><span>일</span><button class="btn sm ghost" data-act="grpDel">삭제</button></div>`).join('')}</div>
      <button class="btn sm ghost" data-act="grpAdd">+ 요일 묶음 추가</button>
      <label>수업 팝업의 '요일' 선택 항목 <small>표시이름=요일묶음, 쉼표로 구분 · 여러 열을 합칠 땐 + (붙어 있는 열만)</small><input class="f-opts" value="${esc(dayOptionsToText(st))}"></label>
    </div>`;
  };
  return `<div class="pad">
    <p class="muted">이 설정은 <b>${ymLabel(S.ym)}</b> 시간표에만 적용됩니다. 새 달을 복사해 만들면 설정도 함께 넘어갑니다.<br>
    시간·강의실·요일 묶음을 지우면, 거기에 있던 수업은 지워지지 않고 시간표 화면의 '배치 안 됨'에 표시됩니다.</p>
    <div class="setgrid">${SECTIONS.map(block).join('')}</div>
    <div class="actions"><button class="btn primary" data-act="saveSettings">설정 저장</button></div>
    ${isAdmin() ? `<div class="danger"><h4>이 달 시간표 삭제</h4><p class="muted small">${ymLabel(S.ym)}의 모든 수업과 설정이 지워집니다. 되돌릴 수 없습니다.</p>
      <button class="btn danger-btn" data-act="delMonth">${S.confirmDelMonth ? '정말 삭제합니다 (한 번 더 클릭)' : `${ymLabel(S.ym)} 삭제`}</button></div>` : ''}
  </div>`;
}

function readSettingsForm() {
  const out = clone(S.month.settings); const errs = [];
  for (const sec of SECTIONS) {
    const box = $(`.setbox[data-sec="${sec}"]`); const st = out[sec];
    const times = $('.f-times', box).value.split(',').map(s => s.trim()).filter(Boolean);
    const bad = times.filter(t => !/^\d{1,2}:\d{2}$/.test(t) || toMin(t) >= 24 * 60);
    if (bad.length) errs.push(`${st.label}: 시간 형식 오류 (${bad.join(', ')}) — 예: 09:30`);
    st.times = [...new Set(times.map(t => fromMin(toMin(t))))].sort((a, b) => toMin(a) - toMin(b));
    if (!st.times.length) errs.push(`${st.label}: 시간대가 하나 이상 있어야 합니다`);
    st.defaultHours = num($('.f-hours', box).value) || 2;
    st.rooms = [...new Set($('.f-rooms', box).value.split(',').map(s => s.trim()).filter(Boolean))];
    if (!st.rooms.length) errs.push(`${st.label}: 강의실이 하나 이상 있어야 합니다`);
    st.dayGroups = [...box.querySelectorAll('.grow')].map(r => ({ label: $('.g-label', r).value.trim(), days: Math.max(1, num($('.g-days', r).value) | 0) })).filter(g => g.label);
    if (!st.dayGroups.length) errs.push(`${st.label}: 요일 묶음이 하나 이상 있어야 합니다`);
    const labels = st.dayGroups.map(g => g.label);
    st.dayOptions = [];
    $('.f-opts', box).value.split(',').map(x => x.trim()).filter(Boolean).forEach(item => {
      const [name, grp] = item.includes('=') ? item.split('=').map(x => x.trim()) : [item, item];
      const idx = (grp || '').split('+').map(x => labels.indexOf(x.trim())).sort((x, y) => x - y);
      const ok = name && idx.length && !idx.includes(-1) && idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
      if (!ok) errs.push(`${st.label}: 요일 선택 항목 '${item}'을 확인하세요 (요일 묶음 이름과 같아야 하고, 붙어 있는 열만 합칠 수 있음)`);
      else st.dayOptions.push({ label: name, col: idx[0], colSpan: idx.length });
    });
  }
  return { out, errs };
}

// ---------- 탭 4: 사용자 관리 ----------
function renderUsers() {
  const owners = OWNERS.filter(e => e && !e.startsWith('여기에'));
  const users = S.users.slice().sort((a, b) => (a.email || '').localeCompare(b.email || ''));
  return `<div class="pad">
    <p class="muted">등록된 구글 계정만 로그인 후 볼 수 있습니다. <b>열람</b> = 보기만 · <b>편집</b> = 시간표 수정·삭제·새 달 만들기 · <b>관리자</b> = 편집 + 사용자 관리</p>
    <div class="adduser">
      <input id="uEmail" type="email" placeholder="구글 메일 주소"><input id="uName" placeholder="이름(선택)">
      <select id="uRole"><option value="viewer">열람</option><option value="editor">편집</option><option value="admin">관리자</option></select>
      <button class="btn primary" data-act="addUser">등록</button>
    </div>
    <table class="stat"><thead><tr><th>메일</th><th>이름</th><th>권한</th><th></th></tr></thead><tbody>
      ${owners.map(e => `<tr><td>${esc(e)}</td><td class="muted">설정 파일 지정</td><td><span class="role r-admin">관리자(고정)</span></td><td></td></tr>`).join('')}
      ${users.map(u => `<tr><td>${esc(u.email)}</td><td>${esc(u.name || '')}</td>
        <td><select data-urole="${esc(u.email)}">${Object.entries(ROLE_LABEL).map(([k, v]) => `<option value="${k}" ${k === u.role ? 'selected' : ''}>${v}</option>`).join('')}</select></td>
        <td><button class="btn sm ghost" data-udel="${esc(u.email)}">${S.confirmUdel === u.email ? '정말 삭제?' : '삭제'}</button></td></tr>`).join('')}
    </tbody></table>
    ${store.demo ? '<p class="muted small">데모 모드에서는 목록만 저장되고 실제 로그인 제한은 적용되지 않습니다.</p>' : ''}
  </div>`;
}

// ---------- 팝업(모달) ----------
function renderModal() {
  const md = S.modal;
  if (md.type === 'newMonth') {
    const latest = S.months[S.months.length - 1];
    return `<div class="overlay" data-act="closeModal"><div class="modal">
      <h3>새 달 시간표 만들기</h3>
      <label>만들 달<input id="nmYm" type="month" value="${esc(md.ym || nextYm(latest || ymNow()))}"></label>
      <label>시작 방법<select id="nmFrom">
        ${S.months.slice().reverse().map(m => `<option value="${m}" ${m === latest ? 'selected' : ''}>${ymLabel(m)} 복사</option>`).join('')}
        <option value="">빈 시간표 (설정만${latest ? ' ' + ymLabel(latest) + ' 기준' : ' 기본값'})</option>
        ${S.months.length ? '' : '<option value="__seed" selected>가상 예시 데이터 (화면 확인용)</option>'}
      </select></label>
      ${md.err ? `<p class="err">${esc(md.err)}</p>` : ''}
      <div class="actions"><button class="btn" data-act="closeModal">취소</button><button class="btn primary" data-act="createMonth">만들기</button></div>
    </div></div>`;
  }
  // 수업 칸
  const c = md.cell; const m = S.month; const st = m.settings[c.section];
  const G = st.dayGroups.length; const ro = !canEdit();
  const ranges = dayOptions(st).map(o => [`${o.col | 0}-${(o.col | 0) + Math.max(1, o.colSpan | 0) - 1}`, o.label]);
  const curRange = `${c.col | 0}-${(c.col | 0) + Math.max(1, c.colSpan | 0) - 1}`;
  if (!ranges.find(r => r[0] === curRange)) ranges.push([curRange, '현재값(설정에 없음)']);
  const times = sortedTimes(st); const timeOpts = times.includes(c.start) ? times : [c.start, ...times];
  const roomOpts = st.rooms.includes(c.room) ? st.rooms : [c.room, ...st.rooms];
  const dis = ro ? 'disabled' : '';
  return `<div class="overlay" data-act="closeModal"><div class="modal">
    <h3>${md.isNew ? '수업 추가' : ro ? '수업 정보' : '수업 수정'} <span class="muted">· ${esc(st.label)}반 · ${ymLabel(S.ym)}</span></h3>
    <div class="form2">
      <label>강의실<select id="fRoom" ${dis}>${roomOpts.map(r => `<option ${r === c.room ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label>
      <label>요일<select id="fRange" ${dis}>${ranges.map(([v, l]) => `<option value="${v}" ${v === curRange ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
      <label>시작 시간<select id="fStart" ${dis}>${timeOpts.map(t => `<option ${t === c.start ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label>수업시간(H)<input id="fHours" type="number" step="0.5" min="0.5" value="${esc(cellHours(c, st))}" ${dis}></label>
    </div>
    <label>과목<input id="fSubj" value="${esc(c.subject || '')}" placeholder="예: 디드-T" ${dis}></label>
    <label>강사 <small>여러 명이면 / 로 구분</small>
      <input id="fInst" list="instList" value="${esc(c.instructor || '')}" placeholder="예: 홍길동1" ${dis}>
      <datalist id="instList">${allInstructorNames(m).map(n => `<option value="${esc(n)}">`).join('')}</datalist></label>
    <label class="chk"><input id="fNoInst" type="checkbox" ${c.noInstructor ? 'checked' : ''} ${dis}> 강사 없는 칸 (자습실 등 — '미배정' 표시 안 함)</label>
    <div class="lbl">색상</div>
    <div class="colors">${Object.entries(COLORS).map(([k, v]) => `<label class="sw c-${k || 'none'}"><input type="radio" name="fColor" value="${k}" ${(c.color || '') === k ? 'checked' : ''} ${dis}><span>${v}</span></label>`).join('')}</div>
    <label>메모<textarea id="fNote" rows="2" ${dis}>${esc(c.note || '')}</textarea></label>
    ${!md.isNew && c.updatedBy ? `<p class="muted small">마지막 수정: ${esc(c.updatedBy)}${c.updatedAt ? ' · ' + new Date(c.updatedAt).toLocaleString('ko-KR') : ''}</p>` : ''}
    ${md.warn ? `<div class="err"><b>확인해 주세요</b><ul>${md.warn.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>` : ''}
    <div class="actions">
      ${!ro && !md.isNew ? `<button class="btn danger-btn left" data-act="delCell">${md.confirmDel ? '정말 삭제?' : '삭제'}</button>` : ''}
      <button class="btn" data-act="closeModal">${ro ? '닫기' : '취소'}</button>
      ${ro ? '' : `<button class="btn primary" data-act="saveCell">${md.warn ? '그래도 저장' : '저장'}</button>`}
    </div>
  </div></div>`;
}

function readCellForm() {
  const c = clone(S.modal.cell);
  const [s, e] = $('#fRange').value.split('-').map(Number);
  c.room = $('#fRoom').value; c.col = s; c.colSpan = e - s + 1;
  c.start = $('#fStart').value; c.hours = num($('#fHours').value) || 2;
  c.subject = $('#fSubj').value.trim(); c.instructor = $('#fInst').value.trim();
  c.noInstructor = $('#fNoInst').checked;
  c.color = (document.querySelector('input[name="fColor"]:checked') || {}).value || '';
  c.note = $('#fNote').value.trim();
  delete c.updatedBy; delete c.updatedAt;
  return c;
}

function checkCell(c) {
  const m = { settings: S.month.settings, cells: S.month.cells.filter(x => x.id !== c.id).concat([c]) };
  const warn = [];
  const L = layout(m, c.section);
  L.overlaps.forEach(([a, b]) => { if (a.id === c.id || b.id === c.id) { const o = a.id === c.id ? b : a; warn.push(`같은 칸에 다른 수업이 있습니다: ${describe(o, m)}`); } });
  if (L.unplaced.some(x => x.id === c.id)) warn.push('설정에 없는 강의실·시간·요일이라 시간표에 표시되지 않습니다.');
  instructorConflicts(m).forEach(x => { if (x.a.id === c.id || x.b.id === c.id) { const o = x.a.id === c.id ? x.b : x.a; warn.push(`${x.name} 강사가 같은 시간에 다른 수업이 있습니다: ${describe(o, m)}`); } });
  return [...new Set(warn)];
}

// ============================================================
// 버튼·입력 동작
// ============================================================
function selectMonth(ym) {
  if (unsubs.month) { unsubs.month(); unsubs.month = null; }
  S.ym = ym; S.month = null; S.confirmDelMonth = false;
  if (ym) unsubs.month = store.watchMonth(ym, m => { if (S.ym !== ym) return; S.month = m; softRender(); });
  render();
}
function pickDefaultMonth(list) {
  const now = ymNow();
  if (list.includes(now)) return now;
  return list.filter(m => m > now)[0] || list[list.length - 1] || null;
}
function startWatching() {
  stopWatching();
  unsubs.months = store.watchMonths(list => {
    S.months = list;
    if (!S.ym || !list.includes(S.ym)) selectMonth(pickDefaultMonth(list));
    else if (!unsubs.month) selectMonth(S.ym);
    else softRender();
  });
  if (isAdmin()) unsubs.users = store.watchUsers(u => { S.users = u; if (S.tab === 'users') softRender(); });
}
// 다른 사람이 수정해 실시간 갱신이 와도, 입력 중인 팝업·설정 폼은 지우지 않도록 잠시 미룸
function softRender() {
  const a = document.activeElement;
  if (S.modal || (a && a.closest && a.closest('.setbox,.adduser'))) { S.dirty = true; return; }
  render();
}
document.addEventListener('focusout', () => setTimeout(() => { if (S.dirty && !S.modal) { const a = document.activeElement; if (!(a && a.closest && a.closest('.setbox,.adduser'))) { S.dirty = false; render(); } } }, 0));

function stopWatching() {
  Object.keys(unsubs).forEach(k => { if (unsubs[k]) unsubs[k](); unsubs[k] = null; });
}

function toast(msg) {
  const t = $('#toast'); if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600);
}
async function run(fn, okMsg) {
  try { await fn(); if (okMsg) toast(okMsg); }
  catch (e) { console.error(e); toast(e.code === 'permission-denied' ? '권한이 없어 처리하지 못했습니다.' : '오류: ' + (e.message || e)); }
}

function openCell(id) {
  const c = S.month?.cells.find(x => x.id === id); if (!c) return;
  S.modal = { type: 'cell', cell: clone(c), isNew: false }; render();
}

document.addEventListener('click', async ev => {
  const el = ev.target.closest('[data-act],[data-tab],[data-view],[data-statsec],[data-open],[data-new],[data-goinst],[data-udel]');
  if (!el) return;
  const d = el.dataset;
  if (d.tab) { S.tab = d.tab; render(); return; }
  if (d.view) { S.view = d.view; render(); return; }
  if (d.statsec) { S.statSec = d.statsec; render(); return; }
  if (d.goinst) { S.hl = d.goinst; S.tab = 'timetable'; S.view = 'all'; render(); return; }
  if (d.open) { openCell(d.open); return; }
  if (d.new) {
    if (!canEdit()) return;
    const [section, room, col, start] = d.new.split('|');
    const st = S.month.settings[section];
    S.modal = { type: 'cell', isNew: true, cell: { id: uid(), section, room, col: +col, colSpan: 1, start, hours: num(st.defaultHours) || 2, subject: '', instructor: '', color: '', note: '' } };
    render(); setTimeout(() => $('#fSubj')?.focus(), 0); return;
  }
  if (d.udel) {
    if (S.confirmUdel !== d.udel) { S.confirmUdel = d.udel; render(); return; }
    S.confirmUdel = null; await run(() => store.deleteUser(d.udel), '삭제했습니다'); return;
  }
  switch (d.act) {
    case 'signin': run(() => store.signIn()); break;
    case 'signout': run(() => store.signOut()); break;
    case 'demoReset': store.reset(); break;
    case 'closeModal': if (ev.target === el) { S.modal = null; render(); } break;
    case 'newMonth': S.modal = { type: 'newMonth' }; render(); break;
    case 'createMonth': {
      const ym = $('#nmYm').value; const from = $('#nmFrom').value;
      if (!/^\d{4}-\d{2}$/.test(ym)) { S.modal.err = '만들 달을 선택하세요.'; render(); return; }
      if (S.months.includes(ym)) { S.modal.err = `${ymLabel(ym)} 시간표는 이미 있습니다. 위쪽 달 선택에서 여세요.`; S.modal.ym = ym; render(); return; }
      let data;
      if (from === '__seed') data = { settings: defaultSettings(), cells: seedCells() };
      else if (from) {
        const src = await new Promise(res => { const u = store.watchMonth(from, m => { if (m) { setTimeout(() => u && u(), 0); res(m); } }); });
        data = { settings: clone(src.settings), cells: src.cells.map(c => { const n = clone(c); n.id = uid(); delete n.updatedBy; delete n.updatedAt; return n; }) };
      } else {
        const latest = S.months[S.months.length - 1];
        const base = latest && S.ym === latest && S.month ? clone(S.month.settings) : defaultSettings();
        data = { settings: base, cells: [] };
      }
      S.modal = null;
      await run(() => store.createMonth(ym, data), `${ymLabel(ym)} 시간표를 만들었습니다`);
      selectMonth(ym);
      break;
    }
    case 'saveCell': {
      const c = readCellForm();
      if (!c.subject) { S.modal.cell = c; S.modal.warn = ['과목을 입력하세요.']; S.modal.forceOk = false; render(); return; }
      const warn = checkCell(c);
      const same = JSON.stringify(warn) === JSON.stringify(S.modal.warn || null);
      if (warn.length && !(S.modal.warn && same)) { S.modal.cell = c; S.modal.warn = warn; render(); return; }
      S.modal = null; render();
      await run(() => store.saveCell(S.ym, c), '저장했습니다');
      break;
    }
    case 'delCell': {
      if (!S.modal.confirmDel) { S.modal.cell = readCellForm(); S.modal.confirmDel = true; render(); return; }
      const id = S.modal.cell.id; S.modal = null; render();
      await run(() => store.deleteCell(S.ym, id), '삭제했습니다');
      break;
    }
    case 'grpAdd': {
      const box = el.closest('.setbox'); const row = document.createElement('div'); row.className = 'grow';
      row.innerHTML = `<input class="g-label" placeholder="이름"><input class="g-days" type="number" min="1" max="7" value="1"><span>일</span><button class="btn sm ghost" data-act="grpDel">삭제</button>`;
      $('.groups', box).appendChild(row); break;
    }
    case 'grpDel': el.closest('.grow').remove(); break;
    case 'saveSettings': {
      const { out, errs } = readSettingsForm();
      if (errs.length) { toast(errs[0]); return; }
      await run(() => store.saveSettings(S.ym, out), '설정을 저장했습니다');
      break;
    }
    case 'delMonth': {
      if (!S.confirmDelMonth) { S.confirmDelMonth = true; render(); return; }
      const ym = S.ym; S.confirmDelMonth = false;
      await run(() => store.deleteMonth(ym), `${ymLabel(ym)} 시간표를 삭제했습니다`);
      break;
    }
    case 'addUser': {
      const email = $('#uEmail').value.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast('메일 주소를 확인하세요'); return; }
      await run(() => store.saveUser({ email, name: $('#uName').value.trim(), role: $('#uRole').value }), '등록했습니다');
      break;
    }
    case 'csv': downloadCSV(); break;
  }
});

document.addEventListener('change', ev => {
  const t = ev.target;
  if (t.id === 'monthSel') selectMonth(t.value);
  else if (t.id === 'hlSel') { S.hl = t.value; render(); }
  else if (t.id === 'demoRole') {
    store.setDemoRole(t.value); S.role = t.value; S.modal = null;
    stopWatching(); startWatching(); render();
  }
  else if (t.dataset.urole) run(() => store.saveUser({ ...S.users.find(u => u.email === t.dataset.urole), email: t.dataset.urole, role: t.value }), '권한을 바꿨습니다');
});

document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && S.modal) { S.modal = null; render(); } });

// ============================================================
// 시작
// ============================================================
(async function boot() {
  render();
  try { store = DEMO ? demoStore() : await firebaseStore(); }
  catch (e) { console.error(e); S.error = 'Firebase를 불러오지 못했습니다. firebase-config.js 값과 인터넷 연결을 확인하세요. (' + (e.message || e) + ')'; render(); return; }
  store.init((user, role) => {
    S.user = user; S.role = role; S.loading = false;
    stopWatching();
    S.months = []; S.ym = null; S.month = null;
    if (user && role) startWatching();
    render();
  });
})();
