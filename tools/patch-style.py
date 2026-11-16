import re, glob
OUT = {}
def rw(p, f):
    s = open(p, encoding='utf-8').read(); OUT[p] = f(s)
def must(s, a, b):
    assert a in s, a[:90]; return s.replace(a, b)

def game(s):
    s = must(s, "hitStop(a: Fighter, b: Fighter, frames: number) { a.freeze = Math.max(a.freeze, frames); b.freeze = Math.max(b.freeze, frames); b.shake = frames; }",
      "/** impact feedback only: nobody is ever frozen or slowed, the victim just rattles for a few frames */\n  hitStop(a: Fighter, b: Fighter, frames: number) { b.shake = Math.max(b.shake, Math.min(12, frames)); a.hitT = b.hitT = Math.max(4, frames); }")
    s = must(s, "if (imp > 1 && w >= 2 && v.grounded) this.fx.dust(v.pos, 0.45 + 0.15 * w);", "if (imp > 1 && w >= 2 && v.grounded) this.fx.dust(v.pos, 0.45 + 0.15 * w);\n    if (imp >= 1.4 && w >= 3 && att.grounded) this.fx.dust(att.pos, 0.55); // iron-heavy blows: the striker's planted foot cracks the floor too")
    return s
rw('src/game.ts', game)

def fighter(s):
    s = must(s, "    const a = this.actions.get(name); if (!a) { console.warn('no anim', name); return; }", "    const a = this.actions.get(this.style.anims?.[name] ?? name); if (!a) { console.warn('no anim', name); return; } // each style may bring its own stance")
    s = must(s, "const speed = c.dash ? 7.0 : 4.2;", "const speed = (c.dash ? 7.0 : 4.2) * (this.style.moveSpeed ?? 1);")
    s = must(s, "freeze = 0;", "freeze = 0; hitT = 0;")
    s = must(s, "if (this.shake > 0) this.shake--;", "if (this.shake > 0) this.shake--; if (this.hitT > 0) this.hitT--;")
    return s
rw('src/fighter.ts', fighter)

