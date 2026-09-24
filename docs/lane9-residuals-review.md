# Lane 9: residuals from lanes 1–3 (003, 055, 073, 142, 211, 214, 216, 238)

Reviewer: Claude Opus 5.5, 2026-09-23. Each movement was captured with
`scripts/review-movement-source-views.mjs` beside `public/engravings/mm_NNN.png`
before and after its change. Intersections were screened with
`node scripts/show-body-intersections.mjs ID --spacing=0.01 --samples=129`.
That screen is triage, not certification.

| ID | Change | Screen worst depth before → after |
| --- | --- | --- |
| 003 | Presentation only. Camera fov 18 → 9 and ground hidden. Measured in plane against the wheel, the drum already matched Brown's block (width/wheel 0.92 against 0.90). The large look came from the wide off-axis perspective showing both end faces, plus the ground shadow. | unchanged: belt-on-tread wrap contacts only (0.129 coaxial rim, 0.044) |
| 055 | Ring C's web keeps its geometry and clearance role. It is now drawn unlit in the exact page colour (`MeshBasicMaterial`, `toneMapped: false`) and casts no shadow, so C's interior reads blank. A rear spider was rejected because its rotating arms would show through the open ring. A rim race was rejected because it leaves no drive to C's sleeve. | none → none |
| 073 | Tooth root 0.70 R → 0.80 R, as drawn, with a nearly radial working face (overhang phase 1.035 → 1.02). Without the radial face the stop seats on the crest. B's catch pad radius 0.06 → 0.04 and C's stop pad 0.055 → 0.035, and B bears at 0.95 of the face. The fixed block is now a thin paper-coloured slab (1.0 × 1.2 × 0.26) with diagonal section hatching, replacing the deep grey 1.17 × 1.14 × 0.5 box. | 0.0595 → 0.0397. Only the two intended spring-to-pad welds remain: 0.040 and 0.033. |
| 142 | The horizontal traversing guide bar, which the plate never shows, is cut from x −0.27…1.20 to a short lug with a bored thread eye at x = 0.30 (`silk-traverse-geometry.js`). The bundle was rebaked (542 kB). The 370-pixel rod cannot be shortened: at about 3.74 or less the slider rises over the disk. | Production clearance report (721 samples): none → none. The body screen only covers the legacy synchronous model. |
| 211 | Rebuilt from plate measurements: wheel teeth about 9° apart, tips 8.9, roots 8.1, rim 9.2, pinion teeth about 20°. The wheel is now a 40-position wheel with 11 flat-topped teeth over 99°, and the pinion has 16 positions and 12 teeth. The ratio is 5:2, so the pinion makes one turn while the wheel turns 144° (was 32:16 with 12 teeth over 135°). The plain rim is 9.1 against tips at 8.91 (was 9.75 against 8.45). The entry pin sits on the wheel's pitch circle, and its guide flank is the offset of the pin's path on the pinion. The wheel reliefs are cut at load time by sweeping the pinion outline, enlarged 0.08, through the index. | none → none (also none at 517 samples) |
| 214 | Straight-flanked square teeth on the site's pitch circles (addendum 0.30, dedendum 0.36, width 0.66 at mid-height). Each finger is a teardrop: a boss circle of radius 0.78 with straight tangent flanks to a point. The input finger points at 34.5° (as drawn, length 3.2); the counterwheel finger points at 75° (drawn about 79°, length 3.65). t = 0 is now the plate's pose. Both terminal stops are solved tip-on-flank roots, at 1.34 turns forward and 4.48 turns back. | zero-depth stop contact → none |
| 216 | Display time is offset by a quarter input turn (2 s), so t = 0 is the plate's pose: the external sector mid-mesh with the pinion below and the internal teeth round the upper half. The motion law, tooth geometry and 8 s closure are unchanged. The site's hand-off pose is kept as `animationHandoffPose` at 6 s. The rate indices and contact markers are hidden. | none → none |
| 238 | B's tooth-tip contact moved from B's outer corner (163, 253) to where the plate's lower-left star tip actually touches B (170, 253). Tip radius 1.101 → 1.015, and root radius 0.63 → 0.58 so the star keeps its proportions (uniform ×0.92, which is 15% less area). The finite flank cut was rebaked (`generate-seven-tooth-238-profiles.py`: 14.3% area loss, bound 15%). The B-branch flank start is now derived from the profile's root vertex instead of the hard-coded vertex 946. The fixed journal at A moved 0.04 back and now sits 0.01 behind the hub's rear face. D's arbor boss radius 0.22 → 0.14, as drawn. | hub-in-journal 0.040 and body-in-journal 0.010 → only the zero-depth B working contact |

