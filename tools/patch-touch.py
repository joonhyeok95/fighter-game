import re
def rw(p, f):
    s = open(p, encoding='utf-8').read(); s2 = f(s); open(p, 'w', encoding='utf-8', newline='\n').write(s2)
def must(s, a, b, n=1):
    assert s.count(a) >= n, a[:70]; return s.replace(a, b)

def game(s):
    s = must(s, "import * as UI from './ui';", "import * as UI from './ui';\nimport { initTouch, syncTouch, pad } from './touch';")
    # ---- knockback
    s = must(s, "const HITSTOP = [0, 6, 10, 15];", "const HITSTOP = [0, 6, 10, 15];\n/** how far knock-downs / light hits push the victim, relative to the numbers in the move table */\nconst KB_DOWN = 0.68, KB_LIGHT = 0.8;")
    s = must(s, "v.vel.set(dir.x * Math.max(6, m.kb[0]), Math.max(3.5, m.kb[1]) * VS, dir.z * Math.max(6, m.kb[0]));", "{ const k = Math.max(4.2, m.kb[0] * KB_DOWN); v.vel.set(dir.x * k, Math.max(3.5, m.kb[1]) * VS, dir.z * k); }")
    s = must(s, "v.vel.set(dir.x * m.kb[0], 0, dir.z * m.kb[0]);", "v.vel.set(dir.x * m.kb[0] * KB_LIGHT, 0, dir.z * m.kb[0] * KB_LIGHT);")
    s = must(s, "if (type === 'knockdown') v.vel.set(dir.x * m.kb[0], Math.max(v.vel.y, m.kb[1] * 0.6 * VS * decay * (noLift ? 0 : 1)), dir.z * m.kb[0]);", "if (type === 'knockdown') v.vel.set(dir.x * m.kb[0] * KB_DOWN, Math.max(v.vel.y, m.kb[1] * 0.6 * VS * decay * (noLift ? 0 : 1)), dir.z * m.kb[0] * KB_DOWN);")
    s = must(s, "const kh = forced ? Math.max(3, m.kb[0]) : m.kb[0], kv", "const kh = (forced ? Math.max(3, m.kb[0]) : m.kb[0]) * KB_DOWN, kv")
    # ---- resize / touch
    s = must(s, "addEventListener('resize', () => { this.renderer.setSize(innerWidth, innerHeight); this.composer.setSize(innerWidth, innerHeight); this.cam.aspect = innerWidth / innerHeight; this.cam.updateProjectionMatrix(); });",
        "const fit = () => this.resize();\n    addEventListener('resize', fit); addEventListener('orientationchange', () => { fit(); setTimeout(fit, 350); }); window.visualViewport?.addEventListener('resize', fit);\n    UI.layout(); initTouch(this);")
    s = must(s, "addEventListener('pointerdown', () => { window.focus();", "addEventListener('pointerdown', () => { this.audio?.resume(); window.focus();")
    s = must(s, "  async init() {", "  /** the window changed size (or a phone was turned): refit the canvas and the UI */\n  resize() {\n    this.renderer.setSize(innerWidth, innerHeight); this.composer.setSize(innerWidth, innerHeight); this.cam.aspect = innerWidth / innerHeight; this.cam.updateProjectionMatrix(); UI.layout();\n  }\n\n  async init() {")
    s = must(s, "private tap = { key: '', t: -99 }; private dashing = false;", "private tap = { key: '', t: -99 }; dashing = false;")
    s = must(s, "if (this.prevArrows.size === 0 || this.player?.dashLock) this.dashing = false;", "const stick = pad.on && Math.hypot(pad.x, pad.y) > 0.28; // on-screen joystick\n    if ((this.prevArrows.size === 0 && !stick) || this.player?.dashLock) this.dashing = false;")
    s = must(s, "if (k.has('ArrowLeft')) ix += 1; if (k.has('ArrowRight')) ix -= 1;", "if (k.has('ArrowLeft')) ix += 1; if (k.has('ArrowRight')) ix -= 1;\n    if (stick) { ix -= pad.x; iz -= pad.y; }")
    s = must(s, "  render(dt = DT) {\n", "  render(dt = DT) {\n    syncTouch(this);\n")
    return s
rw('src/game.ts', game)