def anims(s):
    s = must(s, "function runCycle(", """// --- style stances
// 태권도: side-on and light on the toes, bouncing and switching weight the whole time
const TK_LO = look({ pel: [0, -54, 0], s1: [3, 14, 0], s3: [0, 16, 0], uaL: [-24, -8, 14], laL: -62, uaR: [-26, 18, -16], laR: -126, thL: [-28, 48, 8], cL: 40, fL: -12, thR: [14, 12, -12], cR: 36, fR: -36 });
const TK_HI = look({ pel: [0, -50, 0], s1: [0, 13, 0], s3: [0, 15, 0], uaL: [-30, -8, 16], laL: -74, uaR: [-30, 18, -18], laR: -132, thL: [-14, 44, 8], cL: 14, fL: 24, thR: [6, 12, -12], cR: 12, fR: 14, p: [0, 0.07, 0] });
const TK_LO2 = look({ pel: [0, -44, 0], s1: [4, 12, 0], s3: [0, 14, 0], uaL: [-20, -8, 14], laL: -56, uaR: [-24, 18, -16], laR: -122, thL: [-20, 38, 8], cL: 36, fL: -16, thR: [4, 4, -12], cR: 34, fR: -30, p: [0, 0, 0.03] });
def('tk_idle_Loop', [[0, TK_LO], [6, TK_HI, 'out'], [12, TK_LO2, 'in'], [18, { ...TK_HI, p: [0, 0.06, 0.02] }, 'out'], [24, TK_LO, 'in']]);
// 철골권: a low, square horse stance that does not move - one fist chambered at the hip, slow breathing
const IB_ST = look({ pel: [2, -14, 0], s1: [5, 4, 0], s3: [2, 6, 0], uaL: [-58, -8, 8], laL: -52, uaR: [16, 4, -14], laR: -116, thL: [-56, 24, 28], cL: 70, fL: [-14, 0, -24], thR: [-48, -20, -28], cR: 66, fR: [-18, 0, 24] });
def('ib_idle_Loop', [[0, IB_ST], [44, look({ ...IB_ST, pel: [3, -14, 0], s1: [8, 4, 0], uaL: [-55, -8, 9], laL: -56, thL: [-60, 24, 28], cL: 77, fL: [-17, 0, -24], thR: [-52, -20, -28], cR: 73, fR: [-21, 0, 24] })], [88, IB_ST]]);

function runCycle(""")
    s = must(s, "// hook (lead hand):", """// 태권도 정권지르기: no wind-up to speak of - the fist fires from the hip while the other hand snaps back to the belt
const TKP_W = S({ pel: [0, -42, 0], uaR: [22, 12, -14], laR: -112, uaL: [-72, 26, 4], laL: -22, p: [0, 0, 0.02] });
const TKP = S({ pel: [0, 8, 0], s1: [4, 6, 0], s3: [2, 8, 0], uaR: [-90, -30, 0], laR: -2, uaL: [26, -6, 16], laL: -118, thL: [-36, -10, 8], cL: 42, fL: -8, thR: [24, -26, -10], cR: 14, fR: -40, p: [0, 0, 0.1] });
const TKP2 = S({ pel: [0, -60, 0], s1: [4, -6, 0], s3: [2, -6, 0], uaL: [-90, 58, 0], laL: -2, uaR: [26, 8, -16], laR: -118, thL: [-38, 54, 8], cL: 42, fL: -6, thR: [20, 16, -10], cR: 18, fR: -40, p: [0, 0, 0.1] });
def('tk_punch', [[0, ST], [2, TKP_W, 'out'], ...imp(5, TKP_W, TKP, 'hand_r', 4, 1.3), [17, ST]]);
def('tk_punch2', [[0, TKP], ...imp(4, TKP, TKP2, 'hand_l', 4, 1.3), [16, ST]]);
def('tk_punch3', [[0, TKP2], ...imp(4, TKP2, TKP, 'hand_r', 5, 1.4), [20, ST]]);
// 철골권 직권: sink, load the hip for a long beat, then the whole body drops behind one fist and stays there
const IBP_W = S({ pel: [5, -60, 0], s1: [12, -6, 0], s3: [6, -6, 0], uaR: [34, 18, -16], laR: -122, uaL: [-76, 44, 4], laL: -18, thL: [-62, 54, 16], cL: 82, fL: -20, thR: [-22, 14, -22], cR: 70, fR: -46, p: [0, 0, -0.1] });
const IBP = S({ pel: [8, 32, 0], s1: [12, 10, 0], s3: [6, 14, 0], uaR: [-88, -56, 0], laR: -2, uaL: [32, -8, 18], laL: -124, thL: [-66, -32, 10], cL: 78, fL: -10, thR: [38, -48, -8], cR: 10, fR: -46, p: [0, 0, 0.26] });
def('ib_straight', [[0, ST], [9, IBP_W, 'out'], [12, S({ ...IBP_W, p: [0, 0, -0.12] })], ...imp(16, IBP_W, IBP, 'hand_r', 13, 1.9), [50, ST]]);
// 철골권 횡권: a wide swinging hammer of a hook, thrown from a deep stance
const IBH_W = S({ pel: [4, -70, 0], s1: [10, -8, 0], s3: [4, -10, 0], uaL: [10, 30, 86], laL: -70, uaR: [-30, 10, -20], laR: -128, thL: [-56, 64, 12], cL: 76, fL: -20, thR: [-6, 22, -18], cR: 62, fR: -44, p: [0, 0, -0.06] });
const IBH = S({ pel: [6, 36, 0], s1: [12, 14, 0], s3: [6, 18, 0], uaL: [0, -96, 88], laL: -66, uaR: [24, 0, -24], laR: -126, thL: [-58, -38, 8], cL: 70, fL: -10, thR: [34, -46, -8], cR: 14, fR: -46, p: [0.03, 0, 0.26] });
def('ib_hook', [[0, ST], [10, IBH_W, 'out'], ...imp(16, IBH_W, IBH, 'hand_l', 12, 1.9), [48, ST]]);

// hook (lead hand):""")
    return s
rw('src/anims.ts', anims)

