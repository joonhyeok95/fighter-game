import sys
p = 'tools/test.mjs'
s = open(p, encoding='utf-8').read()
a = s.index("await test('공중 콤보:")
b = s.index("await test('끊치:")
at = sys.argv[1]; keys = sys.argv[2]; dbg = len(sys.argv) > 3
new = """await test('공중 콤보: 띄우기 → 정권 → 끊치 2회 → 두번·세번지르기 → 옆차기 (8타)', () => {
  const [a, v] = T.duel('taekwondo'); const at = [%s]; const keys = [%s]; const log = [];
  T.run((i) => { const k = at.indexOf(i); return k >= 0 ? { [keys[k]]: true } : {}; }, {}, 260, () => { log.push((a.move?.id ?? a.state) + ':' + a.combo + ':' + v.state + ':' + v.pos.y.toFixed(1)); });
  %s
  return { ok: a.stats.maxCombo >= 8, msg: `최대 콤보 ${a.stats.maxCombo}타` + (typeof L === "string" ? L : "") };
});
""" % (at, ','.join("'%s'" % k for k in keys), "const L = (log.map((l, i) => i + ' ' + l).filter((l, i, arr) => i === 0 || l.split(' ')[1] !== arr[i - 1].split(' ')[1]).join('\\n'));" if dbg else '')
open(p, 'w', encoding='utf-8', newline='\n').write(s[:a] + new + s[b:])
