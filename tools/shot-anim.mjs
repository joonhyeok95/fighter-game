// Animation contact sheet: node tools/shot-anim.mjs <name> <clip,clip,...> [n=8] [side|front|yaw] [body]
import { chromium } from 'playwright-core';
const [name = 'sheet', clips = 'Idle_Loop,Punch_Jab', n = '8', view = 'q', body = 'male'] = process.argv.slice(2);
const rows = clips.split(',').length;
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const W = Math.min(2000, +n * +(process.env.CELL || 190)), H = Math.round(W * (rows * 1.9) / (+n * 1.5));
const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
p.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') console.log('[console]', m.text()); });
const v = view === 'turn' ? '&turn=1' : view === 'side' ? '&side=1' : view === 'front' ? '&yaw=0' : view === 'q' ? '' : `&yaw=${view}`;
await p.goto(`http://localhost:5173/?view=anims&clips=${clips}&n=${n}${v}&body=${body}`);
await p.waitForFunction('window.__ready === true', null, { timeout: 60000 });
await p.screenshot({ path: `shots/anim_${name}.jpg`, type: 'jpeg', quality: 88 });
await b.close();
console.log(`shots/anim_${name}.jpg ${W}x${H}`);
