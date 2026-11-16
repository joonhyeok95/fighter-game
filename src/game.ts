import * as THREE from 'three';
import { loadAssets, Assets } from './assets';
import { META } from './anims';
import { buildChibi, lookFor } from './character';
import { Fighter, World, DT, VS, emptyCtrl, Ctrl, FighterOpts } from './fighter';
import { MOVES, MoveDef, STYLES, STYLE_IDS, OPEN_STYLES, Limb, HitPoint } from './moves';
import { AIController, Difficulty } from './ai';
import { buildStage } from './stage';
import { MAP, MAPS } from './maps';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { FX, makeAura, makeBlade } from './fx';
import * as UI from './ui';
import { initTouch, syncTouch, pad, isTouch } from './touch';
import { initPractice, syncPractice, practiceKey, dummyCtrl, DummyMode } from './practice';

type Screen = 'loading' | 'title' | 'menu' | 'setup' | 'select' | 'game' | 'pause' | 'round' | 'result' | 'moves' | 'settings' | 'credits';

// Physical key of a keyboard event. Remote-desktop clients and IMEs often deliver keys with an empty `code`
// (injected unicode input) or as Hangul jamo, so fall back to `key` and the legacy `keyCode`.
const JAMO: Record<string, string> = { ㅂ: 'Q', ㅈ: 'W', ㄷ: 'E', ㄱ: 'R', ㅅ: 'T', ㅛ: 'Y', ㅕ: 'U', ㅑ: 'I', ㅐ: 'O', ㅔ: 'P', ㅁ: 'A', ㄴ: 'S', ㅇ: 'D', ㄹ: 'F', ㅎ: 'G', ㅗ: 'H', ㅓ: 'J', ㅏ: 'K', ㅣ: 'L', ㅋ: 'Z', ㅌ: 'X', ㅊ: 'C', ㅍ: 'V', ㅠ: 'B', ㅜ: 'N', ㅡ: 'M', ㅃ: 'Q', ㅉ: 'W', ㄸ: 'E', ㄲ: 'R', ㅆ: 'T', ㅒ: 'O', ㅖ: 'P' };
const NAMED: Record<string, string> = { ' ': 'Space', Spacebar: 'Space', Esc: 'Escape', Shift: 'ShiftLeft', Control: 'ControlLeft', Alt: 'AltLeft', Up: 'ArrowUp', Down: 'ArrowDown', Left: 'ArrowLeft', Right: 'ArrowRight' };
const KC: Record<number, string> = { 8: 'Backspace', 9: 'Tab', 13: 'Enter', 16: 'ShiftLeft', 17: 'ControlLeft', 18: 'AltLeft', 27: 'Escape', 32: 'Space', 37: 'ArrowLeft', 38: 'ArrowUp', 39: 'ArrowRight', 40: 'ArrowDown', 112: 'F1' };
// Remote sessions often deliver the arrow keys as numpad keys (no "extended" flag), so the numpad counts as arrows.
// I/J/K/L work as a second set of movement keys in case the arrows are swallowed entirely.
const ALIAS: Record<string, string> = {
  Numpad8: 'ArrowUp', Numpad2: 'ArrowDown', Numpad5: 'ArrowDown', Numpad4: 'ArrowLeft', Numpad6: 'ArrowRight',
  KeyI: 'ArrowUp', KeyK: 'ArrowDown', KeyJ: 'ArrowLeft', KeyL: 'ArrowRight', Numpad0: 'Space', NumpadEnter: 'Enter',
};
export function codeOf(e: KeyboardEvent): string { const c = rawCode(e); return ALIAS[c] ?? c; }
function rawCode(e: KeyboardEvent): string {
  const key = e.key ?? '';
  if (key.startsWith('Arrow')) return key; // whatever physical key produced it, an arrow is an arrow
  if (e.code && e.code !== 'Unidentified') return e.code;
  const k = e.key ?? '';
  if (k.length === 1) {
    if (/[a-z]/i.test(k)) return 'Key' + k.toUpperCase();
    if (/[0-9]/.test(k)) return 'Digit' + k;
    if (JAMO[k]) return 'Key' + JAMO[k];
  }
  if (NAMED[k]) return NAMED[k];
  if (k.length > 1 && k !== 'Process' && k !== 'Unidentified' && k !== 'Dead') return k; // ArrowUp, Escape, Enter, F1 ...
  const kc = e.keyCode || e.which || 0;
  if (kc >= 65 && kc <= 90) return 'Key' + String.fromCharCode(kc);
  if (kc >= 48 && kc <= 57) return 'Digit' + (kc - 48);
  if (kc >= 96 && kc <= 105) return 'Digit' + (kc - 96);
  return KC[kc] ?? '';
}
export type Quality = 'high' | 'mid' | 'low';
export interface MatchCfg { ai: number; difficulty: Difficulty; wins: number; practice: boolean; map?: string }
export interface PlayerCfg { body: 'male' | 'female'; suit: number; style: string }
export const SUITS = [0xc8ccd6, 0xd8333b, 0x2f6fdb, 0x2fae5e, 0xe2a12a, 0x8a4fd1]; // accent colour of the outfit (silver = male default, red = female default)
const AI_ROSTER: [string, number, 'male' | 'female', string][] = [
  ['카이', 0xd8433b, 'male', 'taekwondo'], ['미라', 0x2fae5e, 'female', 'ninjutsu'], ['토르', 0xe2a12a, 'male', 'jujutsu'],
  ['세나', 0x8a4fd1, 'female', 'smoke'], ['루크', 0x23a6b8, 'male', 'freefight'], ['하나', 0xe0609c, 'female', 'kickboxing'], ['진', 0x6b6f7a, 'male', 'taekwondo'],
];
// hit-feel tables by weight (1 light, 2 medium, 3 heavy)
const HITSTOP = [0, 6, 10, 15];
/** how far knock-downs / light hits push the victim, relative to the numbers in the move table */
const KB_DOWN = 0.68, KB_LIGHT = 0.8;
const SHAKE = [0, 0.09, 0.17, 0.3];
const FOV_KICK = [0, 0.6, 1.4, 2.6];

const rand = (() => { let s = 12345; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; })();
interface Smoke { pos: THREE.Vector3; r: number; t: number; owner: Fighter; sprites: THREE.Sprite[] }

class Game implements World {
  composer!: EffectComposer; stage?: THREE.Object3D;
  renderer: THREE.WebGLRenderer; scene = new THREE.Scene(); cam: THREE.PerspectiveCamera;
  A!: Assets; fx!: FX; audio?: AudioContext; locoSpeed: Record<string, number> = {};
  screen: Screen = 'loading'; prevScreen: Screen = 'menu';
  fighters: Fighter[] = []; ai = new Map<Fighter, AIController>(); player?: Fighter; smokes: Smoke[] = [];
  match: MatchCfg = { ai: 3, difficulty: 'normal', wins: 2, practice: false };
  /** practice mode: what the training partner does, its strike timer, and whether the how-to panel is open */
  dummy: DummyMode = 'idle'; dummyT = 0; guideOpen = true;
  pcfg: PlayerCfg = { body: 'male', suit: SUITS[0], style: OPEN_STYLES[0] };
  round = 1; timer = 99; tickN = 0; introT = 0; endT = 0; roundWinner?: Fighter;
  keys = new Set<string>(); camYaw = 0; camPitch = 0.6; camDist = 6.4; dragging = false;
  camTarget = new THREE.Vector3(); camShake = 0; camKick = new THREE.Vector3(); fovKick = 0; manual = false; acc = 0; last = performance.now();

