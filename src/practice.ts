// Practice mode extras: a closable how-to panel for the chosen style, and a training partner that can be told what to do.
import type { Game } from './game';
import { Ctrl, Fighter, emptyCtrl } from './fighter';
import { STYLES } from './moves';

export type DummyMode = 'idle' | 'attack' | 'guard';
const MODES: [DummyMode, string, string][] = [
  ['idle', '대기', '가만히 서 있는다 — 콤보 연습'],
  ['attack', '공격', '다가와서 한 대씩 친다 — Z+C 반격 · Z 가드 · X+C 회피 연습'],
  ['guard', '가드', '다가와서 계속 막는다 — Z+X 잡기(엎어치기) 연습'],
];
/** how often the partner throws its single strike, in ticks */
const ATTACK_EVERY = 84;

let root: HTMLElement | undefined; let shown = false; let sig = '';
const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
const keys = (s: string) => s.replace(/(^|[\s(·→])((?:대시 )?[XCVZ](?:\+[XC])?)(?=[\s(·,]|$)/g, (_m, a, k) => `${a}<kbd>${k}</kbd>`);

export function initPractice(g: Game) {
  const el = document.createElement('div'); el.id = 'practice'; root = el;
  el.innerHTML = `<div class="pbar"><span class="lab">연습 상대</span>${MODES.map(([id, n], i) => `<button data-mode="${id}">${n}<kbd>F${i + 2}</kbd></button>`).join('')}<i></i><button data-guide="1">사용법<kbd>H</kbd></button><p class="tip"></p></div>
    <aside class="pguide"><header><b class="nm"></b><span class="cc"></span><button class="x" aria-label="닫기">✕</button></header><div class="body scroll"></div></aside>`;
  document.body.appendChild(el);
  const sfx = () => g.fx.sfx('click_002');
  el.querySelectorAll<HTMLElement>('[data-mode]').forEach((b) => b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); sfx(); setDummy(g, b.dataset.mode as DummyMode); }));
  const toggle = (e: Event) => { e.preventDefault(); e.stopPropagation(); sfx(); g.guideOpen = !g.guideOpen; };
  el.querySelector('[data-guide]')!.addEventListener('pointerdown', toggle);
  el.querySelector('.x')!.addEventListener('pointerdown', toggle);
}

/** pressing the active mode again turns it off */
export function setDummy(g: Game, m: DummyMode) { g.dummy = g.dummy === m ? 'idle' : m; g.dummyT = 40; }

/** F2 = idle, F3 = attack, F4 = guard, H = how-to panel. Returns true when the key was used. */
export function practiceKey(g: Game, code: string) {
  if (!g.match.practice || g.screen !== 'game') return false;
  if (code === 'KeyH') { g.guideOpen = !g.guideOpen; return true; }
  const i = ['F2', 'F3', 'F4'].indexOf(code); if (i < 0) return false;
  if (i === 0) { g.dummy = 'idle'; } else setDummy(g, MODES[i][0]);
  return true;
}

function guideHtml(g: Game) {
  const st = STYLES[g.pcfg.style];
  const li = (a: string[]) => a.map((c) => `<li>${keys(c)}</li>`).join('');
  return `<p class="desc">${st.desc}</p>
    <h4>기본 조작</h4><ul>${li(['X 손 · C 발 · Z 가드 · Space 점프(2단)', 'Z+X 잡기(엎어치기: 뒤로 던짐) · Z+C 반격 · X+C 회피', '가드 중에는 방향을 바꿀 수 없다 (풀고 → 돌고 → 다시 가드)', '공격은 바라보는 방향으로 나간다 (자동 조준 없음)', '공격 중 방향키: 다음 공격을 최대 45° 꺾는다', '방향 두 번: 대시 → 대시 X 아머 어택 / 대시 C 날라차기', 'V 연타: 난무 (판당 1회) · O 변신'])}</ul>
    <h4>${st.name} 연계</h4><ol>${li(st.combos)}</ol>
    <h4>특성</h4><ul>${li(st.traits)}</ul>
    <h4>상성</h4><ul><li>공격 &gt; 잡기 &gt; 가드·반격 &gt; 공격</li><li>상대 <b>공격</b> 모드: 맞기 직전에 ${keys('Z+C')} 반격</li><li>상대 <b>가드</b> 모드: 때리지 말고 ${keys('Z+X')} 잡기</li></ul>`;
}

/** once per frame */
export function syncPractice(g: Game) {
  if (!root) return;
  const show = g.match.practice && g.screen === 'game';
  if (show !== shown) { shown = show; root.classList.toggle('show', show); sig = ''; }
  if (!show) return;
  const s = `${g.pcfg.style}|${g.dummy}|${g.guideOpen}`; if (s === sig) return; sig = s;
  const st = STYLES[g.pcfg.style];
  root.querySelectorAll<HTMLElement>('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === g.dummy));
  root.querySelector('[data-guide]')!.classList.toggle('on', g.guideOpen);
  root.querySelector('.tip')!.textContent = MODES.find((m) => m[0] === g.dummy)![2];
  const pg = root.querySelector('.pguide') as HTMLElement; pg.classList.toggle('open', g.guideOpen); pg.style.setProperty('--c', hex(st.color));
  root.querySelector('.nm')!.textContent = st.name + ' 사용법'; root.querySelector('.cc')!.textContent = st.concept;
  root.querySelector('.body')!.innerHTML = guideHtml(g);
}

/** inputs of the training partner (same virtual pad a player has) */
export function dummyCtrl(g: Game, f: Fighter): Ctrl {
  const c = emptyCtrl(); const P = g.player; if (!P || g.dummy === 'idle') return c;
  const dx = P.pos.x - f.pos.x, dz = P.pos.z - f.pos.z, d = Math.hypot(dx, dz) || 1;
  const free = f.controllable() && f.grounded;
  if (g.dummy === 'guard') {
    // come to the player and guard facing them. A raised guard cannot turn, so when the player steps
    // around it (or away) the guard is dropped, the partner turns / follows, and guards again.
    let off = Math.atan2(dx, dz) - f.yaw; off = Math.abs(Math.atan2(Math.sin(off), Math.cos(off)));
    if (f.state === 'guard' || f.state === 'blockstun') { c.guard = d < 1.9 && off < 0.8; return c; }
    if (!free) return c;
    if (d > 1.25) { c.mx = dx / d; c.mz = dz / d; return c; }
    if (off > 0.2) { f.faceToward(P.pos, 0.35); return c; }
    c.guard = true; return c;
  }
  // attack: walk into range, then one clean strike on a steady beat so its timing can be learned
  if (!free) return c;
  if (g.dummyT > 0) g.dummyT--;
  if (d > 1.45) { c.mx = dx / d; c.mz = dz / d; return c; }
  f.faceToward(P.pos, 0.3);
  const open = !['down', 'getup', 'roll', 'launched', 'thrown', 'grabbed', 'ko', 'out', 'fallout'].includes(P.state) && Math.abs(P.pos.y - f.pos.y) < 0.6;
  if (g.dummyT <= 0 && open) { c.J = true; g.dummyT = ATTACK_EVERY; }
  return c;
}
