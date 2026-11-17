// Techniques and fighting styles (비전서).
// Hit timing comes from the animation itself (every clip marks its impact frames), so visuals and hit frames
// always match. Clips are authored at game speed: speed 1 is the intended weight.
export type HitType = 'light' | 'launch' | 'knockdown';
export type Limb = 'hand_l' | 'hand_r' | 'foot_l' | 'foot_r' | 'calf_l' | 'calf_r' | 'lowerarm_l' | 'lowerarm_r' | 'upperarm_l' | 'upperarm_r';
export type Special = 'teleport' | 'smoke' | 'cmdgrab';

export interface HitPoint { limb: Limb; t: number; from: number; to: number }
export interface MoveDef {
  id: string; name: string; anim: string; speed: number;
  dmg: number;                 // per hit
  type: HitType;               // reaction of the LAST hit (earlier hits of multi-hit moves are light)
  hitstun?: number;            // frames for light hits
  kb: [number, number];        // knockback: horizontal, vertical (m/s)
  next?: { J?: string; K?: string; S?: string };
  hitCount?: number;           // >1 = multi-hit (peaks detected from the clip)
  guardBreak?: boolean; armor?: boolean; radial?: number; reach?: number; lunge?: number; /** forward travel (m/s) that stops at striking distance */ step?: number;
  air?: boolean; mp?: number; invuln?: number; special?: Special; low?: boolean;
  weight?: 1 | 2 | 3;          // hit-feel weight (hit-stop, shake, sound)
  nanmu?: boolean;             // part of the 난무 rush (V mash): chains only on hit, never trips the stun-lock breaker
  charge?: boolean;            // hold the hand button to charge: full charge = guard crush, x1.6 damage
  // filled at load time
  hits?: HitPoint[]; limb?: Limb; peak?: number; activeFrom?: number; activeTo?: number;
}