## Evidence

- 238: `movement-238`, `seven-tooth-238-contact` and `seven-tooth-238-working-parts` pass 16/16. The pinned values that changed with the smaller star are:
  - raster B contact
  - tip radius and mounting phase
  - drop midpoint clearance: 0.1987 → 0.1832
  - nearest-C clearance: 0.39 → 0.365
  - B face shortening: 26 → 19 px
  - outline vertices: 1099 → 1078
  - B reaction moment arms: 0.717/0.521 → 0.608/0.454. The bounds are now 0.58/0.43.
  - release margin before the high pallet angle: 4.9e-5 → 7.1e-5 rad (bound 1e-4)
  - release-radius tolerance: 1e-7, because the Float32 contour can round the tip up by about 2e-8

  The lock-resists-advance, finite-corner cone and complete-clearance audits still pass.
- 214: the minimum gear gap is 0.0058 through the full travel. The counterwheel has at most 0.042 rad of total play. One of the six finger encounters in the 10:12 six-turn cycle blocks; the other five pass at least 0.6 clear.
- 211: pin to pinion is at least 0.28 raw and wheel to pinion at least 0.08 raw. The pin drives at exactly the pitch ratio until 21°, and the first tooth takes over at 22.5°.
- 073: B's leaf is clear of C's stop pad, and the temporary pad-to-pad overlap (0.034) is gone. The "C flexes outward" checks are now 0.6 × tooth depth, because the teeth are shallower; the measured flex is 0.18 against a 0.12 bound.
- 142: `docs/validation/142-clearance.json` was regenerated with no overlaps. `docs/validation/191-196-201-contact.json`, `200-226-bevel-solids.json` and `202-264-worm-solids.json` fingerprint `authored-gears-core.js`. They were rerun (`202-264` with `POSES=33`), and their results are identical apart from the file hash.

## Remaining limits

- 003: the drum is about 14% smaller in diameter relative to the wheel than drawn. The belt runs centred on the drum, where Brown puts it right of centre.
- 055: the web is present but painted in the page colour, not removed. The 17/10/37 involutes differ from the plate's square teeth.
- 073: B is a round rod, not Brown's flat band. The tooth backs read slightly as fins. The block is a free-standing slab, where Brown draws a hatched corner running off the left edge. The spring-to-pad welds are intentional.
- 142: the complete rod and slider are still framed below the plate's truncated stub.
- 211: the toothed arc spans 99° and lies at 58–157° at t = 0, against about 80° at 92–165° on the plate. The pinion has 16 positions against about 18 on the plate. The guide tongue curves upward, where Brown draws a straighter banana. About 22° of relocking motion is prescribed, with nothing driving it.
- 214: the square teeth are not conjugate, so the ratio is prescribed. The teeth are narrower than drawn, to keep clearance. The finger lengths and the counterwheel finger's angle were tuned so that exactly one encounter stops. The fingers reach past the tooth tips, where Brown keeps them inside. The stop travel differs from the site animation's three turns.
- 216: there are 22 internal teeth over 165°, against the plate's about 24 over 180°; the end gaps provide the hand-off clearance. The pinion bearing is not modelled. The tooth form comes from the animation.
- 238: Brown's star has six points at 60° spacing. The model keeps seven, as the site title and the dashed line from C to a root opposite B's tip imply, since six tips cannot put a root opposite a tip. The oscillation, drops and impacts are prescribed.
