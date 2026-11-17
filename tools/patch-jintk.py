def must(s, a, b):
    assert a in s, a[:80]; return s.replace(a, b, 1)
p = 'src/anims.ts'; s = open(p, encoding='utf-8').read()
s = must(s, "def('tk_punch', [[0, ST]", """// 진태권도: a long, low front stance. The lead fist drives out over the front knee, then the rear fist follows through the hips
const JT_ST = look({ pel: [0, -34, 0], s1: [8, 8, 0], s3: [5, 10, 0], uaL: [-58, -6, 12], laL: -96, uaR: [-34, 12, -16], laR: -128, thL: [-44, 30, 16], cL: 56, fL: -10, thR: [22, -18, -20], cR: 46, fR: -34 });
def('jt_idle_Loop', [[0, JT_ST], [30, look({ ...JT_ST, s1: [10, 8, 0], uaL: [-54, -6, 12], laL: -100, thL: [-48, 30, 16], cL: 62, thR: [24, -18, -20], cR: 50 }), 'io'], [60, JT_ST, 'io']]);
const JTP_W = S({ pel: [0, -18, 0], s1: [6, 12, 0], uaL: [16, -14, 16], laL: -118, uaR: [-40, 14, -16], laR: -120, thL: [-40, 22, 12], cL: 52, p: [0, 0, -0.04] });
const JTP1 = S({ pel: [0, -62, 0], s1: [7, -6, 0], s3: [4, -8, 0], uaL: [-90, 60, 0], laL: -2, uaR: [30, 8, -16], laR: -122, thL: [-56, 56, 8], cL: 66, fL: -10, thR: [32, 18, -10], cR: 8, fR: -42, p: [0, 0, 0.24] });
const JTP2 = S({ pel: [0, 28, 0], s1: [11, 10, 0], s3: [7, 14, 0], uaR: [-94, -48, 0], laR: -4, uaL: [32, -10, 24], laL: -126, thL: [-52, -28, 6], cL: 62, fL: -8, thR: [36, -42, -8], cR: 8, fR: -46, p: [0, 0, 0.26] });
def('jt_punch', [[0, ST], [3, JTP_W, 'out'], ...imp(7, JTP_W, JTP1, 'hand_l', 6, 1.5), [28, ST]]);
def('jt_punch2', [[0, JTP1], [3, { ...JTP1, uaR: [24, 20, -24], laR: -126 }, 'out'], ...imp(7, JTP1, JTP2, 'hand_r', 7, 1.6), [30, ST]]);
def('tk_punch', [[0, ST]""")
open(p, 'w', encoding='utf-8', newline='\n').write(s)

p = 'src/moves.ts'; s = open(p, encoding='utf-8').read()
s = must(s, "  tk_tornado: M(", """  // ===== 진태권도 ===== 품새의 긴 앞굽이에서 나오는 정권 2개 + 전진하는 발차기 4개. 연계: X X / X X C / C C C / X C C C
  jt_punch: M({ id: 'jt_punch', name: '앞굽이 정권', anim: 'jt_punch', speed: 1, dmg: 30, type: 'light', hitstun: 22, kb: [0.7, 0], lunge: 1.6, weight: 1, next: { J: 'jt_punch2', K: 'jt_front' } }),
  jt_punch2: M({ id: 'jt_punch2', name: '반대 지르기', anim: 'jt_punch2', speed: 1, dmg: 38, type: 'light', hitstun: 24, kb: [1.0, 0], lunge: 1.2, weight: 2, next: { K: 'jt_side' } }),
  jt_front: M({ id: 'jt_front', name: '밀어 앞차기', anim: 'kick_front', speed: 1, dmg: 62, type: 'light', hitstun: 30, kb: [1.2, 0], reach: 0.15, lunge: 2.4, weight: 2, next: { K: 'jt_round' } }),
  jt_round: M({ id: 'jt_round', name: '돌려차기', anim: 'kick_round', speed: 1, dmg: 82, type: 'light', hitstun: 32, kb: [1.4, 0], reach: 0.15, lunge: 2.6, weight: 2, next: { K: 'jt_spin' } }),
  jt_spin: M({ id: 'jt_spin', name: '회전 발차기', anim: 'kick_spin', speed: 1, dmg: 120, type: 'knockdown', kb: [10.5, 3.4], reach: 0.15, lunge: 2.2, weight: 3 }),
  jt_side: M({ id: 'jt_side', name: '옆차기', anim: 'kick_side', speed: 1, dmg: 95, type: 'knockdown', kb: [11, 2.8], reach: 0.2, lunge: 2.6, weight: 3 }),
  tk_tornado: M(""")
s = must(s, "  jujutsu: {\n", """  jintk: {
    id: 'jintk', name: '진태권도', color: 0x7c6cf5, concept: '품새의 앞굽이, 전진하는 강한 발차기, 텀을 두는 심리전',
    desc: '낮고 긴 앞굽이로 버티다가 정권으로 문을 열고, 한 발 한 발 앞으로 밀고 들어가는 발차기로 압박한다. 맞힌 뒤에는 다음 타를 늦게 눌러도 이어져서, 박자를 바꿔 상대의 가드와 반격을 흔들 수 있다.',
    traits: ['발차기마다 크게 전진한다 (거리 압박)', '발차기 피해가 태권도보다 높다 (회전 발차기 120)', '텀 연계: 맞힌 뒤 다음 입력을 늦게 눌러도 이어진다', '정권은 태권도보다 느리지만 묵직하다'],
    J: 'jt_punch', K: 'jt_front', S: 'tk_tornado', dashJ: 'rush', dashK: 'tk_jumpside', dashS: 'tk_tornado', air: 'jumpkick',
    grabRange: 1.2, chainHold: 16, anims: { Idle_Loop: 'jt_idle_Loop' }, stats: { 속도: 3, 리치: 5, 콤보: 4, 파워: 4, 잡기: 1 },
    combos: ['X X — 앞굽이 정권 · 반대 지르기 (기본 견제)', 'C C — 밀어 앞차기 · 돌려차기 (거리 압박)', 'C C C — 앞차기 · 돌려차기 · 회전 발차기 (다운)', 'X X C — 정권 2연타 · 옆차기 (다운·링아웃)', 'X C C C — 정권 · 앞차기 · 돌려차기 · 회전 발차기 (다운)'],
  },
  jujutsu: {
""")
s = must(s, "moveSpeed?: number; anims?", "moveSpeed?: number; /** extra frames the follow-up window stays open after a landed hit */ chainHold?: number; anims?")
s = must(s, "export const OPEN_STYLES = ['taekwondo', 'ironbone'];", "export const OPEN_STYLES = ['taekwondo', 'jintk', 'ironbone'];")
open(p, 'w', encoding='utf-8', newline='\n').write(s)

p = 'src/fighter.ts'; s = open(p, encoding='utf-8').read()
s = must(s, "((this.hitDone.size > 0 ? 13 : 6) / 60) * m.speed;", "((this.hitDone.size > 0 ? 13 + (this.style.chainHold ?? 0) : 6) / 60) * m.speed;")
open(p, 'w', encoding='utf-8', newline='\n').write(s)
