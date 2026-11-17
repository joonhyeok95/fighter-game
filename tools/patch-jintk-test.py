p = 'tools/test-rules.mjs'; s = open(p, encoding='utf-8').read()
a = "// 4. practice: map picker"
assert a in s
new = """// 3b. 진태권도: the five routes, kick travel, delayed follow-ups
r = await p.evaluate(() => {
  const out = {};
  const play = (keys, gap, style = 'jintk') => {
    const [a, v] = T.duel(style, 1.0); const hp0 = v.hp; const ids = []; const st = new Set();
    T.run((i) => { const k = keys[i / gap]; return i % gap === 0 && k ? { [k]: true } : {}; }, {}, keys.length * gap + 90, () => { const id = a.move?.id; if (id && ids[ids.length - 1] !== id) ids.push(id); st.add(v.state); });
    return { ids: ids.join('>'), dmg: hp0 - v.hp, combo: a.stats.maxCombo, down: st.has('launched') || st.has('down'), z: a.pos.z };
  };
  out.pp = play(['J', 'J'], 12); out.kk = play(['K', 'K'], 16); out.kkk = play(['K', 'K', 'K'], 16);
  out.ppk = play(['J', 'J', 'K'], 12); out.pkkk = play(['J', 'K', 'K', 'K'], 16);
  out.late = play(['K', 'K', 'K'], 34); out.tkLate = play(['K', 'K', 'K'], 34, 'taekwondo');
  out.tkk = play(['K', 'K'], 16, 'taekwondo');
  return out;
});
const J = (o) => `${o.ids} · ${o.combo}타 ${o.dmg}`;
ok('진태권도 X X: 정권 연속', r.pp.ids === 'jt_punch>jt_punch2' && r.pp.combo === 2, J(r.pp));
ok('진태권도 C C: 연속 발차기', r.kk.ids === 'jt_front>jt_round' && r.kk.combo === 2, J(r.kk));
ok('진태권도 C C C: 3단 발차기 (다운)', r.kkk.ids === 'jt_front>jt_round>jt_spin' && r.kkk.combo === 3 && r.kkk.down, J(r.kkk));
ok('진태권도 X X C: 정권 후 옆차기 (다운)', r.ppk.ids === 'jt_punch>jt_punch2>jt_side' && r.ppk.combo === 3 && r.ppk.down, J(r.ppk));
ok('진태권도 X C C C: 정권 후 연속 발차기 (다운)', r.pkkk.ids === 'jt_punch>jt_front>jt_round>jt_spin' && r.pkkk.combo === 4 && r.pkkk.down, J(r.pkkk));
ok('진태권도: 발차기 전진 거리가 태권도보다 길다', r.kk.z > r.tkk.z + 0.3, `${r.kk.z.toFixed(2)}m vs ${r.tkk.z.toFixed(2)}m`);
ok('진태권도: 텀을 두고 눌러도 이어진다 (태권도는 끊김)', r.late.ids === 'jt_front>jt_round>jt_spin' && !r.tkLate.ids.includes('tk_round>tk_back'), `${r.late.ids} / ${r.tkLate.ids}`);

"""
open(p, 'w', encoding='utf-8', newline='\n').write(s.replace(a, new + a, 1))