  settings = { volume: 0.7, shadows: true, sens: 1, showHitboxes: false, guide: true, quality: 'high' as Quality, autoQuality: true };
  bloom!: UnrealBloomPass; slowT = 0; fps = 60;
  camOverride?: { pos: THREE.Vector3; look: THREE.Vector3 };
  hitboxGroup = new THREE.Group();
  autopilot = false; // screenshots/demo: the player character is driven by the AI

  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.1;
    document.body.prepend(this.renderer.domElement);
    this.cam = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 600);
    const pr = this.renderer.getPixelRatio();
    this.composer = new EffectComposer(this.renderer, new THREE.WebGLRenderTarget(innerWidth * pr, innerHeight * pr, { type: THREE.HalfFloatType, samples: 4 }));
    this.composer.addPass(new RenderPass(this.scene, this.cam));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.42, 0.65, 1.3); this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    { // no real GPU (remote desktop sessions, VMs): start on the lightest preset
      const gl = this.renderer.getContext(); const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '');
      if (/swiftshader|basic render|llvmpipe|software|warp/i.test(name)) this.setQuality('low');
    }
    const fit = () => this.resize();
    addEventListener('resize', fit); addEventListener('orientationchange', () => { fit(); setTimeout(fit, 350); }); window.visualViewport?.addEventListener('resize', fit);
    UI.layout(); initTouch(this); initPractice(this);
    // capture phase on window + document so nothing (focused buttons, IME, remote sessions) swallows the keys
    const down = (e: KeyboardEvent) => { const c = codeOf(e); if (!c) return; this.keys.add(c); this.onKey(e, c); };
    addEventListener('keydown', down, true);
    addEventListener('keyup', (e) => { const c = codeOf(e); if (c) this.keys.delete(c); if (c === 'ShiftLeft') this.keys.delete('ShiftRight'); }, true);
    addEventListener('blur', () => this.keys.clear());
    addEventListener('pointerdown', () => { this.audio?.resume(); window.focus(); (document.activeElement as HTMLElement | null)?.blur?.(); }, true);
    const cv = this.renderer.domElement;
    cv.addEventListener('mousedown', () => (this.dragging = true));
    addEventListener('mouseup', () => (this.dragging = false));
    addEventListener('mousemove', (e) => { if (this.dragging && this.screen === 'game') { this.camYaw -= e.movementX * 0.005 * this.settings.sens; this.camPitch = THREE.MathUtils.clamp(this.camPitch + e.movementY * 0.003 * this.settings.sens, 0.45, 1.2); } });
    addEventListener('wheel', (e) => { if (this.screen === 'game') this.camDist = THREE.MathUtils.clamp(this.camDist + e.deltaY * 0.004, 4.5, 14); });
    this.scene.add(this.hitboxGroup);
  }

  /** the window changed size (or a phone was turned): refit the canvas and the UI */
  resize() {
    this.renderer.setSize(innerWidth, innerHeight); this.composer.setSize(innerWidth, innerHeight); this.cam.aspect = innerWidth / innerHeight; this.cam.updateProjectionMatrix(); UI.layout();
  }

  async init() {
    UI.showLoading();
    try { this.audio = new AudioContext(); } catch { /* no audio */ }
    this.A = await loadAssets((p) => UI.setLoading(p), this.audio);
    this.locoSpeed = analyzeMoves();
    this.setMap(this.match.map ?? 'court');
    this.fx = new FX(this.scene, this.A, this.audio);
    this.go('title');
    requestAnimationFrame(this.frame);
    (window as any).__ready = true;
  }

  // ------------------------------------------------------------------ screens
  go(s: Screen) {
    if (s !== 'pause') this.prevScreen = this.screen;
    this.screen = s; this.camOverride = undefined;
    const ui = UI.screens(this);
    if (s === 'title') { this.setupAttract(); ui.title(); }
    else if (s === 'menu') { if (!this.fighters.length || this.player) this.setupAttract(); ui.menu(); }
    else if (s === 'setup') ui.setup();
    else if (s === 'select') { this.setupSelect(); ui.select(); }
    else if (s === 'game') ui.hud();
    else if (s === 'pause') ui.pause();
    else if (s === 'round') ui.round();
    else if (s === 'result') ui.result();
    else if (s === 'moves') ui.moves();
    else if (s === 'settings') ui.settings();
    else if (s === 'credits') ui.credits();
  }
  /** graphics preset: resolution, bloom, shadows and UI blur */
  setQuality(q: Quality) {
    const s = this.settings; s.quality = q;
    const pr = q === 'high' ? Math.min(devicePixelRatio, 2) : q === 'mid' ? Math.min(devicePixelRatio, 1) : 0.5;
    this.renderer.setPixelRatio(pr); this.composer.setPixelRatio(pr);
    this.renderer.setSize(innerWidth, innerHeight); this.composer.setSize(innerWidth, innerHeight);
    this.bloom.enabled = q !== 'low'; s.shadows = q !== 'low'; this.renderer.shadowMap.enabled = s.shadows;
    this.scene.traverse((o: any) => { for (const m of [].concat(o.material ?? [])) (m as any).needsUpdate = true; });
    document.body.classList.toggle('lowfx', q === 'low');
  }
  onKey(e: KeyboardEvent, code = codeOf(e)) {
    this.audio?.resume();
    if (this.screen === 'title') { this.fx.sfx('confirmation_001'); this.go('menu'); return; }
    if (code === 'Escape') {
      if (this.screen === 'game') this.go('pause');
      else if (this.screen === 'pause') this.go('game');
      else if (['setup', 'moves', 'settings', 'credits'].includes(this.screen)) this.go('menu');
      else if (this.screen === 'select') this.go(this.match.practice ? 'menu' : 'setup');
    }
    if (practiceKey(this, code)) { e.preventDefault(); return; }
    if (code === 'F1') { this.settings.showHitboxes = !this.settings.showHitboxes; e.preventDefault(); }
    if ((code === 'Space' || code.startsWith('Arrow')) && this.screen === 'game') e.preventDefault();
  }

  clearFighters() {
    for (const f of this.fighters) this.scene.remove(f.root);
    for (const s of this.smokes) s.sprites.forEach((x) => this.scene.remove(x));
    this.fighters = []; this.ai.clear(); this.player = undefined; this.smokes = []; UI.clearTags();
  }
  spawn(opts: FighterOpts, ai?: Difficulty) {
    const seed = opts.isPlayer ? (opts.body === 'female' ? 1 : 0) : (AI_ROSTER.findIndex((r) => r[0] === opts.name) + 2);
    const model = buildChibi(lookFor(Math.max(0, seed), opts.suit, opts.body));
    const f = new Fighter(this.fighters.length, opts, model, this.A.clips, this.locoSpeed);
    this.scene.add(f.root); this.fighters.push(f);
    (f as any).portrait = this.portrait(model);
    if (ai) this.ai.set(f, new AIController(f, ai, rand));
    if (opts.isPlayer) this.player = f;
    return f;
  }
  private pRenderer?: THREE.WebGLRenderer;
  /** small face portrait for the HUD, rendered from the fighter's own model */
  portrait(model: THREE.Object3D) {
    const R = (this.pRenderer ??= new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }));
    R.setSize(128, 128); R.setPixelRatio(1); R.outputColorSpace = THREE.SRGBColorSpace;
    const sc = new THREE.Scene(); const clone = model.clone(true);
    // SkeletonUtils-style clone is not needed: the rest pose is enough for a head shot
    sc.add(clone); clone.updateMatrixWorld(true);
    sc.add(new THREE.HemisphereLight(0xffffff, 0x887766, 2.2)); const d = new THREE.DirectionalLight(0xffffff, 1.4); d.position.set(1, 2, 3); sc.add(d);
    const head = model.getObjectByName('Head')!.getWorldPosition(new THREE.Vector3());
    const cam = new THREE.PerspectiveCamera(28, 1, 0.05, 20); cam.position.set(head.x + 0.4, head.y + 0.36, head.z + 1.75); cam.lookAt(head.x, head.y + 0.25, head.z);
    R.render(sc, cam); return R.domElement.toDataURL('image/png');
  }
  /** swap the arena: collision layout + scenery */
  setMap(id: string) {
    if (!MAPS[id]) id = 'court';
    if (this.stage && MAP.cur.id === id) return;
    MAP.cur = MAPS[id]; this.match.map = id;
    if (this.stage) {
      this.scene.remove(this.stage);
      this.stage.traverse((o: any) => { o.geometry?.dispose?.(); for (const m of [].concat(o.material ?? [])) { (m as any).map?.dispose?.(); (m as any).dispose?.(); } });
    }
    this.stage = buildStage(this.scene, this.A, id);
    for (const f of this.fighters) { MAP.cur.confine(f.pos, 0.5); f.pos.y = Math.max(0, MAP.cur.floor(f.pos.x, f.pos.z)); }
  }
  setupAttract() {
    this.clearFighters();
    const a = this.spawn({ name: '카이', team: 1, body: 'male', suit: 0xd8433b, joints: 0x222222, style: 'taekwondo' }, 'hard');
    const b = this.spawn({ name: '미라', team: 2, body: 'female', suit: 0x2f6fdb, joints: 0x222222, style: 'taekwondo' }, 'hard');
    a.pos.set(-1.5, 0, 0); b.pos.set(1.5, 0, 0); a.yaw = Math.PI / 2; b.yaw = -Math.PI / 2;
    for (const f of this.fighters) { f.hp = f.maxHp = 99999; }
  }
  setupSelect() {
    this.clearFighters();
    const f = this.spawn({ name: '플레이어', team: 0, body: this.pcfg.body, suit: this.pcfg.suit, joints: 0x1d1d22, style: this.pcfg.style, isPlayer: true });
    f.pos.set(0, 0, 0); f.yaw = 0;
    this.camOverride = { pos: new THREE.Vector3(1.75, 1.75, 5.2), look: new THREE.Vector3(1.6, 0.95, 0) };
  }
  refreshSelect() { this.setupSelect(); }

  startMatch() {
    this.round = 1;
    this.clearFighters();
    this.spawn({ name: '플레이어', team: 0, body: this.pcfg.body, suit: this.pcfg.suit, joints: 0x1d1d22, style: this.pcfg.style, isPlayer: true });
    const n = this.match.practice || MAP.cur.duel ? 1 : this.match.ai;
    for (let i = 0; i < n; i++) {
      const [name, col, body, style] = AI_ROSTER[i % AI_ROSTER.length];
      this.spawn({ name: this.match.practice ? '연습 상대' : name, team: i + 1, body, suit: col, joints: 0x222222, style: OPEN_STYLES.includes(style) ? style : OPEN_STYLES[i % OPEN_STYLES.length] }, this.match.practice ? undefined : this.match.difficulty);
    }
    this.dummy = 'idle'; this.dummyT = 0; this.guideOpen = !isTouch();
    this.startRound();
  }
  startRound() {
    const n = this.fighters.length;
    for (const s of this.smokes) s.sprites.forEach((x) => this.scene.remove(x)); this.smokes = [];
    this.fighters.forEach((f, i) => {
      const [sx, sz] = MAP.cur.spawn(i, n, this.match.practice);
      f.pos.set(sx, MAP.cur.floor(sx, sz), sz); f.vel.set(0, 0, 0); f.yaw = Math.atan2(-sx, -sz);
      const hpMul = 1; f.maxHp = 1000 * hpMul; f.hp = f.maxHp; f.hpView = f.maxHp; f.mp = f.maxMp; f.gauge = this.match.practice ? 100 : 0;
      f.evades = 2; f.nanmu = 1; f.dashLock = false; f.tumbleT = -1; f.alive = true; f.koPending = false; f.poisonT = f.confuseT = f.veilT = 0;
      f.combo = 0; f.freeze = 0; f.invuln = 0; f.grounded = true; f.root.visible = true; f.holding = f.grabbedBy = undefined;
      if (f.transformT > 0) this.endTransform(f);
      f.setState('idle'); f.play('Idle_Loop', { fade: 0 });
    });
    if (this.player) this.camYaw = this.player.yaw + Math.PI;
    this.timer = 99; this.introT = this.match.practice ? 0 : 110; this.endT = 0; this.roundWinner = undefined;
    this.go('game');
    if (!this.match.practice) UI.banner(`ROUND ${this.round}`, 'round');
  }

  // ------------------------------------------------------------------ World impl
  enemies(f: Fighter) { return this.fighters.filter((o) => o !== f && o.team !== f.team && o.alive && o.state !== 'out'); }
  nearestEnemy(f: Fighter, maxD = 99) {
    let best: Fighter | undefined, bd = maxD;
    for (const o of this.enemies(f)) { const d = o.pos.distanceTo(f.pos); if (d < bd) { bd = d; best = o; } }
    return best;
  }
  onMoveStart(f: Fighter, m: MoveDef) {
    const w = m.weight ?? 1;
    this.fx.whoosh(0.35 + w * 0.15, m.anim.startsWith('kick') || m.anim.startsWith('knee') ? 0.8 : 1.1);
    if (m.radial) this.fx.burst(f.pos.clone().add(new THREE.Vector3(0, 0.65, 0)), m.id === 'skill2' ? 0xc890ff : 0x88ccff, m.radial * 1.2);
    if (m.id === 'skill1') this.fx.burst(f.pos.clone().add(new THREE.Vector3(0, 0.7, 0)), 0xc890ff, 2);
    if (m.armor && !m.nanmu) { f.flashColor.setRGB(1, 0.75, 0.2); f.flash = 10; }
    if (m.id === 'nm_0') { f.flashColor.setRGB(1, 0.35, 0.3); f.flash = 14; this.fx.burst(f.pos.clone().add(new THREE.Vector3(0, 0.65, 0)), 0xff5a4a, 2.2); this.fx.dust(f.pos, 0.8); if (f.isPlayer) UI.banner('난무!', 'spirit'); if (this.match.practice) f.nanmu = 1; }
  }

  checkHits(att: Fighter, m: MoveDef, hi: number) {
    if (m.radial) {
      for (const v of this.enemies(att)) {
        const key = hi + ':' + v.id; if (att.hitDone.has(key) || v.invuln > 0 || v.isDownish()) continue;
        if (v.pos.distanceTo(att.pos) < m.radial) this.resolveHit(att, v, m, hi, v.pos.clone().setY(v.pos.y + 0.7));
      }
      return;
    }
    const h = m.hits![hi];
    const pts = [att.limbPos(h.limb)];
    if (m.reach && att.blade) for (const k of [0.35, 0.75, 1.1]) pts.push(att.blade.localToWorld(new THREE.Vector3(0, k, 0)));
    const rad = (att.blade && m.reach ? 0.3 : 0.24) + (!att.blade && m.reach ? m.reach : 0);
    for (const v of this.enemies(att)) {
      const key = hi + ':' + v.id; if (att.hitDone.has(key) || v.invuln > 0 || v.isDownish()) continue;
      const [a, b] = v.hurtSegment(); const seg = new THREE.Line3(a, b); const tmp = new THREE.Vector3();
      for (const p of pts) { seg.closestPointToPoint(p, true, tmp); if (tmp.distanceTo(p) < rad + 0.3) { this.resolveHit(att, v, m, hi, p.clone()); break; } }
    }
  }

  resolveHit(att: Fighter, v: Fighter, m: MoveDef, hi: number, at: THREE.Vector3) {
    att.hitDone.add(hi + ':' + v.id);
    const lastHit = hi >= (m.hits?.length ?? 1) - 1;
    const toAtt = att.pos.clone().sub(v.pos).setY(0).normalize();
    const facing = v.forward().dot(toAtt) > 0.1;
    // ---- counter stance beats attacks
    const crush = !!m.guardBreak || att.charged;
    if (v.state === 'counter' && v.stateT <= 26 && !crush) {
      v.faceToward(att.pos, 1); this.fx.hit(at, 'counter', toAtt.clone().negate(), 3); UI.popText(this, v, '반격!', '#5f8');
      this.hitStop(v, att, 10);
      if (v.style.counterThrow) { // jujutsu: counter becomes a joint-lock throw
        this.startThrow(v, att, 'counter'); return;
      }
      v.setState('counterhit'); v.play('Punch_Cross', { speed: 1.8, loop: false }); v.invuln = 20;
      this.damage(v, att, 70, att.pos.clone().add(new THREE.Vector3(0, 0.85, 0)), 3);
      att.vel.set(-toAtt.x * 7, 3.5 * VS, -toAtt.z * 7); att.launch(false);
      return;
    }
    // ---- guard
    if ((v.state === 'guard' || v.state === 'blockstun') && facing && !crush) {
      v.setState('blockstun'); v.vel.set(-toAtt.x * 2.4, 0, -toAtt.z * 2.4);
      this.hitStop(att, v, 5); v.shake = 5; this.fx.hit(at, 'block', toAtt.clone().negate(), 1); v.gauge = Math.min(100, v.gauge + 2);
      return;
    }
    // ---- clean hit
    const w = (att.charged ? 3 : m.weight ?? (m.type === 'light' ? 1 : 2)) as 1 | 2 | 3;
    const scale = (m.nanmu ? 1 : Math.max(0.4, 1 - 0.08 * att.combo)) * (att.transformT > 0 ? 1.25 : 1) * (v.style.dmgTaken ?? 1) * (att.charged ? 1.6 : 1);
    const dmg = Math.max(1, Math.round(m.dmg * scale));
    att.combo++; att.comboDmg += dmg; att.comboT = 80; att.stats.maxCombo = Math.max(att.stats.maxCombo, att.combo);
    // 각치기: the victim flies the way the attacker is FACING at the moment of impact (not straight away)
    const away = v.pos.clone().sub(att.pos).setY(0).normalize(); const dir = att.forward().setY(0).normalize();
    if (dir.dot(away) < 0) dir.copy(away); // never pull the victim through the attacker
    this.damage(att, v, dmg, at, w);
    if (att.style.poison) { v.poisonT = 120; v.poisonBy = att; }
    const finisher = lastHit && m.type !== 'light';
    const ko = v.hp <= 0;
    // hit-feel with no slow-down at all: shake the victim, flash, camera kick, sound, sparks
    const imp = att.style.impact ?? 1;
    this.hitStop(att, v, Math.round((HITSTOP[w] + (ko ? 6 : 0) + (finisher && att.combo >= 3 ? 3 : 0)) * imp));
    v.flashColor.setRGB(1, 1, 1); v.flash = 6; v.squash = 8;
    this.camShake = Math.max(this.camShake, SHAKE[w] * imp * (ko ? 1.6 : 1));
    this.camKick.addScaledVector(dir, SHAKE[w] * 0.9 * imp); this.camKick.y -= SHAKE[w] * 0.5 * imp; this.fovKick = Math.max(this.fovKick, FOV_KICK[w] * imp);
    if (imp > 1 && w >= 2 && v.grounded) this.fx.dust(v.pos, 0.45 + 0.15 * w);
    if (imp >= 1.4 && w >= 3 && att.grounded) this.fx.dust(att.pos, 0.55); // iron-heavy blows: the striker's planted foot cracks the floor too // heavy kicks kick up dust under the victim
    this.fx.hit(at, m.reach ? 'sword' : w >= 3 ? 'heavy' : w === 2 ? 'medium' : 'hit', dir, w);
    // super armor: take the damage, keep attacking
    if (v.hasArmor() && !ko) { v.flashColor.setRGB(1, 0.7, 0.2); UI.popText(this, v, '아머', '#fb923c'); return; }
    v.move = undefined; v.queued = undefined;
    if (ko) { { const k = Math.max(4.2, m.kb[0] * KB_DOWN); v.vel.set(dir.x * k, Math.max(3.5, m.kb[1]) * VS, dir.z * k); } v.launch(m.type !== 'launch'); return; }
    // early hits of a multi-hit launcher pop the target up a little so the next hit juggles them
    if (!lastHit && m.type === 'launch' && v.grounded && v.state !== 'launched') { v.faceToward(att.pos, 1); v.vel.set(dir.x * 0.15, 2.0 * VS, dir.z * 0.15); v.launch(); v.float = true; return; }
    let type = lastHit ? m.type : 'light';
    let forced = false;
    if (type === 'light' && v.stunChain > 90 && !m.nanmu) { type = 'knockdown'; v.stunChain = 0; forced = true; } // break multi-attacker stun-locks
    if (type === 'light' && v.grounded && v.state !== 'launched') {
      v.setState('hitstun'); v.stunFor = this.comboStun(m, hi); v.faceToward(att.pos, 1);
      v.play(at.y > v.pos.y + 0.85 ? 'Hit_Head' : 'Hit_Chest', { loop: false, speed: 1, fade: 0.03 });
      v.vel.set(dir.x * m.kb[0] * KB_LIGHT, 0, dir.z * m.kb[0] * KB_LIGHT);
    } else if (!v.grounded || v.state === 'launched') {
      // juggle: each extra air hit lifts less (natural gravity wins eventually)
      v.juggle++;
      // juggle decay applies to every air hit, launchers included, so no air combo is infinite;
      // after ~2.5s of continuous hit reactions air hits stop lifting altogether
      const decay = Math.max(0.15, 1 - 0.13 * Math.max(0, v.juggle - 3)); // launch + 2 끊치 + ground combo fits; ~10 air hits max
      // floating victims: launchers re-float, standing hits add a small hop (about a jab's worth of hang time)
      let lift = type === 'launch' ? m.kb[1] * 0.4 * decay : Math.max(0.6, 1.6 - 0.08 * v.juggle) * decay;
      if (!v.float && type !== 'launch') lift *= 1.6; // a non-floating airborne target (jump, knockdown) needs more to stay up
      // no re-launch after the ground bounce, and none after ~1.7s of continuous hit reactions
      const noLift = v.bounced || v.stunChain > 150;
      if (noLift) lift = 0;
      const hk = v.float ? 0.5 : Math.max(1.2, m.kb[0] * 0.5); // floating targets stay in front of the attacker
      v.vel.set(dir.x * hk, Math.max(v.vel.y, lift * VS), dir.z * hk);
      if (type === 'knockdown') v.vel.set(dir.x * m.kb[0] * KB_DOWN, Math.max(v.vel.y, m.kb[1] * 0.6 * VS * decay * (noLift ? 0 : 1)), dir.z * m.kb[0] * KB_DOWN);
      const fl = type !== 'knockdown' && (v.float || type === 'launch');
      v.launch(v.downFace); v.float = fl;
    } else {
      v.faceToward(att.pos, 1); v.juggle = 0;
      const kh = (forced ? Math.max(3, m.kb[0]) : m.kb[0]) * KB_DOWN, kv = forced ? Math.max(2.5, m.kb[1]) : m.kb[1];
      // launchers pop the target to ~1 m and leave it floating for standing juggles
      const kvv = type === 'launch' ? kv * 0.42 : kv;
      v.vel.set(dir.x * (type === 'launch' ? Math.min(kh, 0.6) : kh), kvv * VS, dir.z * (type === 'launch' ? Math.min(kh, 0.6) : kh)); v.launch(type === 'knockdown' && kv < 3.5); v.float = type === 'launch';
    }
  }
  /**
   * Hit-stun long enough that the NEXT hit of the same move, or the fastest follow-up in the
   * combo tree, connects before the victim can act: every documented route is a true combo.
   */
  comboStun(m: MoveDef, hi: number) {
    let need = m.hitstun ?? 20; const hits = m.hits || [];
    const cur = hits[hi];
    if (cur && hits[hi + 1]) need = Math.max(need, ((hits[hi + 1].t - cur.t) / m.speed) * 60 + 8);
    else if (cur && m.next) {
      const remain = ((hits[hits.length - 1].to - cur.t) / m.speed) * 60;
      const nextStart = Math.max(...Object.values(m.next).map((id) => { const n = MOVES[id!]; return n?.hits?.[0] ? (n.hits[0].t / n.speed) * 60 : 20; }));
      need = Math.max(need, remain + nextStart + 8);
    }
    return Math.min(70, Math.round(need));
  }
  /** impact feedback only: nobody is ever frozen or slowed, the victim just rattles for a few frames */
  hitStop(a: Fighter, b: Fighter, frames: number) { b.shake = Math.max(b.shake, Math.min(12, frames)); a.hitT = b.hitT = Math.max(4, frames); }
  damage(att: Fighter, v: Fighter, dmg: number, at: THREE.Vector3, w = 1) {
    if (this.match.practice && v !== this.player && v.hp - dmg <= 0) v.hp = v.maxHp + dmg;
    v.hp = Math.max(0, v.hp - dmg); v.lastHitBy = att; v.lastHitAt = this.tickN;
    att.stats.dmg += dmg; v.stats.taken += dmg;
    att.gauge = Math.min(100, att.gauge + (this.match.practice ? 100 : 5)); v.gauge = Math.min(100, v.gauge + 7);
    UI.damageNumber(this, at, dmg, att.isPlayer, w);
    if (v.hp <= 0 && v.alive) { v.alive = false; v.koPending = true; att.stats.kos++; UI.banner('K.O.', 'ko'); this.fx.sfx('bong_001'); }
  }
  poisonTick(v: Fighter) {
    const by = v.poisonBy; const d = 4;
    if (this.match.practice && v !== this.player && v.hp - d <= 0) v.hp = v.maxHp;
    v.hp = Math.max(1, v.hp - d); if (by) by.stats.dmg += d; v.stats.taken += d;
    if (this.tickN % 30 === 0) UI.damageNumber(this, v.bones.Head.getWorldPosition(new THREE.Vector3()), d, false, 0, '#c084fc');
  }

  // ---------- grabs & throws
  tryGrab(f: Fighter, cmd: boolean, combo = false) {
    const range = cmd ? 1.75 : f.style.grabRange;
    for (const v of this.enemies(f)) {
      const d = v.pos.clone().sub(f.pos); d.y = 0; const dist = d.length();
      if (dist > range || f.forward().dot(d.normalize()) < 0.3) continue;
      const okStates = ['idle', 'move', 'guard', 'blockstun', 'counter', 'grab', 'land'];
      if (cmd || combo) okStates.push('hitstun');
      if (!okStates.includes(v.state) || !v.grounded || v.invuln > 0) continue;
      this.startThrow(f, v, cmd ? 'hip' : 'normal');
      UI.popText(this, f, cmd ? '업어치기!' : combo ? '잡기 캔슬!' : '잡기!', '#ffd84a');
      return true;
    }
    return false;
  }
  startThrow(f: Fighter, v: Fighter, kind: 'normal' | 'hip' | 'counter') {
    f.faceToward(v.pos, 1); f.setState('throwing'); f.holding = v; f.throwKind = kind; f.move = undefined;
    f.play(kind === 'hip' ? 'pull_throw' : 'OverhandThrow', { speed: kind === 'hip' ? 1.3 : 1.5, loop: false });
    v.setState('thrown'); v.grabbedBy = f; v.play('Hit_Knockback', { loop: false, speed: 0.5 }); v.move = undefined;
    this.fx.hit(v.pos.clone().add(new THREE.Vector3(0, 0.75, 0)), 'grab', new THREE.Vector3(), 1); this.hitStop(f, v, 5);
  }
  releaseThrow(f: Fighter, v: Fighter) {
    v.grabbedBy = undefined; const fw = f.forward();
    const kind = f.throwKind; const dmg = kind === 'hip' ? 130 : kind === 'counter' ? 100 : 90;
    f.combo++; f.comboDmg += dmg; f.comboT = 80; f.stats.maxCombo = Math.max(f.stats.maxCombo, f.combo);
    this.damage(f, v, dmg, v.pos.clone().add(new THREE.Vector3(0, 0.7, 0)), 3);
    if (kind === 'hip') { v.pos.set(f.pos.x + fw.x * 0.2, f.pos.y + 1.0, f.pos.z + fw.z * 0.2); v.vel.set(-fw.x * 3.5, -1.5 * VS, -fw.z * 3.5); } // over the shoulder, slammed down behind
    else if (f.style.comboGrab) v.vel.set(fw.x * 0.9, 5.4 * VS, fw.z * 0.9); // jujutsu: toss the opponent up in front, ready for an air chase
    else v.vel.set(fw.x * 7.5, 4.5 * VS, fw.z * 7.5);
    v.launch(kind !== 'hip'); v.freeze = 0;
    this.camShake = 0.28; this.fovKick = 2.4; this.fx.hit(v.pos.clone().add(new THREE.Vector3(0, 0.7, 0)), 'heavy', fw, 3);
  }

  // ---------- movement events
  onCharge(f: Fighter, t: number) {
    const hand = f.limbPos('hand_r');
    if (t % 3 === 0) this.fx.trail(hand, t >= 20 ? 0xffd166 : 0xff8a3d, t >= 20 ? 3 : 1.5);
    if (t === 20) { this.fx.dust(f.pos, 0.7); this.fx.hit(hand, 'counter', new THREE.Vector3(), 2); this.fx.whoosh(0.5, 0.6); f.flashColor.setRGB(1, 0.75, 0.3); f.flash = 8; } // full charge
  }
  onJump(f: Fighter) { this.fx.whoosh(0.25, 0.7); if (f.airJumps > 0) this.fx.puff(f.pos.clone().add(new THREE.Vector3(0, 0.2, 0)), 0xffffff, 0.8); }
  onLand(f: Fighter, impact: number) {
    f.airJumps = 0;
    if (f.state === 'launched' || f.state === 'fallout') {
      this.fx.dust(f.pos, Math.min(1.6, 0.8 + impact / 8)); this.fx.thud(Math.min(1, impact / 8)); this.camShake = Math.max(this.camShake, Math.min(0.15, impact * 0.02));
      f.setState('down'); f.juggle = 0;
      if (f.downFace) f.play('fall_face', { loop: false, speed: 1.6, at: 0.75, fade: 0.08 }); else f.play('getup_back', { loop: false, speed: 0, at: 0, fade: 0.1 });
      if (f.koPending) f.setState('ko');
    } else if (f.state === 'air' || (f.state === 'attack' && f.move?.air)) {
      f.setState('land'); f.move = undefined; f.play('NinjaJump_Land', { loop: false, speed: 2.2, fade: 0.05 });
      if (impact > 3) this.fx.dust(f.pos);
    }
  }
  onBounce(f: Fighter, impact: number) { this.fx.dust(f.pos); this.fx.thud(Math.min(1, impact / 7)); this.camShake = Math.max(this.camShake, 0.12); }
  onRailHit(f: Fighter) { this.fx.hit(f.pos.clone().add(new THREE.Vector3(0, 0.6, 0)), 'block', new THREE.Vector3(), 2); this.fx.thud(0.6); this.camShake = Math.max(this.camShake, 0.15); }
  onRingOut(f: Fighter) {
    f.setState('out'); f.root.visible = false; f.vel.set(0, 0, 0);
    if (f.alive) { f.alive = false; const by = f.lastHitBy && this.tickN - f.lastHitAt < 300 ? f.lastHitBy : undefined; if (by) by.stats.ringouts++; }
    if (this.match.practice) { f.alive = true; f.pos.set(0, 0, 0); f.root.visible = true; f.setState('idle'); f.play('Idle_Loop'); f.hp = f.maxHp; }
    UI.banner('RING OUT!', 'ringout'); this.fx.sfx('bong_001', 1, 0.7);
  }

  // ---------- style specials
  teleportBehind(f: Fighter) {
    const t = this.nearestEnemy(f, 7);
    this.fx.puff(f.pos.clone().add(new THREE.Vector3(0, 0.65, 0)), 0x222233, 2.2);
    if (t) {
      const b = t.forward().multiplyScalar(-0.95); f.pos.set(t.pos.x + b.x, t.pos.y, t.pos.z + b.z);
      MAP.cur.confine(f.pos, 0.45); f.pos.y = Math.max(f.pos.y, MAP.cur.floor(f.pos.x, f.pos.z)); // keep the destination on the stage
      f.faceToward(t.pos, 1);
    }
    else { const fw = f.forward(); f.pos.addScaledVector(fw, 3); MAP.cur.confine(f.pos, 0.45); f.pos.y = Math.max(f.pos.y, MAP.cur.floor(f.pos.x, f.pos.z)); }
    f.vel.set(0, 0, 0); this.fx.puff(f.pos.clone().add(new THREE.Vector3(0, 0.65, 0)), 0x222233, 2.2); this.fx.whoosh(0.5, 1.6);
  }
  spawnSmoke(f: Fighter) {
    const pos = f.pos.clone(); const sprites: THREE.Sprite[] = [];
    for (let i = 0; i < 14; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.A.tex.get('smoke_04'), color: 0x3b2a55, transparent: true, opacity: 0.0, depthWrite: false }));
      const a = rand() * Math.PI * 2, r = rand() * 2.4;
      s.position.set(pos.x + Math.sin(a) * r, 0.4 + rand() * 1.4, pos.z + Math.cos(a) * r); s.scale.setScalar(2.2 + rand() * 1.6); (s as any).spin = (rand() - 0.5) * 0.02;
      this.scene.add(s); sprites.push(s);
    }
    this.smokes.push({ pos, r: 2.8, t: 240, owner: f, sprites });
    f.veilT = 180; this.fx.thud(0.4); this.fx.whoosh(0.6, 0.5);
    if (f.isPlayer) UI.popText(this, f, '연막!', '#c4b5fd');
  }
  updateSmokes() {
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const s = this.smokes[i]; s.t--;
      const k = s.t > 220 ? (240 - s.t) / 20 : s.t < 40 ? s.t / 40 : 1;
      s.sprites.forEach((x) => { (x.material as THREE.SpriteMaterial).opacity = 0.75 * k; (x.material as THREE.SpriteMaterial).rotation += (x as any).spin; });
      for (const v of this.enemies(s.owner)) if (v.pos.distanceTo(s.pos) < s.r && v.confuseT < 60) { v.confuseT = 90; if (this.tickN % 40 === 0) UI.popText(this, v, '혼란', '#c4b5fd'); }
      if (s.t <= 0) { s.sprites.forEach((x) => this.scene.remove(x)); this.smokes.splice(i, 1); }
    }
  }

  beginTransform(f: Fighter) {
    f.gauge = 0; f.transformT = 15; f.setState('transform'); f.invuln = 45; f.play('Spell_Simple_Enter', { loop: false });
    const col = 0xb07cff;
    f.aura = makeAura(this.A, col); f.root.add(f.aura);
    f.blade = makeBlade(col); const hand = f.bones.hand_r; hand.add(f.blade);
    const idx = f.bones.index_01_r.position.clone(), pk = f.bones.pinky_01_r.position.clone();
    f.blade.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0.7, 0), idx.sub(pk).normalize());
    f.blade.position.copy(f.bones.index_01_r.position).multiplyScalar(0.6);
    this.fx.burst(f.pos.clone().add(new THREE.Vector3(0, 0.7, 0)), col, 4); this.fx.sfx('confirmation_001'); this.camShake = 0.2;
    if (f.isPlayer) UI.banner('SPIRIT!', 'spirit');
  }
  endTransform(f: Fighter) {
    f.transformT = 0;
    if (f.aura) { f.root.remove(f.aura); f.aura = undefined; }
    if (f.blade) { f.blade.parent?.remove(f.blade); f.blade = undefined; }
  }

  // ------------------------------------------------------------------ loop
  /** chord detection: X / C wait a couple of ticks for a partner key (Z+X, Z+C, X+C) */
  private tap = { key: '', t: -99 }; dashing = false; private prevArrows = new Set<string>();
  private pend = { x: -1, c: -1 }; private prevXC = { x: false, c: false };
  readPlayer(): Ctrl {
    const k = this.keys; const c = emptyCtrl();
    let ix = 0, iz = 0;
    // dash: tap a direction twice quickly (within 0.25 s) and hold it
    for (const a of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
      const held = k.has(a);
      if (held && !this.prevArrows.has(a)) { if (this.tap.key === a && this.tickN - this.tap.t <= 15) this.dashing = true; this.tap = { key: a, t: this.tickN }; }
      if (held) this.prevArrows.add(a); else this.prevArrows.delete(a);
    }
    const stick = pad.on && Math.hypot(pad.x, pad.y) > 0.28; // on-screen joystick
    if ((this.prevArrows.size === 0 && !pad.on) || this.player?.dashLock) this.dashing = false; // a dash attack ends the run: double-tap again
    if (k.has('ArrowUp')) iz += 1; if (k.has('ArrowDown')) iz -= 1; if (k.has('ArrowLeft')) ix += 1; if (k.has('ArrowRight')) ix -= 1;
    if (stick) { ix -= pad.x; iz -= pad.y; }
    if (k.has('KeyQ')) this.camYaw += 0.04; if (k.has('KeyE')) this.camYaw -= 0.04;
    const fx = -Math.sin(this.camYaw), fz = -Math.cos(this.camYaw);
    c.mx = fx * iz + fz * ix; c.mz = fz * iz - fx * ix;
    c.dash = this.dashing;
    // Z guard · X hand · C foot (+ wake-up) · Z+X grab · Z+C counter · X+C evade · Space jump · V special
    const z = k.has('KeyZ'), x = k.has('KeyX'), cc = k.has('KeyC'), W = 3;
    if (x && !this.prevXC.x) this.pend.x = this.tickN;
    if (cc && !this.prevXC.c) this.pend.c = this.tickN;
    this.prevXC = { x, c: cc };
    const px = this.pend.x >= 0, pc = this.pend.c >= 0;
    if (px && pc) { c.J = c.K = true; this.pend.x = this.pend.c = -1; }
    else if (px && z) { c.grab = true; this.pend.x = -1; }
    else if (pc && z) { c.counter = true; this.pend.c = -1; }
    else {
      if (px && (this.tickN - this.pend.x >= W || !x)) { c.J = true; this.pend.x = -1; }
      if (pc && (this.tickN - this.pend.c >= W || !cc)) { c.K = true; this.pend.c = -1; }
    }
    c.guard = z && !c.grab && !c.counter && !x && !cc;
    c.Jh = x; // X held (charge moves)
    c.S = k.has('KeyV'); c.jump = k.has('Space');
    c.transform = k.has('KeyO'); c.s1 = k.has('Digit1'); c.s2 = k.has('Digit2');
    return c;
  }

  tick() {
    this.tickN++;
    const inGame = this.screen === 'game' || this.screen === 'round' || this.screen === 'result';
    const fs = this.fighters;
    for (const f of fs) { f.animate(); f.root.updateMatrixWorld(true); }
    if (this.screen === 'select') { const f = fs[0]; if (f) this.selectShowcase(f); this.fx.update(); return; }
    const frozen = inGame && this.introT > 0;
    if (this.introT > 0 && --this.introT === 30 && this.screen === 'game') UI.banner('FIGHT!', 'fight');
    for (const f of fs) {
      if (frozen) f.ctrl = emptyCtrl();
      else if (f === this.player && this.screen === 'game' && this.autopilot) { if (!this.ai.has(f)) this.ai.set(f, new AIController(f, 'hard', rand)); f.ctrl = this.ai.get(f)!.think(fs); }
      else if (f === this.player && this.screen === 'game') f.ctrl = this.readPlayer();
      else if (this.ai.has(f)) f.ctrl = this.ai.get(f)!.think(fs);
      else f.ctrl = this.match.practice && f !== this.player && this.screen === 'game' ? dummyCtrl(this, f) : emptyCtrl();
      f.update(this);
      this.trail(f);
      if (f.aura) f.aura.children.forEach((c: any) => { if (c.isSprite) c.material.rotation += c.spin; });
    }
    this.separate();
    this.updateSmokes();
    this.fx.update();
    if (this.screen === 'game' && !this.match.practice && this.introT <= 0) this.roundLogic();
    if (['title', 'menu', 'setup', 'moves', 'settings', 'credits'].includes(this.screen)) this.attractLogic();
  }
  /** limb trail during active frames: makes every strike readable */
  trail(f: Fighter) {
    if (f.state === 'move' && f.ctrl.dash && f.grounded && (this.tickN + f.id * 3) % 9 === 0 && Math.hypot(f.vel.x, f.vel.z) > 5) this.fx.dust(f.pos, 0.28); // sprint dust
    if (f.state !== 'attack' || !f.move?.hits || f.freeze > 0) return;
    const t = f.animTime(); const col = f.style.color;
    for (const h of f.move.hits) if (t >= h.from - 0.06 && t <= h.to) this.fx.trail(f.limbPos(h.limb), col, (f.move.weight ?? 1));
  }
  separate() {
    const fs = this.fighters;
    for (let i = 0; i < fs.length; i++) for (let j = i + 1; j < fs.length; j++) {
      const a = fs[i], b = fs[j]; if (a.state === 'out' || b.state === 'out' || a.state === 'thrown' || b.state === 'thrown') continue;
      if (a.invuln > 0 && a.move?.lunge || b.invuln > 0 && b.move?.lunge) continue; // shadow dash passes through
      if (Math.abs(a.pos.y - b.pos.y) > 1.2) continue;
      const d = b.pos.clone().sub(a.pos); d.y = 0; const l = d.length();
      if (l < 0.62 && l > 1e-4) { d.multiplyScalar((0.62 - l) / l / 2); a.pos.sub(d); b.pos.add(d); a.clampToRail(); b.clampToRail(); }
    }
  }
  attractLogic() { for (const f of this.fighters) { if (f.hp < 5000) f.hp = 99999; if (f.state === 'out') { f.pos.set(0, 0, 0); f.root.visible = true; f.setState('idle'); f.alive = true; } } }
  selectShowcase(f: Fighter) {
    if (f.state !== 'attack' && this.tickN % 140 === 0) {
      const st = STYLES[this.pcfg.style]; const seq = [st.J, st.K, st.S, st.dashS];
      f.startMove(seq[(this.tickN / 140) % seq.length | 0], this); f.yaw = 0.5;
    }
    if (f.state === 'attack') { this.trail(f); if (f.animDone()) f.toNeutral(); f.vel.set(0, 0, 0); f.pos.set(0, 0, 0); }
    f.root.rotation.y = f.yaw;
  }
  roundLogic() {
    if (this.endT > 0) {
      if (--this.endT === 0) {
        if (this.roundWinner) this.roundWinner.roundWins++;
        const champ = this.fighters.find((f) => f.roundWins >= this.match.wins);
        this.go(champ ? 'result' : 'round');
      }
      return;
    }
    if (this.tickN % 60 === 0) this.timer--;
    const alive = this.fighters.filter((f) => f.alive);
    const teams = new Set(alive.map((f) => f.team));
    if (teams.size <= 1 || this.timer <= 0) {
      let w = alive[0];
      if (this.timer <= 0) w = alive.slice().sort((a, b) => b.hp / b.maxHp - a.hp / a.maxHp)[0];
      this.roundWinner = w; this.endT = 150;
      if (w) { w.setState('victory'); w.play(w.opts.body === 'female' ? 'Yes' : 'Dance_Loop', { fade: 0.2 }); }
      UI.banner(this.timer <= 0 ? 'TIME UP' : w ? `${w.name} 승리!` : 'DRAW', 'win');
    }
  }

  updateCamera(dt: number) {
    const c = this.cam;
    this.fovKick *= 0.86; c.fov = 40 - this.fovKick * 0.8; c.updateProjectionMatrix();
    if (this.camOverride) { c.position.lerp(this.camOverride.pos, 0.15); c.lookAt(this.camOverride.look); return; }
    if (['title', 'menu', 'setup', 'moves', 'settings', 'credits'].includes(this.screen)) {
      const t = performance.now() * 0.00008;
      const mid = this.fighters.reduce((v, f) => v.add(f.pos), new THREE.Vector3()).multiplyScalar(1 / Math.max(1, this.fighters.length));
      c.position.set(mid.x + Math.sin(t) * 5, 2.8, mid.z + Math.cos(t) * 5); c.lookAt(mid.x, 0.7, mid.z); return;
    }
    const p = this.player && this.player.state !== 'out' ? this.player : this.fighters.find((f) => f.alive) || this.fighters[0];
    if (!p) return;
    // quarter view: frame the player together with the opponents close to them
    const focus = p.pos.clone(); let n = 1;
    for (const f of this.fighters) if (f !== p && f.state !== 'out' && f.pos.distanceTo(p.pos) < 6) { focus.addScaledVector(f.pos, 0.5); n += 0.5; }
    focus.multiplyScalar(1 / n); const gy = Math.max(-1.1, MAP.cur.floor(p.pos.x, p.pos.z)); focus.y = gy + Math.max(0, p.pos.y - gy) * 0.4 + 0.65;
    this.camTarget.lerp(focus, 1 - Math.pow(0.0005, dt));
    const off = new THREE.Vector3(Math.sin(this.camYaw) * Math.cos(this.camPitch), Math.sin(this.camPitch), Math.cos(this.camYaw) * Math.cos(this.camPitch)).multiplyScalar(this.camDist);
    c.position.copy(this.camTarget).add(off).add(this.camKick);
    this.camKick.multiplyScalar(0.8);
    if (this.camShake > 0) { c.position.x += (Math.random() - .5) * this.camShake; c.position.y += (Math.random() - .5) * this.camShake; this.camShake *= 0.85; if (this.camShake < 0.01) this.camShake = 0; }
    c.lookAt(this.camTarget);
  }

  drawHitboxes() {
    this.hitboxGroup.clear();
    if (!this.settings.showHitboxes) return;
    const mat = (c: number) => new THREE.MeshBasicMaterial({ color: c, wireframe: true, transparent: true, opacity: 0.7, depthTest: false });
    for (const f of this.fighters) {
      if (f.state === 'out') continue;
      const [a, b] = f.hurtSegment(); const len = a.distanceTo(b);
      const cap = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, len, 4, 8), mat(f.hasArmor() ? 0xff9a2e : 0x44aaff));
      cap.position.copy(a).add(b).multiplyScalar(0.5); cap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0.7, 0), b.clone().sub(a).normalize());
      this.hitboxGroup.add(cap);
      if (f.state === 'attack' && f.move?.hits) {
        const m = f.move; const t = f.animTime();
        m.hits!.forEach((h) => {
          const active = t >= h.from && t <= h.to;
          if (m.radial) { const r = new THREE.Mesh(new THREE.TorusGeometry(m.radial, 0.03, 4, 40), mat(active ? 0xff3030 : 0xffaa00)); r.rotation.x = Math.PI / 2; r.position.copy(f.pos); r.position.y += 0.5; this.hitboxGroup.add(r); }
          else { const s = new THREE.Mesh(new THREE.SphereGeometry(0.24 + (m.reach && !f.blade ? m.reach : 0), 10, 8), mat(active ? 0xff3030 : 0xffaa00)); s.position.copy(f.limbPos(h.limb)); this.hitboxGroup.add(s); }
        });
      }
    }
  }

  frame = (now: number) => {
    requestAnimationFrame(this.frame);
    const raw = (now - this.last) / 1000; const dt = Math.min(0.1, raw); this.last = now;
    // auto quality: step down a preset whenever the frame rate stays low for a while
    if (raw > 0 && raw < 0.5 && !this.manual && !document.hidden && this.screen !== 'loading') {
      this.fps += (1 / raw - this.fps) * 0.05;
      if (this.settings.autoQuality && this.settings.quality !== 'low') {
        this.slowT = this.fps < 40 ? this.slowT + raw : Math.max(0, this.slowT - raw * 2);
        if (this.slowT > 2.5) { this.slowT = 0; this.fps = 60; this.setQuality(this.settings.quality === 'high' ? 'mid' : 'low'); }
      }
    }
    if (!this.manual && this.screen !== 'pause') {
      this.acc += dt;
      while (this.acc >= DT) { this.tick(); this.acc -= DT; }
    }
    this.render(dt);
  };
  render(dt = DT) {
    syncTouch(this); syncPractice(this);
    this.updateCamera(dt);
    this.drawHitboxes();
    this.stage?.userData.tick?.(performance.now() / 1000);
    if (this.settings.quality === 'low') this.renderer.render(this.scene, this.cam); // straight to screen: no post-processing passes
    else this.composer.render();
    UI.updateHud(this);
  }
}