def moves(s):
    a = s.index("  tk_punch: M("); b = s.index("  tk_front: M(")
    s = s[:a] + """  tk_punch: M({ id: 'tk_punch', name: '정권지르기', anim: 'tk_punch', speed: 1, dmg: 24, type: 'light', hitstun: 16, kb: [0.5, 0], lunge: 1.2, weight: 1, next: { J: 'tk_punch2', K: 'tk_front' } }),
  tk_punch2: M({ id: 'tk_punch2', name: '두번지르기', anim: 'tk_punch2', speed: 1, dmg: 24, type: 'light', hitstun: 16, kb: [0.5, 0], weight: 1, next: { J: 'tk_punch3', K: 'tk_side' } }),
  tk_punch3: M({ id: 'tk_punch3', name: '세번지르기', anim: 'tk_punch3', speed: 1, dmg: 30, type: 'light', hitstun: 20, kb: [1.0, 0], weight: 1, next: { K: 'tk_side' } }),
""" + s[b:]
    a = s.index("  ib_a: M("); b = s.index("  ib_elbow: M(")
    s = s[:a] + """  ib_a: M({ id: 'ib_a', name: '직권', anim: 'ib_straight', speed: 1, dmg: 62, type: 'light', hitstun: 30, kb: [1.8, 0], lunge: 0.8, weight: 3, next: { J: 'ib_b' } }),
  ib_b: M({ id: 'ib_b', name: '횡권', anim: 'ib_hook', speed: 1, dmg: 72, type: 'light', hitstun: 32, kb: [2.2, 0], weight: 3, next: { J: 'ib_c' } }),
  ib_c: M({ id: 'ib_c', name: '호조수', anim: 'punch_seq_c', speed: 0.9, dmg: 105, type: 'knockdown', kb: [9, 3], weight: 3 }),
  ib_k1: M({ id: 'ib_k1', name: '정강이 차기', anim: 'kick_low', speed: 0.85, dmg: 52, type: 'light', hitstun: 28, kb: [1.2, 0], low: true, weight: 2, next: { K: 'ib_k2', J: 'ib_burst' } }),
  ib_k2: M({ id: 'ib_k2', name: '무릎 치기', anim: 'knee', speed: 0.85, dmg: 60, type: 'light', hitstun: 30, kb: [1.4, 0], weight: 3, next: { K: 'ib_k3', J: 'ib_elbow' } }),
  ib_k3: M({ id: 'ib_k3', name: '짓밟아 차기', anim: 'stomp_kick', speed: 1, dmg: 100, type: 'knockdown', kb: [9.5, 2.6], weight: 3 }),
""" + s[b:]
    s = must(s, "grabRange: number; impact?: number;", "grabRange: number; impact?: number; moveSpeed?: number; anims?: Record<string, string>;")
    a = s.index("  taekwondo: {"); b = s.index("  jujutsu: {")
    s = s[:a] + """  taekwondo: {
    id: 'taekwondo', name: '태권도', color: 0x3b82f6, concept: '경쾌한 스텝, 빠른 정권, 결정타는 발차기',
    desc: '제자리 스텝을 밟다가 가볍고 빠른 정권 연타로 틈을 만들고, 길고 화려한 발차기로 끝낸다. 주먹은 약하지만 가장 먼저 닿는다.',
    traits: ['제자리 스텝 · 이동 속도 +6%', '정권지르기: 발동 5F로 가장 빠르다 (피해는 가벼움)', '발차기 리치 +15~20cm', '발차기 결정타: 뒤후려차기 · 뒤돌려차기 · 옆차기'],
    J: 'tk_punch', K: 'tk_front', S: 'tk_tornado', dashJ: 'rush', dashK: 'tk_jumpside', dashS: 'tk_tornado', air: 'jumpkick',
    grabRange: 1.2, moveSpeed: 1.06, anims: { Idle_Loop: 'tk_idle_Loop' }, stats: { 속도: 5, 리치: 5, 콤보: 5, 파워: 3, 잡기: 1 },
    combos: ['X X X C — 정권 3연타 · 옆차기 (다운·링아웃)', 'X C C C — 정권 · 앞차기 · 돌려차기 · 뒤후려차기 (다운)', 'C C X — 앞차기 · 돌려차기 · 뒤돌려차기 (다운·링아웃)', 'C X — 앞차기 · 나래차기 (띄우기) → 점프 → C', 'V — 540 회전차기 · 대시 C — 이단 옆차기'],
  },
""" + s[b:]
    a = s.index("  ironbone: {"); b = s.index("};\n// every style shares")
    s = s[:a] + """  ironbone: {
    id: 'ironbone', name: '철골권', color: 0xb45309, concept: '느리지만 한 방 한 방이 쇳덩이',
    desc: '낮은 기마 자세로 버티고 서서, 허리를 끝까지 감았다가 온몸으로 내리꽂는다. 발동은 느리지만 한 대가 다른 비전서의 두세 대 값을 한다.',
    traits: ['움직이지 않는 기마 자세 · 이동 속도 -8%', '모든 타격이 묵직하다: 피해 +50%, 발동은 느림', '받는 피해 -15%', 'C 다음 X를 누르고 있으면 기 모으기 → 가드 불가 붕권'],
    J: 'ib_a', K: 'ib_k1', S: 'ib_bash', dashJ: 'rush', dashK: 'ib_k3', dashS: 'ib_bash', air: 'jumpkick',
    grabRange: 1.25, impact: 1.5, dmgTaken: 0.85, moveSpeed: 0.92, anims: { Idle_Loop: 'ib_idle_Loop' }, stats: { 속도: 1, 리치: 2, 콤보: 2, 파워: 5, 잡기: 3 },
    combos: ['X X X — 직권 · 횡권 · 호조수 (다운)', 'C C C — 정강이 · 무릎 · 짓밟아 차기 (다운)', 'C C X X — 정강이 · 무릎 · 팔꿈치 · 쌍장 (띄우기) → X 끊치', 'C X(홀드) — 기 모은 붕권 (가드 불가)'],
  },
""" + s[b:]
    return s
rw('src/moves.ts', moves)

for p in glob.glob('tools/*.mjs'):
    s = open(p, encoding='utf-8').read(); s2 = re.sub(r'P\.freeze > \d', 'P.hitT > 0', s)
    if s2 != s: OUT[p] = s2; print('tool', p)
for p, s in OUT.items(): open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('ok')
