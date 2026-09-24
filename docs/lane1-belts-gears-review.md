# Lane 1: belts, pulleys and gears review (006–055, 216, 239)

Reviewer: Claude Opus 5.5, 2026-09-23. Each movement was captured with
`scripts/review-movement-source-views.mjs` (default view beside the engraving
and an oblique view) and compared with `public/engravings/mm_NNN.png` before
and after its correction. Intersections were screened with
`node scripts/show-body-intersections.mjs ID --spacing=0.01 --samples=129`
(rendered closed-mesh penetration between rigid bodies at 129 sampled phases;
triage, not certification). The screen treats a deforming rope or belt and
every fixed part as one body, so rope/belt contact with fixed hardware was
checked separately with a dense-point probe at the relevant phase.

| ID | Change | Screen worst depth before → after |
| --- | --- | --- |
| 006 | Belt ends fastened to the sector rim just under the lever bar instead of 0.07 inside it. | 0.070 (belt in lever) → 0.003 (belt on flush tread index patch) |
| 007 | None. Brown draws the upright shaft C unsupported, so none was added. | unknown → 0.0029 (belt on tread index patch) |
| 012 | None. | unknown → 0.0042 (rope end tied into the bag neck) |
| 015 | Rope tube sampled at 1536 segments instead of 128. The 0.031 "groove edge" cut was chord sag of the coarse tube across small wraps. | 0.031 → 0.0004 |
| 024 | Square straight-flank teeth, as the plate draws, replacing the involutes. Ratio stays prescribed at 30:36. The 2D closest approach is about 0.005. | none → none |
| 025 | 36 teeth instead of 24, as the plate counts. Upper collar and shaft end moved to the plate's heights. Near-orthographic edge-on camera (fov 14). | none → none |
| 028 | Adjustment cycle opens at the plate's roller radius, 0.97 (sequence 0.97, 1.24, 0.55). | none → none |
| 039 | Square teeth. Arm in front of the rod, as the plate draws it. Sun shaft stops behind the rod plane, and the arm's sun end turns on a short stud in front of the rod. Slit half-width 0.075 → 0.065. | none → none |
| 043 | 44 finer teeth. Upper (front) shaft continues 0.6 past the apex. The lower shaft ends 0.17 short of the apex, clear of the upper shaft. | none → none |
| 048 | Pinion 18 → 16 teeth, half the gear's pitch diameter, with a half-pitch mesh phase. Gear face 0.27 → 0.23 wide. Lever plate, pins and rod moved 0.035 forward, clear of the collar and shoulder. Camera fov 17 → 11. | 0.0086 (lever in sleeve shoulder) → 0.0020 (pin-in-bore running clearance at the screen's near-wall tolerance) |
| 055 | Ring C's supporting web kept but painted plain paper colour, without receiving the tooth shadows that made it read as a separate grey disk. | none → none |
| 216 | Tooth and body extrusions keep their 0.008/0.012 chamfers inside the checked outlines (`bevelOffset`). Before, each tooth grew by its chamfer. Presentation note corrected. | 0.0014 (hand-off tooth) → none |
| 239 | Square teeth, 0.447 wide, matching the involute's width where the stop noses bear, so the stops trap the same free play. Stop pockets re-cut with 257 cutter poses. Hub rear face stops before the fixed output journal. | 0.068 (hub in journal) → none |

## Remaining limits

- 006: prescribed sector/band transfer.
- 007: C has no drawn or modelled support. Selector shifting is idealized.
- 012: Brown's hand is omitted.
- 015: Six parts support the load where Brown says seven. The fixed rope end is tied into the front pin end (0.016 deep).
- 024, 039, 239: The square teeth are not conjugate. Speed ratios are prescribed, with a few thousandths of running backlash.
- 025, 043: The finite bevel teeth are clear in the sampled screen, but that does not qualify a loaded bevel mesh.
- 043: Two intersecting shafts cannot both pass the apex, so the plate's crossing is only partly reproduced.
- 039: The sun-end stud needs a front bracket that is neither drawn nor modelled.
- 048: Perspective still makes the loose gear look slightly wider than drawn.
- 055: The plate does not establish the web behind ring C, and the involute teeth differ from its square teeth.
- 216: The pinion shaft's bearing lies in front of the section plane and is neither drawn nor modelled. At t = 0 the model follows the site animation's hand-off phase, a quarter turn from the plate's pose. The teeth are source-animation profiles, not square.