const M = (m: MoveDef) => m;
export const MOVES: Record<string, MoveDef> = {
  // ===== 킥복싱 =====
  kb_jab: M({ id: 'kb_jab', name: '잽', anim: 'Punch_Jab', speed: 1, dmg: 38, type: 'light', hitstun: 20, kb: [1.2, 0], next: { J: 'kb_cross', K: 'kb_low' } }),
  kb_cross: M({ id: 'kb_cross', name: '크로스', anim: 'Punch_Cross', speed: 1, dmg: 46, type: 'light', hitstun: 22, kb: [1.6, 0], next: { J: 'kb_hook', K: 'kb_mid' } }),
  kb_hook: M({ id: 'kb_hook', name: '훅', anim: 'Melee_Hook', speed: 1, dmg: 72, type: 'knockdown', kb: [6.5, 2.4], weight: 3 }),
  kb_low: M({ id: 'kb_low', name: '로우킥', anim: 'kick_low', speed: 1, dmg: 45, type: 'light', hitstun: 24, kb: [1, 0], low: true, next: { K: 'kb_high', J: 'kb_knee' } }),
  kb_mid: M({ id: 'kb_mid', name: '미들킥', anim: 'kick_mid', speed: 1, dmg: 55, type: 'light', hitstun: 26, kb: [2, 0], weight: 2, next: { K: 'kb_high', J: 'kb_knee' } }),
  kb_high: M({ id: 'kb_high', name: '하이킥', anim: 'kick_round', speed: 1, dmg: 85, type: 'knockdown', kb: [8, 3], weight: 3 }),
  kb_knee: M({ id: 'kb_knee', name: '니킥 (띄우기)', anim: 'knee', speed: 1, dmg: 60, type: 'launch', kb: [0.4, 5.6], weight: 2 }),
  kb_onetwo: M({ id: 'kb_onetwo', name: '원투쓰리', anim: 'box_triple', speed: 1, dmg: 30, hitCount: 3, type: 'light', hitstun: 24, kb: [0.35, 0], next: { J: 'kb_hook', K: 'kb_high' } }),
  kb_flyknee: M({ id: 'kb_flyknee', name: '플라잉 니킥', anim: 'knee_fly', speed: 1, dmg: 80, type: 'launch', kb: [0.8, 5.6], lunge: 6, weight: 3 }),
  kb_superman: M({ id: 'kb_superman', name: '슈퍼맨 펀치', anim: 'Punch_Cross', speed: 1, dmg: 60, type: 'light', hitstun: 26, kb: [3, 0], lunge: 6.5, weight: 2, next: { K: 'kb_high' } }),

  // ===== 태권도 =====
  // 손 2개 · 발 5개 · 띄우기 1개 · 특수 2개. 연계: X X C / C C C / C C X / C X(띄우기)
  tk_punch: M({ id: 'tk_punch', name: '정권지르기', anim: 'tk_punch', speed: 1, dmg: 24, type: 'light', hitstun: 16, kb: [0.5, 0], lunge: 1.2, weight: 1, next: { J: 'tk_punch2', K: 'tk_front' } }),
  tk_punch2: M({ id: 'tk_punch2', name: '두번지르기', anim: 'tk_punch2', speed: 1, dmg: 24, type: 'light', hitstun: 16, kb: [0.5, 0], weight: 1, next: { J: 'tk_punch3', K: 'tk_side' } }),
  tk_punch3: M({ id: 'tk_punch3', name: '세번지르기', anim: 'tk_punch3', speed: 1, dmg: 30, type: 'light', hitstun: 20, kb: [1.0, 0], weight: 1, next: { K: 'tk_side' } }),
  tk_front: M({ id: 'tk_front', name: '앞차기', anim: 'kick_front', speed: 1, dmg: 55, type: 'light', hitstun: 24, kb: [1.4, 0], reach: 0.15, weight: 2, next: { K: 'tk_round', J: 'tk_double' } }),
  tk_round: M({ id: 'tk_round', name: '돌려차기', anim: 'kick_round', speed: 1, dmg: 70, type: 'light', hitstun: 28, kb: [1.8, 0], reach: 0.15, weight: 2, next: { K: 'tk_back', J: 'tk_hook' } }),
  tk_hook: M({ id: 'tk_hook', name: '뒤돌려차기', anim: 'kick_spin', speed: 1, dmg: 105, type: 'knockdown', kb: [10.5, 3.4], reach: 0.15, weight: 3 }),
  tk_back: M({ id: 'tk_back', name: '뒤후려차기', anim: 'kick_back_spin', speed: 1, dmg: 100, type: 'knockdown', kb: [10, 3.2], reach: 0.15, weight: 3 }),
  tk_side: M({ id: 'tk_side', name: '옆차기', anim: 'kick_side', speed: 1, dmg: 85, type: 'knockdown', kb: [11, 2.8], reach: 0.2, weight: 3 }),
  tk_double: M({ id: 'tk_double', name: '나래차기 (띄우기)', anim: 'kick_double', speed: 1, dmg: 40, hitCount: 2, type: 'launch', hitstun: 22, kb: [0.8, 6.4], lunge: 2.2, weight: 2 }),
  // ===== 진태권도 ===== 품새의 긴 앞굽이에서 나오는 정권 2개 + 전진하는 발차기 4개. 연계: X X / X X C / C C C / X C C C
  jt_punch: M({ id: 'jt_punch', name: '앞굽이 정권', anim: 'jt_punch', speed: 1, dmg: 30, type: 'light', hitstun: 22, kb: [1.4, 0], step: 2.4, weight: 1, next: { J: 'jt_punch2', K: 'jt_front' } }),
  jt_punch2: M({ id: 'jt_punch2', name: '반대 지르기', anim: 'jt_punch2', speed: 1, dmg: 38, type: 'light', hitstun: 24, kb: [1.8, 0], step: 2.2, weight: 2, next: { K: 'jt_side' } }),
  jt_front: M({ id: 'jt_front', name: '밀어 앞차기', anim: 'kick_front', speed: 1, dmg: 62, type: 'light', hitstun: 30, kb: [2.4, 0], reach: 0.15, step: 5.2, weight: 2, next: { K: 'jt_round' } }),
  jt_round: M({ id: 'jt_round', name: '돌려차기', anim: 'kick_round', speed: 1, dmg: 82, type: 'light', hitstun: 32, kb: [2.8, 0], reach: 0.15, step: 4.4, weight: 2, next: { K: 'jt_spin' } }),
  jt_spin: M({ id: 'jt_spin', name: '회전 발차기', anim: 'kick_spin', speed: 1, dmg: 120, type: 'knockdown', kb: [10.5, 3.4], reach: 0.15, step: 4.0, weight: 3 }),
  jt_side: M({ id: 'jt_side', name: '옆차기', anim: 'kick_side', speed: 1, dmg: 95, type: 'knockdown', kb: [11, 2.8], reach: 0.2, step: 4.4, weight: 3 }),
  tk_tornado: M({ id: 'tk_tornado', name: '540 회전차기', anim: 'kick_tornado', speed: 1, dmg: 110, type: 'knockdown', kb: [9, 4], weight: 3, reach: 0.15 }),
  tk_jumpside: M({ id: 'tk_jumpside', name: '이단 옆차기', anim: 'kick_jump', speed: 1, dmg: 90, type: 'knockdown', kb: [10, 3.5], lunge: 7, weight: 3 }),

  // ===== 유술 =====
  ju_palm: M({ id: 'ju_palm', name: '장타', anim: 'Punch_Jab', speed: 1, dmg: 35, type: 'light', hitstun: 24, kb: [0.6, 0], next: { J: 'ju_elbow', K: 'ju_sweep' } }),
  ju_elbow: M({ id: 'ju_elbow', name: '팔꿈치 치기', anim: 'punch_seq_b', speed: 1, dmg: 45, type: 'light', hitstun: 28, kb: [0.6, 0], next: { K: 'ju_sweep' } }),
  ju_low: M({ id: 'ju_low', name: '정강이 차기', anim: 'kick_low', speed: 1, dmg: 40, type: 'light', hitstun: 24, kb: [0.6, 0], low: true, next: { K: 'ju_sweep', J: 'ju_elbow' } }),
  ju_sweep: M({ id: 'ju_sweep', name: '다리후리기', anim: 'kick_low', speed: 1, dmg: 60, type: 'knockdown', kb: [1.5, 2.2], low: true, weight: 2 }),
  ju_hipthrow: M({ id: 'ju_hipthrow', name: '업어치기 (가드불가 잡기)', anim: 'pull_throw', speed: 1, dmg: 130, type: 'knockdown', kb: [0, 0], special: 'cmdgrab', weight: 3 }),
  ju_tackle: M({ id: 'ju_tackle', name: '태클 (슈퍼아머)', anim: 'Shield_Dash_RM', speed: 1, dmg: 70, type: 'knockdown', kb: [5, 2.5], lunge: 7, armor: true, weight: 3 }),

  // ===== 인술 =====
  nj_a: M({ id: 'nj_a', name: '수도 1', anim: 'punch_seq_a', speed: 1, dmg: 30, type: 'light', hitstun: 18, kb: [0.8, 0], next: { J: 'nj_b', K: 'nj_flip' } }),
  nj_b: M({ id: 'nj_b', name: '수도 2', anim: 'punch_seq_b', speed: 1, dmg: 32, type: 'light', hitstun: 18, kb: [0.8, 0], next: { J: 'nj_c', K: 'nj_flip' } }),
  nj_c: M({ id: 'nj_c', name: '수도 3', anim: 'punch_seq_c', speed: 1, dmg: 36, type: 'light', hitstun: 20, kb: [1, 0], next: { K: 'nj_spin' } }),
  nj_spin: M({ id: 'nj_spin', name: '선풍각', anim: 'kick_spin', speed: 1, dmg: 60, type: 'knockdown', kb: [7, 3.2], weight: 3 }),
  nj_low: M({ id: 'nj_low', name: '하단 차기', anim: 'kick_low', speed: 1, dmg: 36, type: 'light', hitstun: 20, kb: [0.6, 0], low: true, next: { K: 'nj_flip', J: 'nj_a' } }),
  nj_flip: M({ id: 'nj_flip', name: '공중제비 차기 (띄우기)', anim: 'flip_kick', speed: 1, dmg: 55, type: 'launch', kb: [0.8, 6.6], lunge: 2.5, weight: 2, next: { J: 'nj_a' } }),
  nj_blink: M({ id: 'nj_blink', name: '순보 (등 뒤로 순간이동)', anim: 'Spell_Simple_Shoot', speed: 1.6, dmg: 0, type: 'light', kb: [0, 0], special: 'teleport', invuln: 18, next: { J: 'nj_a', K: 'nj_flip' } }),
  nj_slide: M({ id: 'nj_slide', name: '슬라이딩', anim: 'Slide_Start', speed: 1, dmg: 50, type: 'knockdown', kb: [3, 3.2], lunge: 8.5, low: true, weight: 2 }),

  // ===== 연막류 인술 =====
  sm_a: M({ id: 'sm_a', name: '암수 1', anim: 'punch_seq_a', speed: 1, dmg: 30, type: 'light', hitstun: 20, kb: [0.8, 0], next: { J: 'sm_b', K: 'sm_front' } }),
  sm_b: M({ id: 'sm_b', name: '암수 2', anim: 'punch_seq_b', speed: 1, dmg: 32, type: 'light', hitstun: 22, kb: [1, 0], next: { K: 'sm_round' } }),
  sm_round: M({ id: 'sm_round', name: '그림자 돌려차기', anim: 'kick_round', speed: 1, dmg: 70, type: 'knockdown', kb: [8, 3], weight: 3 }),
  sm_front: M({ id: 'sm_front', name: '안개 앞차기', anim: 'kick_front', speed: 1, dmg: 48, type: 'light', hitstun: 24, kb: [1.6, 0], next: { K: 'sm_back', J: 'sm_a' } }),
  sm_back: M({ id: 'sm_back', name: '뒤돌려차기', anim: 'kick_back_spin', speed: 1, dmg: 85, type: 'knockdown', kb: [9.5, 3.2], weight: 3 }),
  sm_smoke: M({ id: 'sm_smoke', name: '연막 (혼란 + 은신)', anim: 'Spell_Simple_Shoot', speed: 1, dmg: 0, type: 'light', kb: [0, 0], special: 'smoke' }),
  sm_shadow: M({ id: 'sm_shadow', name: '그림자 관통 (무적 돌진)', anim: 'punch_seq_c', speed: 1, dmg: 70, type: 'launch', kb: [2, 6], lunge: 11, invuln: 24, weight: 3, next: { K: 'sm_back' } }),

  // ===== 자유격투 =====
  ff_jab: M({ id: 'ff_jab', name: '잽', anim: 'Punch_Jab', speed: 1, dmg: 38, type: 'light', hitstun: 20, kb: [1.2, 0], next: { J: 'ff_cross', K: 'ff_knee' } }),
  ff_cross: M({ id: 'ff_cross', name: '크로스', anim: 'Punch_Cross', speed: 1, dmg: 48, type: 'light', hitstun: 22, kb: [1.6, 0], next: { J: 'ff_hook', K: 'ff_high' } }),
  ff_hook: M({ id: 'ff_hook', name: '훅', anim: 'Melee_Hook', speed: 1, dmg: 72, type: 'knockdown', kb: [6.5, 2.4], weight: 3 }),
  ff_knee: M({ id: 'ff_knee', name: '니킥', anim: 'knee', speed: 1, dmg: 55, type: 'light', hitstun: 26, kb: [1.2, 0], weight: 2, next: { K: 'ff_flyknee', J: 'ff_cross' } }),
  ff_flyknee: M({ id: 'ff_flyknee', name: '플라잉 니 (띄우기)', anim: 'knee_fly', speed: 1, dmg: 70, type: 'launch', kb: [0.5, 5.6], weight: 3 }),
  ff_high: M({ id: 'ff_high', name: '하이킥', anim: 'kick_round', speed: 1, dmg: 85, type: 'knockdown', kb: [8, 3], weight: 3 }),
  ff_power: M({ id: 'ff_power', name: '파워 스트레이트 (슈퍼아머·가드브레이크)', anim: 'charge_punch', speed: 1, dmg: 100, type: 'knockdown', kb: [9, 3], armor: true, guardBreak: true, weight: 3 }),
  ff_tackle: M({ id: 'ff_tackle', name: '테이크다운 (슈퍼아머)', anim: 'Shield_Dash_RM', speed: 1, dmg: 80, type: 'knockdown', kb: [4, 2.5], lunge: 7.5, armor: true, weight: 3 }),

  // ===== 철골권 (단련된 몸의 묵직한 근접 타격) =====
  // X X X / C C C / C C X X(띄우기) / C X, C (X 홀드) = 기 모으기 가드 불가
  ib_a: M({ id: 'ib_a', name: '직권', anim: 'ib_straight', speed: 1, dmg: 62, type: 'light', hitstun: 30, kb: [1.8, 0], lunge: 0.8, weight: 3, next: { J: 'ib_b' } }),
  ib_b: M({ id: 'ib_b', name: '역권', anim: 'ib_hook', speed: 1, dmg: 72, type: 'light', hitstun: 32, kb: [2.2, 0], weight: 3, next: { J: 'ib_c' } }),
  ib_c: M({ id: 'ib_c', name: '호조수', anim: 'punch_seq_c', speed: 0.9, dmg: 105, type: 'knockdown', kb: [7.5, 2.8], weight: 3 }),
  ib_k1: M({ id: 'ib_k1', name: '정강이 차기', anim: 'kick_low', speed: 0.85, dmg: 52, type: 'light', hitstun: 28, kb: [1.2, 0], low: true, weight: 2, next: { K: 'ib_k2', J: 'ib_burst' } }),
  ib_k2: M({ id: 'ib_k2', name: '무릎 치기', anim: 'knee', speed: 0.85, dmg: 60, type: 'light', hitstun: 30, kb: [1.4, 0], weight: 3, next: { K: 'ib_k3', J: 'ib_elbow' } }),
  ib_k3: M({ id: 'ib_k3', name: '짓밟아 차기', anim: 'stomp_kick', speed: 1, dmg: 100, type: 'knockdown', kb: [8, 2.6], weight: 3 }),
  ib_elbow: M({ id: 'ib_elbow', name: '팔꿈치 내려치기', anim: 'elbow_drop', speed: 0.9, dmg: 58, type: 'light', hitstun: 26, kb: [0.8, 0], weight: 2, next: { J: 'ib_palm' } }),
  ib_palm: M({ id: 'ib_palm', name: '쌍장 올려치기 (띄우기)', anim: 'uppercut', speed: 0.9, dmg: 72, type: 'launch', kb: [0.4, 7.6], weight: 3 }),
  ib_burst: M({ id: 'ib_burst', name: '붕권 (홀드: 기 모으기)', anim: 'charge_punch', speed: 1, dmg: 90, type: 'knockdown', kb: [7, 2.4], weight: 3, charge: true }),
  ib_bash: M({ id: 'ib_bash', name: '어깨 들이받기 (슈퍼아머)', anim: 'Shield_Dash_RM', speed: 1, dmg: 75, type: 'knockdown', kb: [9, 3], lunge: 5, armor: true, weight: 3 }),

  // ===== 공용: 대시 공격 · 난무 =====
  dash_armor: M({ id: 'dash_armor', name: '아머 어택 (슈퍼아머)', anim: 'Shield_Dash_RM', speed: 1, dmg: 75, type: 'knockdown', kb: [7, 2.8], lunge: 7.5, armor: true, weight: 3 }),
  dash_fly: M({ id: 'dash_fly', name: '날라차기', anim: 'kick_jump', speed: 1, dmg: 85, type: 'knockdown', kb: [10, 3.4], lunge: 7.5, weight: 3 }),
  nm_0: M({ id: 'nm_0', name: '난무 돌진', anim: 'Punch_Cross', speed: 1.2, dmg: 30, type: 'light', hitstun: 34, kb: [0.25, 0], lunge: 11, armor: true, nanmu: true, weight: 2, next: { S: 'nm_1' } }),
  nm_1: M({ id: 'nm_1', name: '난무 1', anim: 'Punch_Jab', speed: 1.45, dmg: 22, type: 'light', hitstun: 34, kb: [0.25, 0], armor: true, nanmu: true, weight: 1, next: { S: 'nm_2' } }),
  nm_2: M({ id: 'nm_2', name: '난무 2', anim: 'Punch_Cross', speed: 1.45, dmg: 24, type: 'light', hitstun: 34, kb: [0.25, 0], armor: true, nanmu: true, weight: 1, next: { S: 'nm_3' } }),
  nm_3: M({ id: 'nm_3', name: '난무 3', anim: 'kick_low', speed: 1.45, dmg: 24, type: 'light', hitstun: 34, kb: [0.25, 0], armor: true, nanmu: true, weight: 1, next: { S: 'nm_4' } }),
  nm_4: M({ id: 'nm_4', name: '난무 4', anim: 'punch_seq_a', speed: 1.45, dmg: 24, type: 'light', hitstun: 34, kb: [0.25, 0], armor: true, nanmu: true, weight: 1, next: { S: 'nm_5' } }),
  nm_5: M({ id: 'nm_5', name: '난무 5', anim: 'punch_seq_b', speed: 1.45, dmg: 26, type: 'light', hitstun: 34, kb: [0.25, 0], armor: true, nanmu: true, weight: 1, next: { S: 'nm_6' } }),
  nm_6: M({ id: 'nm_6', name: '난무 6', anim: 'knee', speed: 1.45, dmg: 28, type: 'light', hitstun: 34, kb: [0.25, 0], armor: true, nanmu: true, weight: 2, next: { S: 'nm_7' } }),
  nm_7: M({ id: 'nm_7', name: '난무 7', anim: 'kick_mid', speed: 1.45, dmg: 28, type: 'light', hitstun: 34, kb: [0.25, 0], armor: true, nanmu: true, weight: 2, next: { S: 'nm_8' } }),
  nm_8: M({ id: 'nm_8', name: '난무 8', anim: 'kick_round', speed: 1.45, dmg: 30, type: 'light', hitstun: 34, kb: [0.25, 0], armor: true, nanmu: true, weight: 2, next: { S: 'nm_9' } }),
  nm_9: M({ id: 'nm_9', name: '난무 마무리', anim: 'kick_spin', speed: 1.1, dmg: 95, type: 'knockdown', kb: [11, 4.2], armor: true, nanmu: true, guardBreak: true, weight: 3 }),

  // ===== shared =====
  rush: M({ id: 'rush', name: '돌진 연타', anim: 'punch_seq_c', speed: 1, dmg: 50, type: 'light', hitstun: 24, kb: [2.5, 0], lunge: 5.5 }),
  jumppunch: M({ id: 'jumppunch', name: '점프 지르기', anim: 'air_punch', speed: 1, dmg: 75, type: 'light', hitstun: 26, kb: [1.5, 0], air: true, weight: 2 }),
  jumpkick: M({ id: 'jumpkick', name: '점프킥', anim: 'air_kick', speed: 1, dmg: 60, type: 'knockdown', kb: [5, 2.6], air: true, weight: 2 }),
  wakeup: M({ id: 'wakeup', name: '기상 공격', anim: 'kick_low', speed: 1, dmg: 40, type: 'knockdown', kb: [5, 2.4], radial: 1.4, invuln: 18, weight: 2 }),
  evade: M({ id: 'evade', name: '회피기', anim: 'kick_spin', speed: 1, dmg: 30, type: 'knockdown', kb: [7, 3.5], radial: 1.9, invuln: 16, guardBreak: true, weight: 2 }),
  // spirit transformation (weapon)
  sword_a: M({ id: 'sword_a', name: '정령검 1', anim: 'Sword_Regular_A', speed: 1, dmg: 70, type: 'light', hitstun: 24, kb: [2, 0], reach: 0.75, next: { J: 'sword_b' }, weight: 2 }),
  sword_b: M({ id: 'sword_b', name: '정령검 2', anim: 'Sword_Regular_B', speed: 1, dmg: 80, type: 'light', hitstun: 26, kb: [2.5, 0], reach: 0.75, next: { J: 'sword_c' }, weight: 2 }),
  sword_c: M({ id: 'sword_c', name: '정령검 3', anim: 'Sword_Regular_C', speed: 1, dmg: 110, type: 'knockdown', kb: [11, 4.5], reach: 0.8, weight: 3 }),
  skill1: M({ id: 'skill1', name: '돌진 베기', anim: 'Sword_Dash_RM', speed: 1, dmg: 120, type: 'launch', kb: [3, 7], reach: 0.8, lunge: 9, mp: 80, guardBreak: true, weight: 3 }),
  skill2: M({ id: 'skill2', name: '회오리 베기', anim: 'kick_spin', speed: 1, dmg: 130, type: 'knockdown', kb: [12, 5], radial: 2.8, mp: 120, invuln: 20, guardBreak: true, weight: 3 }),
};

