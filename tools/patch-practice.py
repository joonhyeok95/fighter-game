def must(s, a, b):
    assert a in s, a[:80]; return s.replace(a, b, 1)
p = 'src/game.ts'; s = open(p, encoding='utf-8').read()
s = must(s, "import { initTouch, syncTouch, pad } from './touch';", "import { initTouch, syncTouch, pad, isTouch } from './touch';\nimport { initPractice, syncPractice, practiceKey, dummyCtrl, DummyMode } from './practice';")
s = must(s, "  match: MatchCfg = { ai: 3, difficulty: 'normal', wins: 2, practice: false };", "  match: MatchCfg = { ai: 3, difficulty: 'normal', wins: 2, practice: false };\n  /** practice mode: what the training partner does, its strike timer, and whether the how-to panel is open */\n  dummy: DummyMode = 'idle'; dummyT = 0; guideOpen = true;")
s = must(s, "UI.layout(); initTouch(this);", "UI.layout(); initTouch(this); initPractice(this);")
s = must(s, "    syncTouch(this);", "    syncTouch(this); syncPractice(this);")
s = must(s, "      else f.ctrl = emptyCtrl();", "      else f.ctrl = this.match.practice && f !== this.player && this.screen === 'game' ? dummyCtrl(this, f) : emptyCtrl();")
s = must(s, "    if (code === 'F1') {", "    if (practiceKey(this, code)) { e.preventDefault(); return; }\n    if (code === 'F1') {")
s = must(s, "    this.startRound();\n  }", "    this.dummy = 'idle'; this.dummyT = 0; this.guideOpen = !isTouch();\n    this.startRound();\n  }")
open(p, 'w', encoding='utf-8', newline='\n').write(s)
p = 'src/ui.ts'; s = open(p, encoding='utf-8').read()
s = must(s, "PRACTICE · 무한 체력 · F1 히트박스", "PRACTICE · 무한 체력 · F1 히트박스 · H 사용법")
open(p, 'w', encoding='utf-8', newline='\n').write(s)
p = 'src/style.css'; s = open(p, encoding='utf-8').read()
s += """
/* ---- practice mode: partner behaviour bar + how-to panel */
#practice { position: fixed; left: env(safe-area-inset-left); right: env(safe-area-inset-right); top: env(safe-area-inset-top); bottom: env(safe-area-inset-bottom); display: none; pointer-events: none; z-index: 6; font-family: var(--body); color: #fff; }
#practice.show { display: block; }
#practice button { pointer-events: auto; cursor: pointer; touch-action: manipulation; }
#practice kbd { height: 18px; min-width: 18px; padding: 0 4px; margin: 0 0 0 7px; font-size: 10.5px; border-bottom-width: 2px; border-radius: 4px; }
#practice .pbar { position: absolute; left: 50%; top: calc(var(--s) * 152px); transform: translateX(-50%) scale(var(--s)); transform-origin: center top; display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 6px; width: max-content; max-width: 640px; }
#practice .pbar .lab { font-size: 12px; font-weight: 700; color: var(--dim); margin-right: 4px; text-shadow: 0 1px 3px #000; }
#practice .pbar i { width: 1px; height: 20px; background: var(--line-2); margin: 0 6px; }
#practice .pbar button { display: inline-flex; align-items: center; height: 32px; padding: 0 13px; font-size: 13.5px; font-weight: 700; color: #d6d9f5; background: var(--glass); border: 1px solid var(--line-2); border-radius: 3px; }
#practice .pbar button.on { color: #fff; background: linear-gradient(90deg, rgba(255, 61, 110, .92), rgba(255, 154, 61, .92)); border-color: #ffe1b0; box-shadow: 0 0 16px rgba(255, 120, 90, .6); }
#practice .pbar [data-guide].on { background: linear-gradient(90deg, rgba(110, 80, 220, .92), rgba(70, 150, 255, .92)); border-color: #cfd8ff; box-shadow: 0 0 16px rgba(120, 140, 255, .55); }
#practice .pbar .tip { flex-basis: 100%; margin: 2px 0 0; text-align: center; font-size: 12.5px; font-weight: 600; color: #e8eaff; text-shadow: 0 1px 3px #000, 0 0 8px #000; }
#practice .pguide { position: absolute; right: 22px; top: calc(var(--s) * 128px); width: 318px; max-height: calc(100vh / var(--s) - 318px); transform: scale(var(--s)); transform-origin: right top; display: none; flex-direction: column; pointer-events: auto; background: linear-gradient(180deg, rgba(30, 33, 78, .9), rgba(12, 14, 34, .92)); border: 1px solid var(--line-2); border-top: 3px solid var(--c, var(--gold)); border-radius: 4px; box-shadow: 0 14px 40px rgba(0, 0, 0, .45); }
#practice .pguide.open { display: flex; }
#practice .pguide header { position: relative; padding: 11px 44px 9px 14px; border-bottom: 1px solid var(--line); }
#practice .pguide header b { display: block; font-family: 'BHS', var(--body); font-weight: normal; font-size: 19px; }
#practice .pguide header span { font-size: 12px; color: var(--dim); }
#practice .pguide .x { position: absolute; right: 8px; top: 9px; width: 30px; height: 30px; font-size: 14px; color: #fff; background: rgba(255, 255, 255, .08); border: 1px solid var(--line-2); border-radius: 50%; }
#practice .pguide .x:hover { background: rgba(255, 90, 120, .5); }
#practice .pguide .body { overflow-y: auto; padding: 10px 14px 14px; font-size: 12.5px; line-height: 1.55; color: #dfe2fb; }
#practice .pguide .desc { margin: 0 0 4px; color: #c5c9ee; }
#practice .pguide h4 { margin: 12px 0 5px; font-size: 12.5px; color: var(--gold); letter-spacing: .04em; }
#practice .pguide ul, #practice .pguide ol { margin: 0; padding-left: 18px; }
#practice .pguide li { margin: 3px 0; }
#practice .pguide kbd { margin: 0 2px; vertical-align: 1px; }
body.touch #practice .pbar kbd { display: none; }
body.touch #practice .pbar { top: calc(var(--s) * 132px); }
body.touch #practice .pguide { right: calc(var(--s) * 150px); top: 8px; max-height: calc(54vh / var(--s)); }
"""
open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('ok')
