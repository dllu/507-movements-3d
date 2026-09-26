# Pass 63 verification audit

Reviewer: Claude Opus 5.5 (read-only audit lane p63-audit), 2026-09-26.

Scope: the 73 movements changed in pass 62 and rated reasonable. Each was compared with its plate in the default view, then inspected rotated +60° and −70° about vertical, from the back and top, at two motion phases and at two phases just before the loop seam (0.97 and 0.995). The loop-seam checker ran on all of them.

## Findings

| ID | Severity | Problem | View |
|---|---|---|---|
| 86 | minor | The hanging pump rope descends straight through the solid A-frame base plate (no hole); visible where the rope crosses the base slab. | rotated +60 and side (yaw 90) views, phase 0 |
| 160 | minor | Grey end block on the spring pole's small end floats in space, attached to nothing (Brown just breaks the pole off); reads as a leftover mount. | rotated -70 and +60 views |
| 183 | minor | Right lifting rod's top is bent 90 degrees into a horizontal pin to reach the quadrant eye (a kinked rod end), unlike 181/182 which use a straight rod with an eye on the pin. | rotated +60 view, phase 0.25 |
| 229 | flawed | Undrawn grey guide bar on two splayed legs sits under the chain (Brown draws only sprocket and chain); the chain ends run into slots in this bar and the end link pops in/out of it (seam checker: visibility pop 5.5% at phase 0.186). | back (yaw 160, elev 25) and top views; zoomed-out default at phases 0.18-0.20 |
| 238 | minor | Pallet C is a thin flap jutting forward at an angle from the arm tip (with a rounded stub behind it), reading as a stuck-on piece rather than the arm's own end as drawn. | oblique yaw +/-40 elev 30, and back view |
| 264 | minor | Loop seam: worm/roller position jump 0.52% and velocity kink 15.4 at the loop point (check-loop-seams score 1.74, only one above tolerance in this set). | seam phases 0.97-1.0, default view |
| 373 | minor | The two drive-belt strands end abruptly in mid-air at the old crop line once rotated (driving pulley not modelled). | rotated +60 and -70 views |
| 419 | minor | Rocker E is a thin bent tube under a separate flat bar with an open gap between; Brown draws E as a solid circular-segment rocker. | default and rotated views |

The findings for 86, 160, 183, 229, 238, 373 and 419 went to lane p63-c (docs/p63-c-review.md). 264's flagged jump was the seam checker's own bracket, now sized by the fastest part's speed (scripts/lib/loop-seams.mjs).

## Clean in every captured view

39, 48, 52, 53, 54, 55, 63, 75, 90, 91, 93, 96, 97, 98, 99, 100, 101, 114, 126, 142, 146, 156, 163, 166, 181, 182, 184, 185, 188, 198, 219, 251, 262, 263, 272, 277, 288, 292, 293, 296, 304, 313, 316, 318, 333, 354, 360, 381, 384, 393, 396, 400, 405, 418, 421, 423, 443, 447, 467, 475, 482, 490, 502, 504, 507
