def must(s, a, b):
    assert a in s, a[:80]; return s.replace(a, b, 1)
p = 'tools/test-rules.mjs'; s = open(p, encoding='utf-8').read()
s = must(s, "const play = (keys, gap, style = 'jintk') => {\n    const [a, v] = T.duel(style, 1.0);", "const play = (keys, gap, style = 'jintk', dist = 1.0) => {\n    const [a, v] = T.duel(style, dist);")
s = must(s, "out.tkk = play(['K', 'K'], 16, 'taekwondo');", "out.far = play(['K'], 16, 'jintk', 2.4); out.tkFar = play(['K'], 16, 'taekwondo', 2.4);")
s = must(s, "r.kk.z > r.tkk.z + 0.3, `${r.kk.z.toFixed(2)}m vs ${r.tkk.z.toFixed(2)}m`", "r.far.dmg > 0 && r.tkFar.dmg === 0 && r.far.z > r.tkFar.z + 0.5, `2.4m 밖에서 C: 진태권도 ${r.far.z.toFixed(2)}m 전진·피해 ${r.far.dmg} / 태권도 ${r.tkFar.z.toFixed(2)}m·피해 ${r.tkFar.dmg}`")
open(p, 'w', encoding='utf-8', newline='\n').write(s)
