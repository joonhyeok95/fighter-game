import re
p = 'src/anims.ts'; s = open(p, encoding='utf-8').read()
a = s.index("// 철골권 횡권:"); b = s.index("def('ib_hook'")
s = s[:a] + """// 철골권 역권: the other fist, thrown the same way - the whole body winds the opposite direction first
const IBH_W = S({ pel: [5, 40, 0], s1: [12, 8, 0], s3: [6, 8, 0], uaL: [34, -18, 16], laL: -122, uaR: [-76, -44, -4], laR: -18, thL: [-60, -36, 14], cL: 80, fL: -18, thR: [-20, -40, -20], cR: 68, fR: -44, p: [0, 0, -0.08] });
const IBH = S({ pel: [8, -54, 0], s1: [12, -8, 0], s3: [6, -10, 0], uaL: [-88, 52, 0], laL: -2, uaR: [32, 8, -18], laR: -124, thL: [-66, 50, 10], cL: 80, fL: -8, thR: [36, 16, -8], cR: 12, fR: -46, p: [0, 0, 0.28] });
""" + s[b:]
s = s.replace("p: [0, 0.07, 0] });\nconst TK_LO2", "p: [0, 0.12, 0] });\nconst TK_LO2").replace("{ ...TK_HI, p: [0, 0.06, 0.02] }", "{ ...TK_HI, p: [0, 0.11, 0.02] }")
assert "p: [0, 0.12, 0] });" in s
open(p, 'w', encoding='utf-8', newline='\n').write(s)
p = 'src/moves.ts'; s = open(p, encoding='utf-8').read()
assert '횡권' in s; s = s.replace('횡권', '역권'); open(p, 'w', encoding='utf-8', newline='\n').write(s)
