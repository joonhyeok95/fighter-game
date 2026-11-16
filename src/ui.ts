import * as THREE from 'three';
import type { Game } from './game';
import { SUITS } from './game';
import { STYLES, MOVES, STYLE_IDS, OPEN_STYLES } from './moves';
import { AI_LEVELS, Difficulty } from './ai';
import type { Fighter } from './fighter';
import { MAP, MAPS, STAIR } from './maps';
/** in-game button → keyboard key shown to the player */
const KEY: Record<string, string> = { J: 'X', K: 'C', S: 'V', grab: 'Z+X', counter: 'Z+C', jump: 'Space' };

const root = () => document.getElementById('ui')!;
const h = (html: string) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild as HTMLElement; };
const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
const pips = (on: number, total: number) => Array.from({ length: total }, (_, i) => `<i class="pip${i < on ? ' on' : ''}"></i>`).join('');
let layer: HTMLElement | null = null;
function setLayer(el: HTMLElement) { layer?.remove(); layer = el; root().appendChild(el); }

/** The UI is drawn for a 1280x720 (or larger) screen. On anything smaller - phones above all - the whole layer is
 *  scaled down as one piece and kept inside the safe area (notch, home indicator), so every screen keeps its layout. */
export const LAY = { s: 1, left: 0, top: 0 };
let probe: HTMLElement | undefined;
export function layout() {
  if (!probe) { probe = document.createElement('div'); probe.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)'; document.body.appendChild(probe); }
  const cs = getComputedStyle(probe); const n = (v: string) => parseFloat(v) || 0;
  const l = n(cs.paddingLeft), r = n(cs.paddingRight), t = n(cs.paddingTop), b = n(cs.paddingBottom);
  const w = Math.max(1, innerWidth - l - r), hh = Math.max(1, innerHeight - t - b);
  const s = Math.min(1, w / 1280, hh / 720);
  LAY.s = s; LAY.left = l; LAY.top = t;
  const e = root().style; e.left = l + 'px'; e.top = t + 'px'; e.right = e.bottom = 'auto'; e.width = w / s + 'px'; e.height = hh / s + 'px'; e.transformOrigin = '0 0'; e.transform = s < 1 ? `scale(${s})` : '';
  const d = document.documentElement.style; d.setProperty('--vw', w / s / 100 + 'px'); d.setProperty('--vh', hh / s / 100 + 'px'); d.setProperty('--u', Math.min(7, Math.max(3.3, innerHeight / 100)) + 'px'); d.setProperty('--s', String(s));
}

export function showLoading() {
  setLayer(h(`<div class="screen loading">
    <div class="wordmark sm">SPIRIT ARENA</div>
    <div class="progress"><i id="ld"></i></div>
    <p class="muted">공격은 잡기를, 잡기는 가드를, 가드는 공격을 이긴다.</p>
  </div>`));
}
export function setLoading(p: number) { const e = document.getElementById('ld'); if (e) e.style.width = (p * 100).toFixed(0) + '%'; }

function btn(label: string, fn: () => void, cls = '') {
  const b = h(`<button class="btn ${cls}">${label}</button>`) as HTMLButtonElement;
  b.onclick = fn; return b;
}
function sheet(eyebrow: string, title: string, body: string, cls = '') {
  return `<div class="sheet ${cls}"><header><span class="eyebrow">${eyebrow}</span><h2>${title}</h2></header>${body}<footer class="foot"></footer></div>`;
}

