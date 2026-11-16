// On-screen controls for devices without a keyboard: a floating joystick on the left, action buttons on the right.
// Buttons simply hold the same key codes the keyboard would, so every chord and combo rule stays in one place.
import * as THREE from 'three';
import type { Game } from './game';

/** joystick state, read by Game.readPlayer(): x right+, y down+ (screen space), both in -1..1 */
export const pad = { x: 0, y: 0, on: false };

type Btn = { id: string; label: string; sub?: string; keys: string[]; cls: string };
const BUTTONS: Btn[] = [
  { id: 'hand', label: '손', keys: ['KeyX'], cls: 'big hand' },
  { id: 'foot', label: '발', keys: ['KeyC'], cls: 'big foot' },
  { id: 'jump', label: '점프', keys: ['Space'], cls: 'mid jump' },
  { id: 'guard', label: '가드', keys: ['KeyZ'], cls: 'mid guard' },
  { id: 'grab', label: '잡기', keys: ['KeyZ', 'KeyX'], cls: 'sm grab' },
  { id: 'evade', label: '회피', keys: ['KeyX', 'KeyC'], cls: 'sm evade' },
  { id: 'nanmu', label: '난무', keys: ['KeyV'], cls: 'sm nanmu' },
  { id: 'spirit', label: '변신', keys: ['KeyO'], cls: 'sm spirit' },
  { id: 'sk1', label: '1', sub: '돌진', keys: ['Digit1'], cls: 'sm skill sk1' },
  { id: 'sk2', label: '2', sub: '회오리', keys: ['Digit2'], cls: 'sm skill sk2' },
];

let root: HTMLElement | undefined; let enabled = false; let shown = false; let lastState = '';
const held = new Map<string, number>();
export const isTouch = () => enabled;

