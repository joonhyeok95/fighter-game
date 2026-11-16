// usage: node tools/shot.mjs <url-path> <out.png> [w h] [delayMs]
import { chromium } from 'playwright-core';
const [, , path, out, w = '1280', h = '720', delay = '300'] = process.argv;
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) console.log('[page]', m.type(), m.text()); });
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
await p.goto('http://localhost:5173/' + path);
await p.waitForFunction('window.__ready === true', null, { timeout: 90000 });
await p.waitForTimeout(+delay);
await p.screenshot({ path: out });
await b.close();
console.log('saved', out);
