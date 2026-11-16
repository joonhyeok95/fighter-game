p='src/ui.ts'; s=open(p,encoding='utf-8').read()
a="import type { Fighter } from './fighter';"; assert a in s
s=s.replace(a,a+"\nimport { MAP, MAPS, STAIR } from './maps';",1)
a='''        <div class="field"><label>AI 인원</label><div class="seg" id="ai"></div></div>'''; assert a in s
s=s.replace(a,'''        <div class="field"><label>맵</label><div class="seg" id="map"></div></div>
'''+a)
a='''        <p class="note">링아웃 또는 K.O.로 마지막까지 남으면 라운드 승리.</p>`)}</div>`);'''; assert a in s
s=s.replace(a,'''        <p class="note"><b>${MAP.cur.name}</b> — ${MAP.cur.desc}</p>`)}</div>`);''')
a="      seg('ai', [1, 2, 3, 5, 7].map((n) => [`${n}명`, n]), () => g.match.ai, (v) => (g.match.ai = v));"; assert a in s
s=s.replace(a,'''      seg('map', Object.values(MAPS).map((m) => [m.name, m.id]), () => MAP.cur.id, (v) => g.setMap(v));
      if (MAP.cur.duel) el.querySelector('#ai')!.innerHTML = '<span class="on">1명 · 1:1 전용</span>';
      else seg('ai', [1, 2, 3, 5, 7].map((n) => [`${n}명`, n]), () => g.match.ai, (v) => (g.match.ai = v));''')
i=s.index("function drawMinimap("); j=s.index("let bannerEl")
s=s[:i]+'''function drawMinimap(g: Game, c: HTMLCanvasElement) {
  const x = c.getContext('2d')!; const W = c.width, R = W / 2 - 4; const map = MAP.cur; const a = g.camYaw;
  const s = R / (map.id === 'stairs' ? 10.2 : map.view);
  x.clearRect(0, 0, W, W);
  x.fillStyle = 'rgba(14,16,38,.6)'; x.beginPath(); x.arc(W / 2, W / 2, R, 0, 7); x.fill();
  if (map.id === 'stairs') {
    // world -> minimap (rotates with the camera); tiers get brighter towards the top
    x.save(); x.beginPath(); x.arc(W / 2, W / 2, R, 0, 7); x.clip();
    x.setTransform(-s * Math.cos(a), s * Math.sin(a), -s * Math.sin(a), -s * Math.cos(a), W / 2, W / 2);
    const { W: w, D: d, N: n, TD: td } = STAIR;
    for (let k = 0; k < n; k++) { x.fillStyle = `rgba(255,200,87,${0.34 - k * 0.06})`; x.fillRect(-w / 2, -d / 2 + k * td, w, td); }
    x.strokeStyle = 'rgba(255,77,120,.85)'; x.lineWidth = 1.5 / s; x.strokeRect(-w / 2, -d / 2, w, d);
    x.restore();
  } else {
    const wall = map.railH === Infinity;
    x.strokeStyle = wall ? 'rgba(95,227,255,.8)' : 'rgba(255,77,120,.75)'; x.lineWidth = 1.5; x.beginPath(); x.arc(W / 2, W / 2, (wall ? 6.5 : 9) * s, 0, 7); x.stroke();
    x.strokeStyle = 'rgba(95,227,255,.45)'; x.lineWidth = 1; x.beginPath(); x.arc(W / 2, W / 2, (wall ? 1.5 : 2.5) * s, 0, 7); x.stroke();
  }
  for (const f of g.fighters) {
    if (f.state === 'out') continue;
    const px = f.pos.x, pz = f.pos.z;
    const rx = px * Math.cos(-a) - pz * Math.sin(-a), rz = px * Math.sin(-a) + pz * Math.cos(-a);
    const cx = W / 2 - rx * s, cy = W / 2 - rz * s;
    if (f.isPlayer) { x.fillStyle = '#F2F1EC'; x.beginPath(); x.moveTo(cx, cy - 6); x.lineTo(cx + 4.5, cy + 4); x.lineTo(cx - 4.5, cy + 4); x.closePath(); x.fill(); }
    else { x.fillStyle = f.alive ? hex(f.opts.suit) : 'rgba(242,241,236,.25)'; x.fillRect(cx - 3, cy - 3, 6, 6); }
  }
}

'''+s[j:]
open(p,'w',encoding='utf-8').write(s)
print('ok')