export function initTouch(g: Game) {
  const el = document.createElement('div'); el.id = 'touch'; root = el;
  el.innerHTML = `<div class="tz tz-l"></div><div class="tz tz-r"></div>
    <div class="stick"><div class="ring"></div><div class="knob"></div></div>
    ${BUTTONS.map((b) => `<div class="tb ${b.cls}" data-id="${b.id}"><b>${b.label}</b>${b.sub ? `<small>${b.sub}</small>` : ''}</div>`).join('')}
    <div class="tb pause" data-id="pause"><b>II</b></div>`;
  document.body.appendChild(el);
  const rot = document.createElement('div'); rot.id = 'rotate'; rot.innerHTML = '<div><i></i><b>화면을 가로로 돌려주세요</b><span>ROTATE YOUR DEVICE</span></div>'; document.body.appendChild(rot);

  const setMode = (on: boolean) => { if (enabled === on) return; enabled = on; document.body.classList.toggle('touch', on); if (!on) releaseAll(g); };
  // a finger turns the controls on, a real key press turns them off again
  addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') setMode(true); }, true);
  addEventListener('keydown', (e) => { if (e.isTrusted && !e.repeat && e.key !== 'Unidentified') setMode(false); }, true);
  if (matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches) setMode(true);
  if (new URLSearchParams(location.search).has('touch')) setMode(true);

  // ---- buttons
  const press = (keys: string[]) => { for (const k of keys) { held.set(k, (held.get(k) ?? 0) + 1); g.keys.add(k); } };
  const release = (keys: string[]) => { for (const k of keys) { const n = (held.get(k) ?? 1) - 1; if (n <= 0) { held.delete(k); g.keys.delete(k); } else held.set(k, n); } };
  for (const b of BUTTONS) {
    const d = el.querySelector(`[data-id="${b.id}"]`) as HTMLElement; let id = -1;
    d.addEventListener('pointerdown', (e) => { e.preventDefault(); if (id >= 0) return; id = e.pointerId; try { d.setPointerCapture(id); } catch { /* synthetic pointer */ } d.classList.add('on'); g.audio?.resume(); press(b.keys); });
    const up = (e: PointerEvent) => { if (e.pointerId !== id) return; id = -1; d.classList.remove('on'); release(b.keys); };
    d.addEventListener('pointerup', up); d.addEventListener('pointercancel', up);
  }
  (el.querySelector('[data-id="pause"]') as HTMLElement).addEventListener('pointerdown', (e) => { e.preventDefault(); if (g.screen === 'game') g.go('pause'); });

  // ---- joystick: appears where the thumb lands; flick it twice to run
  const stick = el.querySelector('.stick') as HTMLElement, knob = el.querySelector('.knob') as HTMLElement, zl = el.querySelector('.tz-l') as HTMLElement;
  let sid = -1, ox = 0, oy = 0, lastUp = -1e9, R = 50;
  const setKnob = () => { knob.style.transform = `translate(${pad.x * R}px,${pad.y * R}px)`; };
  const move = (e: PointerEvent) => {
    let dx = (e.clientX - ox) / R, dy = (e.clientY - oy) / R; const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    pad.x = dx; pad.y = dy; setKnob();
  };
  zl.addEventListener('pointerdown', (e) => {
    e.preventDefault(); if (sid >= 0) return; sid = e.pointerId; try { zl.setPointerCapture(sid); } catch { /* synthetic pointer */ }
    const box = el.getBoundingClientRect(); R = stick.offsetWidth * 0.36;
    ox = THREE.MathUtils.clamp(e.clientX, box.left + R * 1.5, box.left + box.width * 0.42); oy = THREE.MathUtils.clamp(e.clientY, box.top + R * 1.5, box.bottom - R * 1.5);
    stick.style.left = ox - box.left + 'px'; stick.style.top = oy - box.top + 'px'; stick.classList.add('on');
    pad.on = true; if (performance.now() - lastUp < 320) { g.dashing = true; stick.classList.add('dash'); }
    move(e);
  });
  zl.addEventListener('pointermove', (e) => { if (e.pointerId === sid) move(e); });
  const sup = (e: PointerEvent) => { if (e.pointerId !== sid) return; sid = -1; pad.on = false; pad.x = pad.y = 0; setKnob(); lastUp = performance.now(); stick.classList.remove('on', 'dash'); stick.style.left = stick.style.top = ''; };
  zl.addEventListener('pointerup', sup); zl.addEventListener('pointercancel', sup);

  // ---- empty space on the right: drag to turn the camera
  const zr = el.querySelector('.tz-r') as HTMLElement; let cid = -1, cx = 0, cy = 0;
  zr.addEventListener('pointerdown', (e) => { e.preventDefault(); if (cid >= 0) return; cid = e.pointerId; cx = e.clientX; cy = e.clientY; try { zr.setPointerCapture(cid); } catch { /* synthetic pointer */ } });
  zr.addEventListener('pointermove', (e) => {
    if (e.pointerId !== cid) return;
    g.camYaw -= (e.clientX - cx) * 0.008 * g.settings.sens; g.camPitch = THREE.MathUtils.clamp(g.camPitch + (e.clientY - cy) * 0.005 * g.settings.sens, 0.45, 1.2); cx = e.clientX; cy = e.clientY;
  });
  const cup = (e: PointerEvent) => { if (e.pointerId === cid) cid = -1; };
  zr.addEventListener('pointerup', cup); zr.addEventListener('pointercancel', cup);

  // ---- keep the browser's own gestures out of the way (scrolling lists still scroll)
  const scrollable = (t: EventTarget | null) => !!(t as HTMLElement | null)?.closest?.('.sheet, .scroll');
  document.addEventListener('touchmove', (e) => { if (!scrollable(e.target)) e.preventDefault(); }, { passive: false });
  for (const ev of ['gesturestart', 'gesturechange', 'dblclick', 'contextmenu']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
}

function releaseAll(g: Game) { for (const k of held.keys()) g.keys.delete(k); held.clear(); pad.on = false; pad.x = pad.y = 0; root?.querySelectorAll('.on').forEach((e) => e.classList.remove('on')); }

/** once per frame: show the controls only while fighting, and light up what is available */
export function syncTouch(g: Game) {
  if (!root) return;
  const show = enabled && g.screen === 'game';
  if (show !== shown) { shown = show; root.classList.toggle('show', show); if (!show) releaseAll(g); }
  if (!show) return;
  const P = g.player; if (!P) return;
  const st = `${P.transformT > 0 ? 1 : 0}${P.nanmu > 0 ? 1 : 0}${P.gauge >= 100 ? 1 : 0}${g.dashing ? 1 : 0}`;
  if (st === lastState) return; lastState = st;
  root.classList.toggle('spirit-on', P.transformT > 0);
  root.querySelector('.nanmu')!.classList.toggle('off', P.nanmu <= 0);
  root.querySelector('.spirit')!.classList.toggle('ready', P.gauge >= 100 && P.transformT <= 0);
  root.querySelector('.stick')!.classList.toggle('dash', g.dashing);
}