export interface StyleDef {
  id: string; name: string; color: number; concept: string; desc: string; traits: string[];
  J: string; K: string; S: string; dashJ: string; dashK: string; dashS: string; air: string;
  grabRange: number; impact?: number; moveSpeed?: number; /** extra frames the follow-up window stays open after a landed hit */ chainHold?: number; anims?: Record<string, string>; doubleJump?: boolean; counterThrow?: boolean; comboGrab?: boolean; poison?: boolean; dmgTaken?: number;
  stats: { 속도: number; 리치: number; 콤보: number; 파워: number; 잡기: number };
  combos: string[]; // recommended routes shown in the move list / guide
}

export const STYLES: Record<string, StyleDef> = {
  kickboxing: {
    id: 'kickboxing', name: '킥복싱', color: 0xef4444, concept: '펀치와 킥을 자유롭게 섞는 균형형',
    desc: '주먹 연타와 로우·미들·하이킥이 서로 이어진다. 니킥으로 띄우고 하이킥으로 마무리.',
    traits: ['주먹 ↔ 발 자유 연계', '특수키: 원투쓰리 3연타', '대시 특수키: 플라잉 니킥 (띄우기)'],
    J: 'kb_jab', K: 'kb_low', S: 'kb_onetwo', dashJ: 'kb_superman', dashK: 'kb_mid', dashS: 'kb_flyknee', air: 'jumpkick',
    grabRange: 1.25, stats: { 속도: 4, 리치: 3, 콤보: 5, 파워: 3, 잡기: 2 },
    combos: ['X X X — 잽 · 크로스 · 훅 (다운)', 'X X C C — 잽 · 크로스 · 미들킥 · 하이킥 (다운)', 'X C X — 잽 · 로우킥 · 니킥 (띄우기) → 점프 C', 'V X — 원투쓰리 · 훅'],
  },
  taekwondo: {
    id: 'taekwondo', name: '태권도', color: 0x3b82f6, concept: '경쾌한 스텝, 빠른 정권, 결정타는 발차기',
    desc: '제자리 스텝을 밟다가 가볍고 빠른 정권 연타로 틈을 만들고, 길고 화려한 발차기로 끝낸다. 주먹은 약하지만 가장 먼저 닿는다.',
    traits: ['제자리 스텝 · 이동 속도 +6%', '정권지르기: 발동 5F로 가장 빠르다 (피해는 가벼움)', '발차기 리치 +15~20cm', '발차기 결정타: 뒤후려차기 · 뒤돌려차기 · 옆차기'],
    J: 'tk_punch', K: 'tk_front', S: 'tk_tornado', dashJ: 'rush', dashK: 'tk_jumpside', dashS: 'tk_tornado', air: 'jumpkick',
    grabRange: 1.2, moveSpeed: 1.06, anims: { Idle_Loop: 'tk_idle_Loop' }, stats: { 속도: 5, 리치: 5, 콤보: 5, 파워: 3, 잡기: 1 },
    combos: ['X X X C — 정권 3연타 · 옆차기 (다운·링아웃)', 'X C C C — 정권 · 앞차기 · 돌려차기 · 뒤후려차기 (다운)', 'C C X — 앞차기 · 돌려차기 · 뒤돌려차기 (다운·링아웃)', 'C X — 앞차기 · 나래차기 (띄우기) → 점프 → C', 'V — 540 회전차기 · 대시 C — 이단 옆차기'],
  },
  jintk: {
    id: 'jintk', name: '진태권도', color: 0x7c6cf5, concept: '품새의 앞굽이, 전진하는 강한 발차기, 텀을 두는 심리전',
    desc: '낮고 긴 앞굽이로 버티다가 정권으로 문을 열고, 한 발 한 발 앞으로 밀고 들어가는 발차기로 압박한다. 맞힌 뒤에는 다음 타를 늦게 눌러도 이어져서, 박자를 바꿔 상대의 가드와 반격을 흔들 수 있다.',
    traits: ['발차기마다 크게 전진한다 (거리 압박)', '발차기 피해가 태권도보다 높다 (회전 발차기 120)', '텀 연계: 맞힌 뒤 다음 입력을 늦게 눌러도 이어진다', '정권은 태권도보다 느리지만 묵직하다'],
    J: 'jt_punch', K: 'jt_front', S: 'tk_tornado', dashJ: 'rush', dashK: 'tk_jumpside', dashS: 'tk_tornado', air: 'jumpkick',
    grabRange: 1.2, chainHold: 16, anims: { Idle_Loop: 'jt_idle_Loop' }, stats: { 속도: 3, 리치: 5, 콤보: 4, 파워: 4, 잡기: 1 },
    combos: ['X X — 앞굽이 정권 · 반대 지르기 (기본 견제)', 'C C — 밀어 앞차기 · 돌려차기 (거리 압박)', 'C C C — 앞차기 · 돌려차기 · 회전 발차기 (다운)', 'X X C — 정권 2연타 · 옆차기 (다운·링아웃)', 'X C C C — 정권 · 앞차기 · 돌려차기 · 회전 발차기 (다운)'],
  },
  jujutsu: {
    id: 'jujutsu', name: '유술', color: 0xf59e0b, concept: '잡기와 던지기의 달인',
    desc: '잡기 범위가 넓고, 타격이 맞은 상대를 바로 잡을 수 있다. 반격 성공 시 던지기로 연결.',
    traits: ['잡기 범위 +40%', '콤보 중 Z+X로 잡기 캔슬', '반격 → 관절 던지기', '특수키: 업어치기 (가드불가)', '대시 특수키: 태클 (슈퍼아머)'],
    J: 'ju_palm', K: 'ju_low', S: 'ju_hipthrow', dashJ: 'rush', dashK: 'ju_sweep', dashS: 'ju_tackle', air: 'jumpkick',
    grabRange: 1.75, counterThrow: true, comboGrab: true, stats: { 속도: 3, 리치: 2, 콤보: 3, 파워: 4, 잡기: 5 },
    combos: ['X X Z+X — 장타 · 팔꿈치 · 잡기 캔슬 (던지기)', 'C C — 정강이 · 다리후리기 (다운)', 'V — 업어치기 (가드 중인 상대에게)', '반격 성공 → 자동 던지기'],
  },
  ninjutsu: {
    id: 'ninjutsu', name: '인술', color: 0x22c55e, concept: '가장 빠른 연타와 이동기',
    desc: '수도 3연타에서 선풍각, 공중제비 차기로 띄운다. 순보로 등 뒤를 잡고 더 높은 2단 점프를 쓴다.',
    traits: ['공격 속도 최상', '더 높은 2단 점프', '특수키: 순보 (등 뒤로 순간이동)', '대시 특수키: 슬라이딩 (하단 다운)'],
    J: 'nj_a', K: 'nj_low', S: 'nj_blink', dashJ: 'rush', dashK: 'nj_flip', dashS: 'nj_slide', air: 'jumpkick',
    grabRange: 1.2, doubleJump: true, stats: { 속도: 5, 리치: 2, 콤보: 5, 파워: 2, 잡기: 2 },
    combos: ['X X X C — 수도 3연타 · 선풍각 (다운)', 'X C — 수도 · 공중제비 차기 (띄우기) → 점프 C', 'V X X X C — 순보 후 등 뒤에서 연타', '대시 V — 슬라이딩'],
  },
  smoke: {
    id: 'smoke', name: '연막류 인술', color: 0x8b5cf6, concept: '연막으로 교란하고 독으로 깎는다',
    desc: '모든 타격에 독이 묻어 지속 피해를 준다. 연막 속의 적은 혼란에 빠지고 시전자는 은신한다.',
    traits: ['타격 시 독 (2초간 지속 피해)', '특수키: 연막 (적 혼란 + 은신)', '대시 특수키: 그림자 관통 (무적 돌진·띄우기)'],
    J: 'sm_a', K: 'sm_front', S: 'sm_smoke', dashJ: 'rush', dashK: 'sm_back', dashS: 'sm_shadow', air: 'jumpkick',
    grabRange: 1.2, poison: true, stats: { 속도: 4, 리치: 3, 콤보: 4, 파워: 2, 잡기: 2 },
    combos: ['X X C — 암수 2연타 · 그림자 돌려차기 (다운)', 'C C — 안개 앞차기 · 뒤돌려차기 (다운)', 'V → 혼란에 빠진 적에게 X X C', '대시 V — 그림자 관통 (띄우기) → 점프 C'],
  },
  freefight: {
    id: 'freefight', name: '자유격투', color: 0x64748b, concept: '맷집과 슈퍼아머의 종합격투',
    desc: '받는 피해가 적고, 특수기는 맞아도 멈추지 않는 슈퍼아머. 니킥에서 플라잉 니로 띄운다.',
    traits: ['받는 피해 -10%', '특수키: 파워 스트레이트 (슈퍼아머·가드브레이크)', '대시 특수키: 테이크다운 (슈퍼아머)'],
    J: 'ff_jab', K: 'ff_knee', S: 'ff_power', dashJ: 'rush', dashK: 'ff_high', dashS: 'ff_tackle', air: 'jumpkick',
    grabRange: 1.3, dmgTaken: 0.9, stats: { 속도: 3, 리치: 3, 콤보: 3, 파워: 5, 잡기: 3 },
    combos: ['X X X — 잽 · 크로스 · 훅 (다운)', 'X X C — 잽 · 크로스 · 하이킥 (다운)', 'C C — 니킥 · 플라잉 니 (띄우기) → 점프 C', 'V — 파워 스트레이트 (가드 뚫기)'],
  },
  ironbone: {
    id: 'ironbone', name: '철골권', color: 0xb45309, concept: '느리지만 한 방 한 방이 쇳덩이',
    desc: '낮은 기마 자세로 버티고 서서, 허리를 끝까지 감았다가 온몸으로 내리꽂는다. 발동은 느리지만 한 대가 다른 비전서의 두세 대 값을 한다.',
    traits: ['움직이지 않는 기마 자세 · 이동 속도 -8%', '모든 타격이 묵직하다: 피해 +50%, 발동은 느림', '받는 피해 -15%', 'C 다음 X를 누르고 있으면 기 모으기 → 가드 불가 붕권'],
    J: 'ib_a', K: 'ib_k1', S: 'ib_bash', dashJ: 'rush', dashK: 'ib_k3', dashS: 'ib_bash', air: 'jumpkick',
    grabRange: 1.25, impact: 1.5, dmgTaken: 0.85, moveSpeed: 0.92, anims: { Idle_Loop: 'ib_idle_Loop' }, stats: { 속도: 1, 리치: 2, 콤보: 2, 파워: 5, 잡기: 3 },
    combos: ['X X X — 직권 · 역권 · 호조수 (다운)', 'C C C — 정강이 · 무릎 · 짓밟아 차기 (다운)', 'C C X X — 정강이 · 무릎 · 팔꿈치 · 쌍장 (띄우기) → X 끊치', 'C X(홀드) — 기 모은 붕권 (가드 불가)'],
  },
};
// every style shares the same dash attacks and the once-per-round 난무 on V
for (const st of Object.values(STYLES)) {
  st.S = st.dashS = 'nm_0'; st.dashJ = 'dash_armor'; st.dashK = 'dash_fly';
  st.traits = st.traits.filter((t) => !/특수키|대시/.test(t)).concat(['달리는 중 X: 아머 어택 · C: 날라차기 (즉시 다운)', 'V 연타: 난무 — 돌진 후 10연타 (판당 1회)']);
  st.combos = st.combos.filter((c) => !/V|대시/.test(c)).concat(['V V V V V… — 난무: 돌진 → 8연타 → 마무리 (판당 1회)', '대시 X — 아머 어택 (다운) · 대시 C — 날라차기 (다운)']);
}
export const STYLE_IDS = Object.keys(STYLES);
/** styles open for play right now (the others are being reworked one by one) */
export const OPEN_STYLES = ['taekwondo', 'jintk', 'ironbone'];