def ui(s):
    s = must(s, "function project(g: Game, p: THREE.Vector3) { v3.copy(p).project(g.cam); return { x: (v3.x + 1) / 2 * innerWidth, y: (1 - v3.y) / 2 * innerHeight, vis: v3.z < 1 }; }",
        "function project(g: Game, p: THREE.Vector3) { v3.copy(p).project(g.cam); return { x: ((v3.x + 1) / 2 * innerWidth - LAY.left) / LAY.s, y: ((1 - v3.y) / 2 * innerHeight - LAY.top) / LAY.s, vis: v3.z < 1 }; }")
    s = must(s, "export function showLoading() {", """/** The UI is drawn for a 1280x720 (or larger) screen. On anything smaller - phones above all - the whole layer is
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

export function showLoading() {""")
    s = must(s, '<div class="press">PRESS ANY KEY</div>', '<div class="press"><span class="k">PRESS ANY KEY</span><span class="t">TAP TO START</span></div>')
    s = must(s, "<dt><kbd>Z</kbd></dt><dd>가드</dd>", "<dt>터치</dt><dd>왼쪽 조이스틱 이동 (빠르게 두 번 밀면 대시) · 오른쪽 버튼 공격 · 빈 곳을 끌어 시점 회전</dd>\n          <dt><kbd>Z</kbd></dt><dd>가드</dd>")
    return s
rw('src/ui.ts', ui)

