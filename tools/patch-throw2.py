p = 'src/fighter.ts'; s = open(p, encoding='utf-8').read()
a = "v.pos.set(this.pos.x + f.x * 0.7, this.pos.y + lift, this.pos.z + f.z * 0.7); v.yaw"
assert a in s
s = s.replace(a, "// shoulder throw: the opponent is hauled from the front, up over the shoulder, to behind\n          const k = this.throwKind === 'over' ? Math.min(1, Math.max(0, (this.stateT - 8) / 14)) : 0; const off = 0.7 - 1.1 * k * k; const ly = this.throwKind === 'over' ? lift + 0.25 * k : lift;\n          v.pos.set(this.pos.x + f.x * off, this.pos.y + ly, this.pos.z + f.z * off); v.yaw")
open(p, 'w', encoding='utf-8', newline='\n').write(s)
