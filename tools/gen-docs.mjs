// Turns the measured data (docs/styles.json from combo-lab) into web/Notion-ready style guides.
// Only measured TRUE combos where every input actually lands are published.
import fs from 'node:fs';
const D = JSON.parse(fs.readFileSync('docs/styles.json', 'utf8'));
fs.mkdirSync('docs/notion', { recursive: true });

const RESULT = { light: '경직', launch: '띄우기', knockdown: '다운' };
const keyName = (k) => ({ J: 'X', K: 'C', S: 'V', grab: 'Z+X', jump: '점프', 'J/K': 'X 또는 C', jc: 'X', cut: 'X(끊치)' }[k] || k);
const inputOf = (r) => (r.dash ? '대시 ' : '') + r.keys.map(keyName).join(' ');
const esc = (s) => String(s).replace(/\|/g, '\\|');

function tags(m) {
  const t = [];
  if (m.low) t.push('하단');
  if (m.armor) t.push('슈퍼아머');
  if (m.guardBreak) t.push('가드 불가');
  if (m.charge) t.push('X 홀드: 기 모으기 → 가드 불가·피해 ×1.6');
  if (m.invuln) t.push(`무적 ${m.invuln}F`);
  if (m.lunge >= 6) t.push('돌진');
  if (m.special === 'teleport') t.push('순간이동');
  if (m.special === 'smoke') t.push('혼란·은신');
  if (m.special === 'cmdgrab') t.push('잡기 판정');
  if (m.reach) t.push(`리치 +${Math.round(m.reach * 100)}cm`);
  if (m.hits > 1) t.push(`${m.hits}연타`);
  return t.join(', ') || '-';
}
const result = (m) => (m.special === 'cmdgrab' ? '던지기' : m.special ? '-' : RESULT[m.type]);