export function screens(g: Game) {
  const click = () => g.fx.sfx('click_002');
  return {
    title() {
      setLayer(h(`<div class="screen title">
        <div class="title-block">
          <span class="eyebrow">3D ARENA FIGHTER</span>
          <div class="wordmark">SPIRIT ARENA</div>
          <div class="rule"></div>
          <div class="sub">스피릿 아레나</div>
        </div>
        <div class="press"><span class="k">PRESS ANY KEY</span><span class="t">TAP TO START</span></div>
        <div class="ver">v0.5 · MOONLIT COURT</div>
      </div>`));
      layer!.onclick = () => g.go('menu');
    },
    menu() {
      const el = h(`<div class="screen menu">
        <div class="menu-col">
          <div class="wordmark md">SPIRIT ARENA</div>
          <nav class="menu-list"></nav>
        </div>
        <div class="menu-foot"><span>v0.5</span><span>방향키 이동 · X 손 · C 발 · Z 가드 · Space 점프</span></div>
      </div>`);
      const list = el.querySelector('.menu-list')!;
      const item = (n: string, label: string, desc: string, fn: () => void) => {
        const a = h(`<button class="menu-item"><span class="no">${n}</span><span class="lb">${label}</span><span class="ds">${desc}</span></button>`);
        a.onclick = () => { click(); fn(); }; list.append(a);
      };
      item('01', 'AI 대전', '최대 8인 서바이벌', () => { g.match.practice = false; g.go('setup'); });
      item('02', '연습 모드', '무한 체력 · 히트박스 표시', () => { g.match.practice = true; g.go('select'); });
      item('03', '기술표', '비전서별 연계 트리', () => g.go('moves'));
      item('04', '설정', '사운드 · 카메라 · 그래픽', () => g.go('settings'));
      item('05', '크레딧', '사용한 에셋과 라이선스', () => g.go('credits'));
      setLayer(el);
    },
    setup() {
      const el = h(`<div class="screen panel-screen">${sheet('MATCH SETUP', '대전 설정', `
        <div class="field"><label>모드</label><div class="seg"><span class="on">개인전 · 서바이벌</span></div></div>
        <div class="field"><label>맵</label><div class="seg" id="map"></div></div>
        <div class="field"><label>AI 인원</label><div class="seg" id="ai"></div></div>
        <div class="field"><label>난이도</label><div class="seg" id="dif"></div></div>
        <div class="field"><label>승리 조건</label><div class="seg" id="wins"></div></div>
        <p class="note"><b>${MAP.cur.name}</b> — ${MAP.cur.desc}</p>`)}</div>`);
      const seg = (id: string, items: [string, any][], get: () => any, set: (v: any) => void) => {
        const s = el.querySelector('#' + id)!; s.innerHTML = '';
        for (const [lab, v] of items) { const sp = h(`<span class="${get() === v ? 'on' : ''}">${lab}</span>`); sp.onclick = () => { click(); set(v); this.setup(); }; s.append(sp); }
      };
      setLayer(el);
      seg('map', Object.values(MAPS).map((m) => [m.name, m.id]), () => MAP.cur.id, (v) => g.setMap(v));
      if (MAP.cur.duel) el.querySelector('#ai')!.innerHTML = '<span class="on">1명 · 1:1 전용</span>';
      else seg('ai', [1, 2, 3, 5, 7].map((n) => [`${n}명`, n]), () => g.match.ai, (v) => (g.match.ai = v));
      seg('dif', (Object.keys(AI_LEVELS) as Difficulty[]).map((k) => [AI_LEVELS[k].label, k]), () => g.match.difficulty, (v) => (g.match.difficulty = v));
      seg('wins', [1, 2, 3].map((n) => [`${n}승 선취`, n]), () => g.match.wins, (v) => (g.match.wins = v));
      el.querySelector('.foot')!.append(btn('뒤로', () => { click(); g.go('menu'); }, 'ghost'), btn('캐릭터 선택', () => { click(); g.go('select'); }, 'primary'));
    },
    select() {
      const p = g.pcfg; const st = STYLES[p.style];
      const el = h(`<div class="screen select">${sheet('FIGHTER', '캐릭터 · 비전서', `
        ${g.match.practice ? '<div class="field"><label>맵</label><div class="seg wrap" id="pmap"></div></div>' : ''}
        <div class="field"><label>체형</label><div class="seg" id="body"></div></div>
        <div class="field"><label>색상</label><div class="swatches" id="sw"></div></div>
        <div class="styles" id="style"></div>
        <div class="desc">
          <div class="desc-head"><i style="background:${hex(st.color)};color:${hex(st.color)}"></i><b>${st.name}</b><span>${st.concept}</span></div>
          <p>${st.desc}</p>
          <ul class="traits">${st.traits.map((t) => `<li>${t}</li>`).join('')}</ul>
        </div>
        <div class="stats">${statBars(p.style)}</div>`, 'side')}</div>`);
      setLayer(el);
      const pm = el.querySelector('#pmap');
      if (pm) for (const m of Object.values(MAPS)) { const s2 = h(`<span class="${MAP.cur.id === m.id ? 'on' : ''}">${m.name}</span>`); s2.onclick = () => { click(); g.setMap(m.id); g.refreshSelect(); this.select(); }; pm.append(s2); }
      const body = el.querySelector('#body')!;
      for (const [lab, v] of [['남', 'male'], ['여', 'female']] as const) { const s2 = h(`<span class="${p.body === v ? 'on' : ''}">${lab}</span>`); s2.onclick = () => { click(); if (p.body !== v && (p.suit === SUITS[0] || p.suit === SUITS[1])) p.suit = v === 'female' ? SUITS[1] : SUITS[0]; p.body = v; g.refreshSelect(); this.select(); }; body.append(s2); }
      const sw = el.querySelector('#sw')!;
      for (const c of SUITS) { const s2 = h(`<i class="${p.suit === c ? 'on' : ''}" style="background:${hex(c)}"></i>`); s2.onclick = () => { click(); p.suit = c; g.refreshSelect(); this.select(); }; sw.append(s2); }
      const sty = el.querySelector('#style')!;
      for (const id of STYLE_IDS) {
        const d = STYLES[id]; const open = OPEN_STYLES.includes(id);
        const c = h(`<button class="tile ${p.style === id ? 'on' : ''} ${open ? '' : 'locked'}" style="--c:${hex(d.color)}" ${open ? '' : 'disabled'}><b>${d.name}</b><small>${open ? d.concept : '준비 중'}</small></button>`);
        if (open) c.onclick = () => { click(); p.style = id; g.refreshSelect(); this.select(); };
        sty.append(c);
      }
      el.querySelector('.foot')!.append(btn('기술표', () => { click(); screens(g).moves(false, p.style, true); }, 'ghost'), btn('뒤로', () => { click(); g.go(g.match.practice ? 'menu' : 'setup'); }, 'ghost'), btn(g.match.practice ? '연습 시작' : '대전 시작', () => { g.fx.sfx('confirmation_001'); g.startMatch(); }, 'primary'));
    },
    hud() {
      const el = h(`<div class="screen hud">
        <div class="p1">
          <div class="pf"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" class="rg-bg"/><circle cx="50" cy="50" r="46" class="rg" pathLength="100" stroke-dasharray="0 100"/></svg><img class="face"><kbd class="okey">O</kbd></div>
          <div class="p1-info">
            <div class="p1-head"><span class="nm"></span><span class="st"></span></div>
            <div class="hp"><b></b><i></i><span class="hpn"></span></div>
            <div class="mp"><i></i></div>
            <div class="p1-sub"><span class="ev"></span><span class="g-text">SPIRIT</span></div>
          </div>
        </div>
        <div class="center"><div class="rnd"></div><div class="time"></div></div>
        <div class="enemies"></div>
        <div class="skills"><div class="sk" id="sk1"><kbd>1</kbd>돌진 베기<small>MP 80</small></div><div class="sk" id="sk2"><kbd>2</kbd>회오리 베기<small>MP 120</small></div></div>
        <div class="minimap"><canvas width="132" height="132"></canvas></div>
        <div class="combo"></div>
        <div class="guide"></div>
        <div class="keys">방향키(또는 IJKL) 이동 · Space 점프(2단) · X 손 · C 발/기상공격 · Z 가드 · Z+X 잡기 · Z+C 반격 · X+C 회피 · V 연타 난무(판당 1회) · 방향키 두 번 대시 (+X 아머 어택 / +C 날라차기) · O 변신 · Esc 일시정지</div>
        ${g.match.practice ? '<div class="practice">PRACTICE · 무한 체력 · F1 히트박스 · H 사용법</div>' : ''}
      </div>`);
      setLayer(el);
    },
    pause() {
      const el = h(`<div class="screen panel-screen dim">${sheet('PAUSED', '일시정지', '<div class="col"></div>', 'narrow')}</div>`);
      el.querySelector('.col')!.append(
        btn('계속하기', () => { click(); g.go('game'); }, 'primary block'),
        btn('기술표', () => { click(); g.screen = 'pause'; screens(g).moves(true); }, 'block'),
        btn('설정', () => { click(); screens(g).settings(true); }, 'block'),
        btn('메인 메뉴', () => { click(); g.go('menu'); }, 'ghost block'),
      );
      setLayer(el);
    },
    round() {
      const w = g.roundWinner;
      const rows = g.fighters.map((f) => `<tr class="${f === w ? 'win' : ''}"><td><i class="sq" style="background:${hex(f.opts.suit)};color:${hex(f.opts.suit)}"></i>${f.name}</td><td>${pips(f.roundWins, g.match.wins)}</td><td class="num">${f.stats.dmg}</td><td class="num">${f.stats.kos}</td><td class="num">${f.stats.ringouts}</td></tr>`).join('');
      const el = h(`<div class="screen panel-screen dim">${sheet(`ROUND ${g.round}`, w ? `${w.name} 승리` : '무승부', `
        <table><tr><th>파이터</th><th>라운드</th><th class="num">준 피해</th><th class="num">K.O.</th><th class="num">링아웃</th></tr>${rows}</table>`)}</div>`);
      el.querySelector('.foot')!.append(btn('다음 라운드', () => { click(); g.round++; g.startRound(); }, 'primary'));
      setLayer(el);
    },
    result() {
      const sorted = g.fighters.slice().sort((a, b) => b.roundWins - a.roundWins || b.stats.dmg - a.stats.dmg);
      const champ = sorted[0];
      const rows = sorted.map((f, i) => `<tr class="${i === 0 ? 'win' : ''}"><td class="num rank">${i + 1}</td><td><i class="sq" style="background:${hex(f.opts.suit)};color:${hex(f.opts.suit)}"></i>${f.name}${f.isPlayer ? '<span class="you">YOU</span>' : ''}</td><td class="muted">${f.style.name}</td><td class="num">${f.roundWins}</td><td class="num">${f.stats.dmg}</td><td class="num">${f.stats.taken}</td><td class="num">${f.stats.maxCombo}</td><td class="num">${f.stats.kos}</td><td class="num">${f.stats.ringouts}</td></tr>`).join('');
      const el = h(`<div class="screen panel-screen dim">${sheet('MATCH RESULT', champ.isPlayer ? '우승' : `${champ.name} 우승`, `
        <table><tr><th class="num">#</th><th>파이터</th><th>비전서</th><th class="num">승리</th><th class="num">준 피해</th><th class="num">받은 피해</th><th class="num">최대 콤보</th><th class="num">K.O.</th><th class="num">링아웃</th></tr>${rows}</table>`, 'wide')}</div>`);
      el.querySelector('.foot')!.append(btn('메인 메뉴', () => { click(); g.go('menu'); }, 'ghost'), btn('재대전', () => { click(); g.startMatch(); }, 'primary'));
      setLayer(el);
    },
    moves(fromPause = false, styleId = g.pcfg.style, fromSelect = false) {
      const st = STYLES[styleId];
      const label: Record<string, string> = { light: '경직', launch: '띄우기', knockdown: '다운' };
      const rows: string[] = [];
      const walk = (id: string, path: string, depth: number, seen: Set<string>) => {
        const m = MOVES[id]; if (!m || seen.has(id) || depth > 4) return;
        const tags = [m.hitCount ? `${m.hitCount}타` : '', m.armor ? '슈퍼아머' : '', m.guardBreak ? '가드불가' : '', m.low ? '하단' : '', m.special === 'teleport' ? '순간이동' : '', m.special === 'smoke' ? '혼란' : '', m.special === 'cmdgrab' ? '잡기' : ''].filter(Boolean).join(' · ');
        rows.push(`<tr class="d${depth}"><td class="k">${path.split(' ').map((k) => `<kbd>${k}</kbd>`).join('')}</td><td><span class="indent" style="width:${depth * 16}px"></span>${m.name}</td><td class="num">${m.dmg ? m.dmg * (m.hitCount ?? 1) : '–'}</td><td>${m.dmg ? label[m.type] : '–'}</td><td class="muted">${tags || ''}</td></tr>`);
        const ns = new Set(seen); ns.add(id);
        if (m.next) for (const [k, n] of Object.entries(m.next)) walk(n!, path + ' ' + KEY[k], depth + 1, ns);
      };
      walk(st.J, 'X', 0, new Set()); walk(st.K, 'C', 0, new Set());
      rows.push(`<tr class="d0"><td class="k"><kbd>V</kbd><kbd>V</kbd><kbd>…</kbd></td><td>난무 — 돌진 → 8연타 → 마무리</td><td class="num">${Object.values(MOVES).filter((m) => m.nanmu).reduce((a, m) => a + m.dmg, 0)}</td><td>다운</td><td class="muted">V 연타 · 판당 1회 · 슈퍼아머 · 맞아야 이어짐</td></tr>`);
      walk(st.dashJ, '대시 X', 0, new Set(['x'])); walk(st.dashK, '대시 C', 0, new Set(['x'])); walk(st.air, '공중 X', 0, new Set());
      const tabs = OPEN_STYLES.map((id) => `<span class="${id === styleId ? 'on' : ''}" data-id="${id}" style="--c:${hex(STYLES[id].color)}">${STYLES[id].name}</span>`).join('');
      const el = h(`<div class="screen panel-screen ${fromPause ? 'dim' : ''}">${sheet('MOVE LIST', '기술표', `
        <nav class="tabs">${tabs}</nav>
        <div class="cols2">
          <div class="scroll"><table class="mv"><tr><th>입력</th><th>기술</th><th class="num">피해</th><th>결과</th><th>특성</th></tr>${rows.join('')}</table></div>
          <aside>
            <h3>추천 연계</h3><ol class="routes">${st.combos.map((c) => `<li>${c}</li>`).join('')}</ol>
            <h3>비전서 특성</h3><ul class="routes">${st.traits.map((t) => `<li>${t}</li>`).join('')}</ul>
            <h3>공통</h3><ul class="routes"><li>X+C 회피기(라운드당 2회) · Z+X 잡기(엎어치기: 뒤로 던짐) · Z+C 반격 · Z 가드 · 다운 중 C 기상 공격 · Space 2번 2단 점프</li><li>공격 &gt; 잡기 &gt; 가드·반격 &gt; 공격</li><li>변신 중 X X X 정령검 · 1 돌진 베기 · 2 회오리 베기</li></ul>
          </aside>
        </div>`, 'wide')}</div>`);
      el.querySelectorAll('.tabs span').forEach((sp) => ((sp as HTMLElement).onclick = () => { click(); screens(g).moves(fromPause, (sp as HTMLElement).dataset.id!, fromSelect); }));
      el.querySelector('.foot')!.append(btn('뒤로', () => { click(); fromSelect ? screens(g).select() : fromPause ? screens(g).pause() : g.go('menu'); }, 'ghost'));
      setLayer(el);
    },
    settings(fromPause = false) {
      const s = g.settings;
      const el = h(`<div class="screen panel-screen ${fromPause ? 'dim' : ''}">${sheet('SETTINGS', '설정', `
        <div class="field"><label>효과음</label><input type="range" min="0" max="1" step="0.05" value="${s.volume}" id="vol"></div>
        <div class="field"><label>카메라 감도</label><input type="range" min="0.3" max="2" step="0.1" value="${s.sens}" id="sens"></div>
        <div class="field"><label>그래픽</label><div class="seg" id="gq">${[['auto', '자동'], ['high', '높음'], ['mid', '중간'], ['low', '낮음 · 원격용']].map(([k, n]) => `<span data-q="${k}" class="${(s.autoQuality ? 'auto' : s.quality) === k ? 'on' : ''}">${n}</span>`).join('')}</div></div>
        <div class="field"><label>그림자</label><div class="seg" id="sh"><span class="${s.shadows ? 'on' : ''}">켜기</span><span class="${s.shadows ? '' : 'on'}">끄기</span></div></div>
        <div class="field"><label>히트박스</label><div class="seg" id="hb"><span class="${s.showHitboxes ? 'on' : ''}">표시</span><span class="${s.showHitboxes ? '' : 'on'}">숨김</span></div></div>
        <div class="field top"><label>조작</label><dl class="keymap">
          <dt><kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd></dt><dd>이동 (원격 접속 등으로 방향키가 안 되면 <kbd>I</kbd><kbd>J</kbd><kbd>K</kbd><kbd>L</kbd> 또는 숫자패드 8·4·2·6)</dd><dt><kbd>Space</kbd></dt><dd>점프 (공중에서 한 번 더: 2단 점프)</dd><dt><kbd>→</kbd><kbd>→</kbd></dt><dd>대시 (같은 방향키 두 번, 누른 채 유지)</dd>
          <dt>터치</dt><dd>왼쪽 조이스틱 이동 (빠르게 두 번 밀면 대시) · 오른쪽 버튼 공격 · 빈 곳을 끌어 시점 회전</dd>
          <dt><kbd>Z</kbd></dt><dd>가드</dd><dt><kbd>X</kbd></dt><dd>손 공격</dd><dt><kbd>C</kbd></dt><dd>발 공격 · 다운 중 기상 공격</dd>
          <dt><kbd>Z</kbd><kbd>X</kbd></dt><dd>잡기</dd><dt><kbd>Z</kbd><kbd>C</kbd></dt><dd>반격기</dd><dt><kbd>X</kbd><kbd>C</kbd></dt><dd>회피기 (라운드당 2회)</dd>
          <dt><kbd>V</kbd></dt><dd>난무 — 돌진 후 연타로 10콤보 (판당 1회)</dd><dt>대시 + <kbd>X</kbd> / <kbd>C</kbd></dt><dd>아머 어택 / 날라차기 (즉시 다운)</dd><dt><kbd>O</kbd></dt><dd>변신</dd><dt><kbd>Q</kbd><kbd>E</kbd></dt><dd>카메라 회전</dd>
        </dl></div>`)}</div>`);
      setLayer(el);
      (el.querySelector('#vol') as HTMLInputElement).oninput = (e: any) => { s.volume = +e.target.value; g.fx.setVolume(s.volume); };
      (el.querySelector('#sens') as HTMLInputElement).oninput = (e: any) => { s.sens = +e.target.value; };
      el.querySelectorAll('#sh span').forEach((sp, i) => ((sp as HTMLElement).onclick = () => { s.shadows = i === 0; g.renderer.shadowMap.enabled = s.shadows; g.scene.traverse((o: any) => { if (o.material) o.material.needsUpdate = true; }); this.settings(fromPause); }));
      el.querySelectorAll('#gq span').forEach((sp) => ((sp as HTMLElement).onclick = () => { const q = (sp as HTMLElement).dataset.q!; s.autoQuality = q === 'auto'; if (q !== 'auto') g.setQuality(q as any); this.settings(fromPause); }));
      el.querySelectorAll('#hb span').forEach((sp, i) => ((sp as HTMLElement).onclick = () => { s.showHitboxes = i === 0; this.settings(fromPause); }));
      el.querySelector('.foot')!.append(btn('뒤로', () => { click(); fromPause ? screens(g).pause() : g.go('menu'); }, 'ghost'));
    },
    credits() {
      const el = h(`<div class="screen panel-screen">${sheet('CREDITS', '크레딧', `<dl class="credits">
        <dt>캐릭터 · 애니메이션</dt><dd>Quaternius — Universal Animation Library 1·2 (CC0)</dd>
        <dt>무술 모션캡처</dt><dd>CMU Graphics Lab Motion Capture Database · glTF 변환 RancidMilk</dd>
        <dt>효과음 · 이펙트 · 환경</dt><dd>Kenney — Impact Sounds, Interface Sounds, Particle Pack, Nature Kit (CC0)</dd>
        <dt>글꼴</dt><dd>Pretendard · Oswald (SIL OFL 1.1)</dd>
        <dt>엔진</dt><dd>three.js · Vite</dd></dl>`)}</div>`);
      el.querySelector('.foot')!.append(btn('뒤로', () => { click(); g.go('menu'); }, 'ghost'));
      setLayer(el);
    },
  };
}

function statBars(style: string) {
  const s = STYLES[style].stats;
  return Object.entries(s).map(([k, v]) => `<div class="st"><span>${k}</span><div class="segbar">${pips(v, 5)}</div></div>`).join('');
}

// ---------------------------------------------------------------- HUD / overlays
const tags = new Map<Fighter, HTMLElement>();
export function clearTags() { for (const t of tags.values()) t.remove(); tags.clear(); }
const v3 = new THREE.Vector3();
function project(g: Game, p: THREE.Vector3) { v3.copy(p).project(g.cam); return { x: ((v3.x + 1) / 2 * innerWidth - LAY.left) / LAY.s, y: ((1 - v3.y) / 2 * innerHeight - LAY.top) / LAY.s, vis: v3.z < 1 }; }

export function updateHud(g: Game) {
  const inGame = ['game', 'pause', 'round', 'result'].includes(g.screen);
  for (const f of g.fighters) {
    f.hpView += (f.hp - f.hpView) * 0.08;
    let t = tags.get(f);
    if (!t) { t = h(`<div class="tag"><div class="n"><i></i><span></span></div><div class="b"><i></i></div></div>`); root().appendChild(t); tags.set(f, t); }
    const show = inGame && !f.isPlayer && f.state !== 'out';
    t.style.display = show ? '' : 'none';
    if (show) {
      const head = f.bones.Head.getWorldPosition(new THREE.Vector3()); head.y += 0.72;
      const p = project(g, head); t.style.transform = `translate(${p.x}px,${p.y}px)`; t.style.visibility = p.vis ? 'visible' : 'hidden';
      (t.querySelector('.n span') as HTMLElement).textContent = f.name + (!f.alive ? ' · K.O.' : '');
      (t.querySelector('.n') as HTMLElement).style.setProperty('--c', hex(f.opts.suit));
      (t.querySelector('.b i') as HTMLElement).style.width = (f.hp / f.maxHp * 100) + '%';
      t.classList.toggle('spirit', f.transformT > 0);
    }
  }
  if (g.screen !== 'game' && g.screen !== 'pause') return;
  const L = layer!; const P = g.player; if (!P || !L.querySelector('.p1')) return;
  (L.querySelector('.p1 .nm') as HTMLElement).textContent = P.name;
  (L.querySelector('.p1 .st') as HTMLElement).textContent = STYLES[P.opts.style].name;
  (L.querySelector('.p1') as HTMLElement).style.setProperty('--c', hex(P.opts.suit));
  (L.querySelector('.p1 .hp i') as HTMLElement).style.width = (P.hp / P.maxHp * 100) + '%';
  (L.querySelector('.p1 .hp b') as HTMLElement).style.width = (P.hpView / P.maxHp * 100) + '%';
  L.querySelector('.p1 .hp')!.classList.toggle('low', P.hp / P.maxHp < 0.25);
  (L.querySelector('.p1 .mp i') as HTMLElement).style.width = (P.mp / P.maxMp * 100) + '%';
  (L.querySelector('.p1 .ev') as HTMLElement).innerHTML = `<span>회피</span>${pips(P.evades, 2)}<span style="margin-left:10px">난무</span>${pips(P.nanmu, 1)}`;
  (L.querySelector('.p1 .hpn') as HTMLElement).textContent = String(Math.ceil(P.hp));
  (L.querySelector('.keys') as HTMLElement).classList.toggle('hide', !g.match.practice && g.timer < 94);
  (L.querySelector('.rnd') as HTMLElement).textContent = g.match.practice ? 'PRACTICE' : `ROUND ${g.round}`;
  (L.querySelector('.time') as HTMLElement).textContent = g.match.practice ? '—' : String(Math.max(0, g.timer)).padStart(2, '0');
  const en = L.querySelector('.enemies') as HTMLElement;
  const others = g.fighters.filter((f) => f !== P);
  const card = (f: Fighter, side: string) => `<div class="card ${side}" data-id="${f.id}" style="--c:${hex(f.opts.suit)}"><img src="${(f as any).portrait}"><div class="ci"><span class="cn">${f.name}</span><div class="cb hpb"><em></em></div><div class="cb spb"><em></em></div><span class="w"></span></div></div>`;
  if (en.querySelectorAll('.card').length !== others.length) {
    const left = others.filter((_, i) => i % 2 === 0).reverse(), right = others.filter((_, i) => i % 2 === 1);
    en.innerHTML = `<div class="side l">${left.map((f) => card(f, 'l')).join('')}</div><div class="gap"></div><div class="side r">${right.map((f) => card(f, 'r')).join('')}</div>`;
  }
  others.forEach((f) => {
    const c = en.querySelector(`.card[data-id="${f.id}"]`) as HTMLElement;
    (c.querySelector('.hpb em') as HTMLElement).style.width = (f.hp / f.maxHp * 100) + '%';
    (c.querySelector('.spb em') as HTMLElement).style.width = (f.mp / f.maxMp * 100) + '%';
    const w = pips(f.roundWins, g.match.wins); const we = c.querySelector('.w') as HTMLElement; if (we.innerHTML !== w) we.innerHTML = w;
    c.classList.toggle('dead', !f.alive);
  });
  const gv = P.transformT > 0 ? P.transformT / 15 * 100 : P.gauge;
  (L.querySelector('.p1 .rg') as SVGCircleElement).setAttribute('stroke-dasharray', `${gv} 100`);
  L.querySelector('.p1')!.classList.toggle('full', P.gauge >= 100 || P.transformT > 0);
  const face = L.querySelector('.p1 .face') as HTMLImageElement; if (face.dataset.id !== String(P.id)) { face.src = (P as any).portrait; face.dataset.id = String(P.id); }
  L.querySelector('.skills')!.classList.toggle('show', P.transformT > 0);
  L.querySelector('#sk1')!.classList.toggle('ok', P.mp >= 80); L.querySelector('#sk2')!.classList.toggle('ok', P.mp >= 120);
  const combo = L.querySelector('.combo') as HTMLElement;
  if (P.combo >= 2) { const html = `<b>${P.combo}</b><span>HIT!!</span><small>${P.comboDmg} DAMAGE</small>`; if (combo.innerHTML !== html) combo.innerHTML = html; combo.classList.add('on'); } else combo.classList.remove('on');
  updateGuide(g, P, L.querySelector('.guide') as HTMLElement);
  drawMinimap(g, L.querySelector('.minimap canvas') as HTMLCanvasElement);
}

/** live combo guide: current technique + the inputs that continue it (lit while the window is open) */
function updateGuide(g: Game, P: Fighter, el: HTMLElement) {
  if (!g.settings.guide) { el.style.display = 'none'; return; }
  const st = STYLES[P.opts.style]; const key = (k: string) => `<kbd>${KEY[k] ?? k}</kbd>`;
  let html: string;
  if (P.state === 'attack' && P.move) {
    const m = P.move; const open = P.cancelWindow();
    const nx = m.next ? Object.entries(m.next).map(([k, id]) => `<span class="nx ${open ? 'open' : ''}">${key(k)}${MOVES[id!].name}</span>`).join('') : '<span class="nx end">마무리</span>';
    const grab = st.comboGrab && P.hitDone.size > 0 ? `<span class="nx open"><kbd>Z</kbd><kbd>X</kbd>잡기 캔슬</span>` : '';
    html = `<div class="cur"><i style="background:${hex(st.color)};color:${hex(st.color)}"></i>${m.name}</div><div class="row2">${nx}${grab}</div>`;
  } else {
    html = `<div class="cur idle"><i style="background:${hex(st.color)};color:${hex(st.color)}"></i>${st.name}</div><div class="row2"><span class="nx">${key('J')}${MOVES[st.J].name}</span><span class="nx">${key('K')}${MOVES[st.K].name}</span><span class="nx ${P.nanmu > 0 ? '' : 'end'}">${key('S')}난무 ${P.nanmu > 0 ? '(연타)' : '(사용함)'}</span><span class="nx"><kbd>대시</kbd>${key('J')}아머 어택</span><span class="nx"><kbd>대시</kbd>${key('K')}날라차기</span></div>`;
  }
  if (el.innerHTML !== html) el.innerHTML = html;
}

function drawMinimap(g: Game, c: HTMLCanvasElement) {
  const x = c.getContext('2d')!; const W = c.width, R = W / 2 - 4; const map = MAP.cur; const a = g.camYaw;
  const s = R / (map.id === 'stairs' ? 10.2 : map.view);
  x.clearRect(0, 0, W, W);
  x.fillStyle = 'rgba(14,16,38,.6)'; x.beginPath(); x.arc(W / 2, W / 2, R, 0, 7); x.fill();
  if (map.id === 'stairs') {
    // world -> minimap (rotates with the camera); tiers get brighter towards the top
    x.save(); x.beginPath(); x.arc(W / 2, W / 2, R, 0, 7); x.clip();
    x.setTransform(-s * Math.cos(a), s * Math.sin(a), -s * Math.sin(a), -s * Math.cos(a), W / 2, W / 2);
    const { W: w, D: d, N: n, TD: td } = STAIR;
    for (let k = 0; k < n; k++) { x.fillStyle = `rgba(255,200,87,${0.34 - k * 0.06})`; x.fillRect(-w / 2, -d / 2 + k * td, w, td); }
    x.strokeStyle = 'rgba(255,77,120,.85)'; x.lineWidth = 1.5 / s; x.strokeRect(-w / 2, -d / 2, w, d);
    x.restore();
  } else {
    const wall = map.railH === Infinity;
    x.strokeStyle = wall ? 'rgba(95,227,255,.8)' : 'rgba(255,77,120,.75)'; x.lineWidth = 1.5; x.beginPath(); x.arc(W / 2, W / 2, (wall ? 6.5 : 9) * s, 0, 7); x.stroke();
    x.strokeStyle = 'rgba(95,227,255,.45)'; x.lineWidth = 1; x.beginPath(); x.arc(W / 2, W / 2, (wall ? 1.5 : 2.5) * s, 0, 7); x.stroke();
  }
  for (const f of g.fighters) {
    if (f.state === 'out') continue;
    const px = f.pos.x, pz = f.pos.z;
    const rx = px * Math.cos(-a) - pz * Math.sin(-a), rz = px * Math.sin(-a) + pz * Math.cos(-a);
    const cx = W / 2 - rx * s, cy = W / 2 - rz * s;
    if (f.isPlayer) { x.fillStyle = '#F2F1EC'; x.beginPath(); x.moveTo(cx, cy - 6); x.lineTo(cx + 4.5, cy + 4); x.lineTo(cx - 4.5, cy + 4); x.closePath(); x.fill(); }
    else { x.fillStyle = f.alive ? hex(f.opts.suit) : 'rgba(242,241,236,.25)'; x.fillRect(cx - 3, cy - 3, 6, 6); }
  }
}

let bannerEl: HTMLElement | null = null;
export function banner(text: string, kind: string) {
  bannerEl?.remove();
  bannerEl = h(`<div class="banner ${kind}"><span>${text}</span></div>`); root().appendChild(bannerEl);
  const e = bannerEl; setTimeout(() => e.remove(), kind === 'round' ? 1400 : 1500);
}
const MAX_FLOATERS = 40;
function capFloaters() { const all = document.querySelectorAll('.dmg,.pop'); for (let i = 0; i < all.length - MAX_FLOATERS; i++) all[i].remove(); }
export function damageNumber(g: Game, at: THREE.Vector3, n: number, mine: boolean, w = 1, color?: string) {
  const p = project(g, at);
  const recv = g.player && !mine && g.player.lastHitAt === g.tickN && at.distanceTo(g.player.pos) < 2.5;
  const d = h(`<div class="dmg w${w} ${recv ? 'recv' : ''} ${color ? 'dot' : ''}">${n}</div>`);
  d.style.left = p.x + 'px'; d.style.top = p.y + 'px'; root().appendChild(d); capFloaters(); setTimeout(() => d.remove(), 900);
}
export function popText(g: Game, f: Fighter, text: string, _color: string) {
  const head = f.bones.Head.getWorldPosition(new THREE.Vector3()); head.y += 0.9;
  const p = project(g, head); const d = h(`<div class="pop">${text}</div>`);
  d.style.left = p.x + 'px'; d.style.top = p.y + 'px'; root().appendChild(d); capFloaters(); setTimeout(() => d.remove(), 900);
}
