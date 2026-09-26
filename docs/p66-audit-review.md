# Pass 66 verification audit

Reviewer: Claude Opus 5.5 (read-only audit lane p66-audit), 2026-09-26.

Scope: the 78 movements changed in passes 64–65 and rated reasonable, compared with the plates in the default view and inspected rotated ±60°, from the back and top, and at motion phases including just before the loop seam. The loop-seam checker ran on all of them.

## Findings

| ID | Severity | Problem |
|---|---|---|
| 236 | minor | The returning pawl swings well clear of the ratchet and hangs in mid-air for much of the cycle (pawl c lifts about a tooth height above the rim near phase 0.15; pawl b swings out to the left, clear of the wheel, at phases 0.65-0.85). Brown draws both pawls resting on the teeth, so the idle pawl should ride over them. |
| 286 | minor | The lifting rod doesn't just continue past Brown's break and end cleanly: it ends in a flared disc foot (the puppet valve), which the plate doesn't draw. The foot enters the frame at phase 0.5 and in the rotated views. |
| 351 | minor | Tooth forms don't match each other or the plate: the rack has triangular sawtooth teeth and the mutilated pinion has thin, hooked, claw-like teeth, where Brown draws square teeth on both. The mesh reads as a ratchet rather than a rack and pinion. |
| 498 | minor | The scale numerals 0-6 and the 0 tag use a blocky seven-segment glyph style ('4' and '5' look like digital-display digits), unlike Brown's serif numerals. This is conspicuous in the default view. |

All four were fixed by lane p66-fix (docs/p66-fix-review.md).

## Clean in every captured view

16, 17, 30, 49, 50, 51, 68, 72, 88, 130, 132, 133, 134, 135, 138, 140, 143, 145, 147, 149, 151, 157, 167, 171, 175, 176, 177, 190, 210, 223, 227, 228, 235, 240, 243, 259, 261, 278, 298, 305, 312, 321, 327, 329, 332, 340, 353, 372, 374, 376, 377, 388, 390, 392, 397, 398, 416, 420, 427, 430, 431, 432, 437, 439, 441, 457, 459, 462, 463, 466, 470, 479, 483, 491