for (const [sid, s] of Object.entries(D)) {
  const byName = Object.fromEntries(s.moves.map((m) => [m.name, m]));
  // every input that performs a technique (shortest first), from the measured route list
  const inputs = {};
  for (const r of s.routes) { const nm = r.names[r.names.length - 1]; (inputs[nm] ||= new Set()).add(inputOf(r)); }
  for (const m of s.moves) { const all = [...(inputs[m.name] || [m.input])].sort((a, b) => a.length - b.length); m.input = all.slice(0, 3).join(' / ') + (all.length > 3 ? ' …' : ''); m.onlySpecial = all.includes('V') || all.includes('대시 V'); }
  const poison = s.traits.some((t) => t.includes('독'));
  // a route is publishable if it is a true combo and every damaging input actually landed
  const expected = (r) => r.names.reduce((n, nm) => n + (nm === '잡기 캔슬' ? 1 : (byName[nm]?.dmg ? byName[nm].hits : 0)), 0);
  const ok = (r) => r.trueCombo && r.hits >= expected(r) && r.hits > 0;
  const kindOf = (r) => {
    const ks = new Set(r.names.map((nm) => (nm === '잡기 캔슬' ? '잡기' : byName[nm]?.kind)));
    if (r.keys[0] === 'S' || [...ks].includes('특수')) return '특수';
    if (ks.has('잡기')) return '잡기';
    if (ks.size === 1 && ks.has('손')) return '손';
    if (ks.size === 1 && ks.has('발')) return '발';
    return '손발';
  };
  const routes = s.routes.filter((r) => r.keys.length >= 2 && ok(r));
  const routeRow = (r) => `| ${inputOf(r)} | ${esc(r.names.join(' → '))} | ${r.hits} | ${r.dmg} | ${r.end} |`;
  const moveRow = (m) => `| ${m.input} | ${esc(m.name)} | ${m.dmg ? m.hits : '-'} | ${m.dmg ? m.total_dmg : '-'} | ${m.startup}F | ${m.total}F | ${result(m)} | ${tags(m)} |`;
  const moveHead = '| 입력 | 기술 | 타수 | 피해 | 발생 | 전체 | 결과 | 특성 |\n|---|---|---|---|---|---|---|---|';
  const routeHead = '| 입력 | 연계 | 타수 | 피해 | 결과 |\n|---|---|---|---|---|';
  const section = (title, rows, head, empty) => `### ${title}\n\n${rows.length ? head + '\n' + rows.join('\n') : empty}\n`;

  const hand = s.moves.filter((m) => m.kind === '손' && !m.special && !m.onlySpecial);
  const foot = s.moves.filter((m) => m.kind === '발' && !m.special && !m.onlySpecial);
  const mixedMoves = s.moves.filter((m) => m.kind === '손발' && !m.special && !m.onlySpecial);
  const special = s.moves.filter((m) => m.special || m.onlySpecial);
  const launchMoves = s.moves.filter((m) => m.type === 'launch' && m.dmg);

  const handR = routes.filter((r) => kindOf(r) === '손');
  const footR = routes.filter((r) => kindOf(r) === '발');
  const mixR = routes.filter((r) => kindOf(r) === '손발' || kindOf(r) === '잡기');
  const specR = routes.filter((r) => kindOf(r) === '특수');
  const launchR = s.routes.filter((r) => ok(r) && (r.end.startsWith('띄우기') || (sid === 'jujutsu' && r.end === '던지기' && r.keys.includes('grab'))));

  // follow-ups after launch (dedupe by launcher + follow input, keep the cheapest route per launcher ending)
  const seen = new Map(); const follow = [];
  const attacks = (f) => f.follow.filter((k) => k !== 'jump').length;
  const launcherEnds = (r) => { const last = r.names[r.names.length - 1]; return last === '잡기 캔슬' || byName[last]?.type === 'launch'; };
  s.follow = s.follow.filter((f) => f.extraHits >= attacks(f) && launcherEnds(f.launcher));
  for (const f of s.follow.sort((a, b) => a.launcher.keys.length - b.launcher.keys.length || b.extraDmg - a.extraDmg)) {
    // "jump → J" and "jump → K" both perform the same air attack: merge them
    const fk = f.follow.map((k, i) => (f.follow[i - 1] === 'jump' && (k === 'J' || k === 'K') ? 'J/K' : k));
    const k = f.launcher.names[f.launcher.names.length - 1] + '|' + fk.join(' ');
    if (seen.has(k)) continue; seen.set(k, 1); follow.push({ ...f, follow: fk });
  }
  const fRows = follow.slice(0, 14).map((f) => `| ${inputOf(f.launcher)} (${esc(f.launcher.names.join(' → '))}) | ${f.follow.map(keyName).join(' → ')} | +${f.extraHits} | ${f.hits} | ${f.dmg} |`);

  const statRow = Object.entries(s.stats).map(([k, v]) => `| ${k} | ${'■'.repeat(v)}${'□'.repeat(5 - v)} |`).join('\n');
  const best = routes.slice().sort((a, b) => b.dmg - a.dmg)[0];
  const bestF = follow.slice().sort((a, b) => b.dmg - a.dmg)[0];

  const md = `<callout icon="🥋" color="gray_bg">
**${s.concept}**\\
${s.desc}
</callout>

## 개요

${s.traits.map((t) => `- ${t}`).join('\n')}

| 능력 | 등급 |
|---|---|
${statRow}

<callout icon="📌" color="blue_bg">
대표 연계\\
- 최대 피해 지상 연계: **${best ? `${inputOf(best)}** (${best.names.join(' → ')}) — ${best.hits}타 ${best.dmg}` : '-**'}
${bestF ? `- 최대 피해 공중 연계: **${inputOf(bestF.launcher)} → ${bestF.follow.map(keyName).join(' → ')}** — ${bestF.hits}타 ${bestF.dmg}` : ''}
</callout>

## 1. 손 공격

${hand.length ? moveHead + '\n' + hand.map(moveRow).join('\n') : '손 공격 기술 없음'}

## 2. 발 공격

${foot.length ? moveHead + '\n' + foot.map(moveRow).join('\n') : '발 공격 기술 없음'}
${mixedMoves.length ? '\n손과 발을 함께 쓰는 기술\n\n' + moveHead + '\n' + mixedMoves.map(moveRow).join('\n') + '\n' : ''}
### 특수키 · 대시 기술

${special.length ? moveHead + '\n' + special.map(moveRow).join('\n') : '-'}

## 3. 연계기

${section('손 연계', handR.map(routeRow), routeHead, '손으로만 이어지는 연계 없음')}
${section('발 연계', footR.map(routeRow), routeHead, '발로만 이어지는 연계 없음')}
${section('손발 연계' + (s.traits.some((t) => t.includes('잡기 캔슬')) ? ' · 잡기 캔슬' : ''), mixR.map(routeRow), routeHead, '-')}
${section('특수키 연계', specR.map(routeRow), routeHead, '특수키로 시작하는 연계 없음')}
## 4. ${sid === 'jujutsu' ? '공중에 띄우는 공격 (던지기)' : '공중에 띄우는 공격'}

${launchMoves.length ? '띄우기 기술\n\n' + moveHead + '\n' + launchMoves.map(moveRow).join('\n') + '\n\n' : ''}${launchR.length ? (sid === 'jujutsu' ? '잡기 캔슬로 던져 올리는 연계 (업어치기 V는 등 뒤로 내리꽂는 기술이라 띄우지 않는다)\n\n' : '띄우기로 끝나는 연계\n\n') + routeHead + '\n' + launchR.map(routeRow).join('\n') : sid === 'jujutsu' ? '유술은 띄우기 기술 대신 **잡기 캔슬 → 던져 올리기**로 상대를 공중에 띄운다.' : '-'}

## 5. 띄운 후 추가 연계

${sid === 'jujutsu' ? '잡기로 던져 올린 직후 **점프(Space)로 던지기 동작을 캔슬**하고 공중에서 추격한다.\n\n' : '띄운 상대는 낮게 떠서 천천히 떨어진다. 띄우기가 맞으면 **X로 후딜레이를 끊고 서서 주먹을 넣고**, 연계 창이 닫힌 뒤 다시 X를 누르면 첫 주먹이 다시 나간다(**끊치**). 기본 루트는 **띄우기 → 끊치 2회 → 지상 콤보**. 점프(Space)로 쫓아가 공중에서 칠 수도 있다. 공중 추가타는 맞을수록 덜 뜨므로(저글 감쇠) 무한 연계는 되지 않는다.\n\n'}${fRows.length ? '| 띄우기 연계 | 추가 입력 | 추가 타수 | 총 타수 | 총 피해 |\n|---|---|---|---|---|\n' + fRows.join('\n') : '측정된 추가 연계 없음'}
${poison ? '\n<callout icon="☠️" color="purple_bg">\n표의 피해는 타격 피해만 집계했다. 연막류 인술은 모든 타격에 독이 묻어 2초 동안 약 24의 지속 피해가 추가된다.\n</callout>\n' : ''}`;
  fs.writeFileSync(`docs/notion/${sid}.md`, md);
  console.log(sid, md.length, 'chars', `moves ${s.moves.length}, routes ${routes.length}, launch ${launchR.length}, follow ${fRows.length}`);
}