def css(s):
    s = re.sub(r'(?<![\w.-])(\d+(?:\.\d+)?)v([wh])\b', lambda m: 'calc(var(--v%s) * %s)' % (m.group(2), m.group(1)), s)
    s = must(s, "body { margin: 0; overflow: hidden;", "html, body { position: fixed; inset: 0; width: 100%; height: 100%; overscroll-behavior: none; touch-action: none; -webkit-touch-callout: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent; -webkit-text-size-adjust: 100%; }\n:root { --vw: 1vw; --vh: 1vh; --u: 1vh; --s: 1; }\nbody { margin: 0; overflow: hidden;")
    s = must(s, "canvas { display: block; }", "body > canvas { display: block; position: fixed; left: 0; top: 0; }\n.sheet, .scroll { touch-action: pan-y; -webkit-overflow-scrolling: touch; }")
    s += r"""
/* =====================================================================
   Touch play: on-screen joystick + buttons, HUD moved out from under the thumbs
   ===================================================================== */
.title .press .t { display: none; }
body.touch .title .press .k { display: none; } body.touch .title .press .t { display: inline; }
#touch { position: fixed; left: env(safe-area-inset-left); right: env(safe-area-inset-right); top: env(safe-area-inset-top); bottom: env(safe-area-inset-bottom); display: none; touch-action: none; z-index: 5; font-family: var(--body); color: #fff; }
#touch.show { display: block; }
#touch .tz { position: absolute; top: 0; bottom: 0; }
#touch .tz-l { left: calc(env(safe-area-inset-left) * -1); width: 46%; }
#touch .tz-r { right: calc(env(safe-area-inset-right) * -1); width: 54%; }
#touch .stick { position: absolute; left: calc(var(--u) * 22); top: calc(100% - var(--u) * 23); width: calc(var(--u) * 32); height: calc(var(--u) * 32); margin: calc(var(--u) * -16) 0 0 calc(var(--u) * -16); pointer-events: none; opacity: .62; transition: opacity .15s; }
#touch .stick.on { opacity: 1; }
#touch .stick .ring { position: absolute; inset: 0; border-radius: 50%; border: 2px solid rgba(190, 200, 255, .45); background: radial-gradient(circle, rgba(14, 16, 38, .15) 40%, rgba(14, 16, 38, .6) 100%); box-shadow: 0 0 18px rgba(95, 227, 255, .25), inset 0 0 18px rgba(95, 227, 255, .15); }
#touch .stick .knob { position: absolute; left: 50%; top: 50%; width: 44%; height: 44%; margin: -22% 0 0 -22%; border-radius: 50%; background: radial-gradient(circle at 40% 32%, #fff, #b9c2ff 45%, #5f6bff); box-shadow: 0 3px 10px rgba(0, 0, 0, .5), 0 0 14px rgba(95, 227, 255, .6); }
#touch .stick.dash .ring { border-color: var(--gold); box-shadow: 0 0 22px rgba(255, 200, 87, .7), inset 0 0 22px rgba(255, 154, 61, .4); }
#touch .stick.dash .knob { background: radial-gradient(circle at 40% 32%, #fff, #ffe27a 45%, #ff8a3d); box-shadow: 0 3px 10px rgba(0, 0, 0, .5), 0 0 18px rgba(255, 180, 80, .9); }
#touch .tb { --d: calc(var(--u) * 11); position: absolute; width: var(--d); height: var(--d); border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 2px solid rgba(190, 200, 255, .5); background: rgba(14, 16, 38, .58); box-shadow: 0 2px 10px rgba(0, 0, 0, .45), inset 0 0 12px rgba(255, 255, 255, .08); touch-action: none; }
#touch .tb b { font-family: 'BHS', var(--body); font-weight: 400; font-size: calc(var(--d) * .3); line-height: 1; text-shadow: 0 1px 2px #000; }
#touch .tb small { font-size: calc(var(--d) * .2); font-weight: 700; color: var(--cyan); margin-top: 1px; }
#touch .tb.on { transform: scale(.9); background: rgba(255, 255, 255, .32); border-color: #fff; }
#touch .tb.big { --d: calc(var(--u) * 19); } #touch .tb.mid { --d: calc(var(--u) * 14.5); }
#touch .tb.big b { font-size: calc(var(--d) * .36); }
#touch .hand { right: calc(var(--u) * 22); bottom: calc(var(--u) * 4); border-color: #ffc857; background: rgba(255, 154, 61, .3); box-shadow: 0 0 16px rgba(255, 180, 80, .45); }
#touch .foot { right: calc(var(--u) * 3); bottom: calc(var(--u) * 13); border-color: #ff7a9a; background: rgba(255, 61, 110, .3); box-shadow: 0 0 16px rgba(255, 61, 110, .45); }
#touch .jump { right: calc(var(--u) * 4); bottom: calc(var(--u) * 35); border-color: #5fe3ff; background: rgba(95, 227, 255, .22); }
#touch .guard { right: calc(var(--u) * 43); bottom: calc(var(--u) * 3); border-color: #b9c2ff; background: rgba(95, 107, 255, .26); }
#touch .grab { right: calc(var(--u) * 37); bottom: calc(var(--u) * 20); }
#touch .evade { right: calc(var(--u) * 24); bottom: calc(var(--u) * 27); }
#touch .nanmu { right: calc(var(--u) * 20); bottom: calc(var(--u) * 41); border-color: var(--gold); color: #ffe9a8; }
#touch .nanmu.off { opacity: .28; border-color: rgba(190, 200, 255, .3); color: #fff; }
#touch .spirit { right: calc(var(--u) * 35); bottom: calc(var(--u) * 35); border-color: rgba(169, 139, 255, .6); opacity: .55; }
#touch .spirit.ready { opacity: 1; border-color: #fff; background: rgba(143, 107, 255, .5); box-shadow: 0 0 18px rgba(169, 139, 255, .9); animation: pulse .6s infinite; }
#touch .skill { display: none; border-color: var(--violet); background: rgba(143, 107, 255, .4); }
#touch.spirit-on .skill { display: flex; } #touch.spirit-on .spirit { display: none; }
#touch .sk1 { right: calc(var(--u) * 35); bottom: calc(var(--u) * 35); } #touch .sk2 { right: calc(var(--u) * 48); bottom: calc(var(--u) * 29); }
#touch .pause { --d: calc(var(--u) * 9); left: calc(50% + var(--s) * 96px); top: calc(var(--s) * 14px); right: auto; opacity: .8; }
#touch .pause b { font-family: var(--display); font-weight: 700; letter-spacing: .12em; padding-left: .12em; }
/* HUD: the player's card goes top-left, opponents share the top with it, key hints go away */
body.touch .hud .p1 { left: 10px; top: 8px; bottom: auto; transform: scale(.74); transform-origin: left top; }
body.touch .hud .enemies { padding: 0 330px 0 330px; }
body.touch .hud .enemies .side { gap: 6px 10px; }
body.touch .hud .minimap { right: 14px; top: 12px; bottom: auto; transform: scale(.9); transform-origin: right top; }
body.touch .hud .keys, body.touch .hud .okey, body.touch .hud .skills { display: none; }
body.touch .hud .guide { bottom: 16px; } body.touch .hud .guide kbd { display: none; } body.touch .hud .guide .nx { padding-left: 14px; }
body.touch .hud .combo { top: 34%; left: 30px; transform: skewX(-10deg) rotate(-4deg) scale(.8); }
body.touch .hud::before { background: linear-gradient(180deg, rgba(7, 8, 21, .55), transparent 18%); }
body.touch .btn { min-height: 46px; }
/* phones held upright */
#rotate { display: none; position: fixed; inset: 0; z-index: 20; background: radial-gradient(ellipse at 50% 120%, #5a1f6e 0%, #1a1440 45%, #070815 100%); align-items: center; justify-content: center; text-align: center; }
#rotate i { display: block; width: 54px; height: 92px; margin: 0 auto 26px; border: 3px solid #fff; border-radius: 10px; box-shadow: 0 0 20px rgba(95, 227, 255, .6); animation: turn 1.8s ease-in-out infinite; }
#rotate b { display: block; font-family: 'BHS', var(--body); font-weight: 400; font-size: 22px; color: #fff; }
#rotate span { display: block; margin-top: 8px; font-family: var(--display); font-size: 12px; letter-spacing: .34em; color: var(--gold); }
@keyframes turn { 0%, 20% { transform: rotate(0); } 60%, 100% { transform: rotate(-90deg); } }
@media (orientation: portrait) and (max-width: 720px) { body.touch #rotate { display: flex; } }
"""
    return s
rw('src/style.css', css)

def html(s):
    return must(s, '<meta name="viewport" content="width=device-width,initial-scale=1" />', '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover" />\n<meta name="apple-mobile-web-app-capable" content="yes" /><meta name="mobile-web-app-capable" content="yes" /><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" /><meta name="theme-color" content="#070815" />')
rw('index.html', html)
print('ok')
