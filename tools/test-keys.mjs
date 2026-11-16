// Keys delivered without `code` (remote desktop / IME) must still drive the game: node tools/test-keys.mjs
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'msedge', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto('http://localhost:5173/'); await p.waitForFunction('window.__ready === true', null, { timeout: 90000 });
const r = await p.evaluate(() => {
  const g = window.__sa; const out = {};
  const ev = (type, init) => window.dispatchEvent(new KeyboardEvent(type, { bubbles: true, cancelable: true, ...init }));
  const probe = (name, init, want) => { g.keys.clear(); ev('keydown', init); out[name] = g.keys.has(want); ev('keyup', init); out[name] &&= !g.keys.has(want); };
  g.go('title'); ev('keydown', { key: 'x', code: '' }); out.titleAdvances = g.screen === 'menu';
  probe('normal', { key: 'x', code: 'KeyX' }, 'KeyX');
  probe('noCodeLetter', { key: 'c', code: '' }, 'KeyC');
  probe('hangulJamo', { key: 'ㅌ', code: '' }, 'KeyX');
  probe('imeProcess', { key: 'Process', code: '', keyCode: 90 }, 'KeyZ');
  probe('arrowNoCode', { key: 'ArrowLeft', code: '' }, 'ArrowLeft');
  probe('spaceNoCode', { key: ' ', code: '' }, 'Space');
  probe('keyCodeOnly', { key: 'Unidentified', code: 'Unidentified', keyCode: 38 }, 'ArrowUp');
  probe('numpadArrowNumLockOff', { key: 'ArrowLeft', code: 'Numpad4' }, 'ArrowLeft');
  probe('numpadArrowNumLockOn', { key: '8', code: 'Numpad8' }, 'ArrowUp');
  probe('ijkl', { key: 'l', code: 'KeyL' }, 'ArrowRight');
  probe('ijklHangul', { key: 'ㅑ', code: '' }, 'ArrowUp');
  return out;
});
console.log(r); console.log(Object.values(r).every(Boolean) ? 'ALL OK' : 'FAIL'); await b.close();