/** Per move: take the impact frames the clip was authored with and open a short hit window around each. */
function analyzeMoves(): Record<string, number> {
  for (const m of Object.values(MOVES)) {
    const meta = META[m.anim]; if (!meta) { console.warn('no anim for move', m.id, m.anim); m.hits = []; continue; }
    const hits: HitPoint[] = meta.hits.map((h) => ({ limb: h.limb, t: h.t, from: Math.max(0, h.t - 0.035), to: h.t + 0.07 }));
    // rush techniques are active for the whole dash, so a fast lunge cannot pass through a target
    if ((m.lunge ?? 0) >= 6 && hits.length === 1) hits[0].from = Math.min(hits[0].from, 0.06);
    if (m.air && hits.length === 1) hits[0].to = hits[0].t + 0.28; // a diving strike stays out on the way down
    m.hits = hits; m.limb = hits[0]?.limb; m.peak = hits[hits.length - 1]?.t ?? 0.2; m.activeFrom = hits[0]?.from; m.activeTo = hits[hits.length - 1]?.to;
  }
  const loco: Record<string, number> = {};
  for (const [n, meta] of Object.entries(META)) if (meta.loco) loco[n] = meta.loco;
  return loco;
}

let game: Game;
export function boot() {
  game = new Game();
  (window as any).__sa = game; (window as any).__moves = MOVES; (window as any).__styles = STYLE_IDS;
  game.init();
}
export type { Game };
