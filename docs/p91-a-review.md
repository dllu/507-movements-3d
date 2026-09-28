# Pass 91, lane p91-a: 80, 269, 270, 287, 320

- **Reviewer:** Claude Opus 5.5, lane p91-a. Date: 2026-09-28.
- **Captures:** everything is under `/dev/shm/p91/a/` (outside Git).
  - `before/NNN/tile.png` and `after/NNN/tile.png` show the plate beside the default view, yaw +50°/pitch 20°, yaw −50°/pitch −15°, back, top, and phases 0.33 and 0.66.
  - `zNNN/b-*.png` (before) and `zNNN/a-*.png` (after) are the aimed zooms named below.
- **Screens** for 80, 269, 270, 287, 320 and 321. A baseline copy of HEAD for the lane's files is at `/dev/shm/p91/a/base/`.
  - `screen-disconnected-parts`: `disc.json` and `disc270.json`. The baseline is `base/disc.json`.
  - `screen-coincident-faces`: `cf.json` and `cf270.json`. The baseline is `base/cf.json`.
  - `check-loop-seams`: 6 checked, 0 seams, 0 pops, 0 errors.
- **File claims (p91-a):** `crossed-rack.js`, `crossed-rack-geometry.js`, `authored-mutilated-racks.js`, `authored-bearings.js`, `bearing-working-parts.js`, `authored-pickering-governors.js`, `authored-maintaining-power.js` and `maintaining-clock-parts.js`. `crossed-rack.js` and `maintaining-clock-parts.js` were not edited. `display-profiles.js` was claimed briefly while its entries were regenerated, then released.
- **Regenerated artifacts:**
  - `src/simulation/baked/maintaining-clock-clicks.js`: only `320-p` changed (826 knots). `321-R` and `321-T` are byte-identical, and `--check` passes.
  - `src/data/display-profiles.{js,json}`: only the entries for 80, 269, 270, 287 and 320 changed.
  - The 269 relief bake inside `authored-mutilated-racks.js`: the signature now includes the handoff gap.

## 80: pawls without front protrusions
- **Before.** Each pawl's pivot pin ran 0.005 past the pawl's front face and carried a front cap 0.011 thick and wider than the bore. Both stood out in front of the flat plate (`z80/b-all.png`).
- **Change.** The front caps are deleted. Each pin now stops 0.004 inside the eye's bore. Each pawl is one flat plate in its own layer, with nothing in front of it.
- **Unchanged:** the hook webs that reach back to the rack teeth, the pins' rear caps and the motion. The mesh count went from 16 to 14.
- **Captures:** `z80/a-all.png`, `after/080/tile.png`.
- **Tests:** crossed-rack passes 8/8. It now asserts that there is no front cap and that each pin ends behind the pawl's front face.
- **Screens:**
  - Disconnected parts: 0 detached, the same as HEAD.
  - Coincident faces: 0.
  - Seams: 0.
- **Proposed ledger row:** assessment **reasonable**, visibleFlaws "".
  - Append to limits: "p91: the pivot pins stop inside the pawl eyes; no caps or pins stand in front of the flat pawls."

## 269: gaps between the rack groups
- **Cause.** Brown's four groups abut. The pinion therefore had to reverse mid-mesh at the shared boundary, which cut six teeth to stubs 0.024–0.038 tall (of 0.20) and chamfered six more.
- **Change.** A toothless gap of 2 pitches (0.553) now lies between successive groups. The pinion reverses across exactly that gap with the same C2 quintic; its half-width equals half the gap.
  - The lower group's phase follows from the group start, so every group stays conjugate.
  - The seven-tooth source pose is kept: the contact is in the third space of the seven.
- **Pitch sweep.** Gaps of 1–3 pitches and half-widths of 0.75–2 pitches were tried. The half-width that equals half the gap was always best. The worst remaining tooth height for each gap was:

  | Gap (pitches) | Worst tooth height (of 0.20) |
  | --- | --- |
  | 1 | 0.05 |
  | 1.5 | 0.08 |
  | 2 | 0.11 |
  | 2.5 | 0.14 |
  | 3 | 0.16 |

  Two pitches balances the frame's length against the tooth heights.
- **Result.**
  - Eleven teeth are now full height, where HEAD had five.
  - The six teeth beside the gaps keep 0.111–0.126 of their 0.20 height (55–63%), each cut by a single chamfer. HEAD had six stubs at 0.024–0.038 and six more cut to about 0.11.
  - The frame is 7.76 long. It was 6.10 at HEAD, and Brown draws 5.31.
  - Peak gear speed rose from 1.50 to 2.25 rad/s. The readable-timing checks pass.
- **Captures:** `after/269/tile.png`, `z269/a-all.png` (phases 0 and 0.25 in the front view).
- **Tests:** movement-269 passes 11/11. Its layout, stroke, tooth-position and group-start checks now include the gaps. It newly asserts exactly six relieved teeth, each keeping more than 55% of its height, and every other tooth full height. camera-catalog passes after the profile regeneration.
- **Screens:**
  - Disconnected parts: one near-miss, a 0.016 gap at phase 0.868, while the gear reverses inside a gap. It is expected, because no tooth touches the frame there. HEAD had 0.
  - Coincident faces: 0.
  - Seams: 0.
- **Proposed ledger row:** assessment **minor**.
  - visibleFlaws: "The frame is about 46% longer than Brown's (7.76 against 5.31 units) because of three two-pitch toothless handoff gaps, and the gear has 20 teeth against his 18. The six teeth beside the gaps are chamfered to 55–63% of full height; Brown draws them full."
  - Append to limits: "p91: Brown's abutting groups would jam a gear reversing mid-mesh. A two-pitch toothless gap between groups lets the gear reverse clear of both racks (a prescribed quintic; nothing drives it inside the gap). Eleven teeth are full height."

## 270: rotation matches Brown's arrow
- **Before.** The pulley turned clockwise (−2π/6 rad/s). Brown's arrow on the left figure has its feathers at the top right and its head pointing down the left side, which is anticlockwise.
- **Change.** The outer race now turns at +2π/6 rad/s.
  - The cage, the rollers and the left figure's cover all derive from that rate, so they reverse with it. So do the lower sheave and the rope's lay travel, which is signed by the belt speed.
  - The strand lay's handedness is not directional and is unchanged.
- **Also fixed: coincident faces.** The six retainer pins ended flush with the back face of the rear retaining plate, which gave 6 flagged pairs (also present at HEAD). The pins now end 0.003 inside the plate. This is in `bearing-working-parts.js`, in the roller-bearing path, which only 270 uses.
- **Captures:** `after/270/tile.png`.
- **Tests:** movement-270 passes 8/8, with the speed signs updated to anticlockwise and the marker loop closure taken modulo the loop. bearing-working-solids passes 4/4.
- **Screens:**
  - Coincident faces: 0 (6 at HEAD).
  - Disconnected parts: 0 detached.
  - Seams: 0.
- **Proposed ledger row:** assessment **reasonable**, visibleFlaws "".
  - Append to limits: "p91: turns anticlockwise with Brown's arrow; the retainer pins no longer lie flush with the rear plate."

## 287: turned upper head
- **Before.** The upper head was a flange, a keeper with a visible gap below it, and a conical cap stacked on the spindle. The spindle ran on above the cap. The dark spring clamps showed in the gap as black wedges, which is 59.png (`z287/b-all.png`).
- **Change.** The head is one lathed solid, following the plate (263 px axis, 0.018 per px). From the bottom up:
  - the collar: a thin plate (r 0.78), a round-edged band (r 0.90) and a thin plate (r 0.765);
  - a flared neck;
  - a pointed lip (r 0.48);
  - a dome.
- **Other details.**
  - The spindle ends in a blind bore inside the head, so it no longer shows above.
  - The upper and lower leaf-end clamps are shrunk so they lie wholly inside the collar and the sleeve flange. They no longer protrude as black boxes.
  - The cap and keeper meshes are removed. The mesh count went from 25 to 23.
- **Captures:** `z287/a-all.png` (front, oblique, from below and from the side), `after/287/tile.png`.
- **Tests:** movement-287 passes 8/8, and clamp-working-solids passes (both 287 cases).
- **Screens:**
  - Disconnected parts: 0 detached. There is one lip on the spindle feather key, which is also present at HEAD and unchanged.
  - Coincident faces: 0.
  - Seams: 0.
- **Proposed ledger row:** assessment **reasonable**, visibleFlaws "".
  - Append to limits: "p91: the upper collar and finial are one turned solid as drawn; the spindle and the leaf clamps end inside it."
- **Not changed:** the lower sleeve collar is still a stacked flange and keeper, although Brown draws it the same way as the top collar. It shows no gap or protrusion.

## 320: click as one curved bar
- **Before.** An arm on an arc concentric with p ran over the teeth and then dropped a large hull-shaped wedge into the root, giving a hooked outline (60.png).
- **Change.** The click is one flat plate made of two parts:
  - **Eye:** r 0.10, bored for the stud, as before.
  - **Bar:** 0.10 wide, on a single circular-arc centreline. The arc runs through the pivot, a point 0.08 above the tip of the tooth behind (the bar's half-width plus 0.03 clearance), and a point 0.09 up the valley bisector.

  The bar runs on past that point, and its end is trimmed by the seated valley (grown by about 0.0005). The tip therefore lies against the tooth face and along the back of the tooth behind, at the valley's own angle. This matches the user's sketch (61.png).
- **Seating.** The outline is turned by the 0.0008 rad its clearance allows, so the click rests exactly at the nominal seat (`angleAt(0)` equals the seat rotation).
  - The nose is in the root from phase 0.05 to 0.5.
  - The click rides the next tooth up to phase 0.9 and has dropped back by 0.99.
  - The ratchet, pivot, stud and timing are unchanged.
- **Bake.** `320-p` was rebaked; only its signature and knots changed.
- **Captures:** `z320/a-all.png` (phases 0/0.25/0.5/0.75/0.9/0.99 and two oblique views), `after/320/tile.png`. There is also a 2D check, `c320.png`.
- **Tests:** these pass:
  - movement-320 (9), with a new assertion for the curved-bar role, nothing beyond the tip and a shallow bow;
  - movement-321;
  - maintaining-clock-bake: the largest playback error is under 2e-6. The bar is sampled with 240 segments so that a polygon-vertex kink does not exceed that;
  - maintaining-clock-interfaces.
- **Screens:**
  - Disconnected parts: 0 detached. The two short-of-pin near-misses are also present at HEAD.
  - Coincident faces: 0.
  - Seams: 0.
- **Proposed ledger row:** assessment **minor** (unchanged).
  - visibleFlaws (unchanged): "The 0.05 rad settle of p onto its click turns p alone; the chain does not show the matching take-up."
  - Append to limits: "p91: the click is one curved bar from its eye to a tip trimmed by the seated valley. Brown's click spring is still not modelled."

## Tests run (all pass)
- crossed-rack
- movement-269, movement-270, movement-287, movement-320, movement-321
- maintaining-clock-bake, maintaining-clock-interfaces
- bearing-working-solids, clamp-working-solids
- camera-catalog, authored-loader, catalog
- pulley-belt-geometry, display-tooth-passing, opening-camera-motion
