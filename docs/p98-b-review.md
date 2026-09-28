# Pass 98, lane b: eye centring (56, 65, 76, 77, 78, 86)

Source: the programmatic eye-centring audit in `/dev/shm/p97/eyes/report.md`.
Rule: every eye, boss or rounded end is a true arc concentric with its pin.
Fix the outline, not the pin, unless the pin is at the wrong drawn place.

Scratch captures are in `/dev/shm/p98/b/`:
- `before/` and `after/`: default, pin close-up and rotated close-up (yaw 40, pitch 25) views.
- `after/<id>-r1|r2|side|ph25|ph50|ph75.png`: whole-model rotated, side and phase views.
- `m<id>.png` (plate plus before) and `n<id>.png` / `v<id>.png` (after) are the montages.

## Per movement

### 077: alternating-peg-pawl.js
- **Finding confirmed.** The lever's rounded top was traced about Brown's end, whose centre sat 0.054 above the upper pawl pin. The pin sat low in the end (0.60 R).
- **Fix.** The top arc (r 0.081) is now centred on the upper pawl pin `p.arms.upper`, so the end is concentric with it. The lever is prescribed, so the recorded motion is unaffected. The pawls (z 0.12–0.185) never reach the lever plate (0.21–0.29).

### 078: pull-pawl-geometry.js
- **Findings confirmed.**
  - Frame A's apex was centred 0.02 above the rocker axle.
  - Both pawl eyes were egg-shaped.
  - Rocker B's left end and the lopsided bulge at its right pin were off-centre.
- **Fix.** A new helper, `concentricEnd`, runs the straight edges tangent from their far points into a true arc about the pin.
  - **Frame apex:** a 36 px arc about A (the right leg's own distance from A). Both legs now run straight from their feet. The left leg's top moves out by up to 22 px of source, tapering to 0 at the foot, and it stays behind the rocker. The front `framePivotBoss` was 0.115 and is now 0.09 so it doesn't overhang the apex.
  - **Pawls:** the left eye is r 24 px and the right is r 28 px, each about its pin. Hooks and toes are unchanged, so tooth seating is unchanged.
  - **Rocker:** the left end is a 36 px arc about the left pin. The right pin has a 42 px circular eye unioned onto the bar in place of the traced bulges.
- **Unchanged motion (not rebaked).** The cached trajectory in `pull-pawl-profile.js` does not fingerprint the geometry, and its study checkpoint (`artifacts/review/078-*`) isn't in the tree.
  - The new eyes add pawl mass: left +8.5%, right +4.4%.
  - Pivot polar inertia rises too: left +2.7%, right +0.5%.
  - The recorded path uses the old values. Contact geometry is unchanged, and the 078 contact tests still pass.

### 065: tappet-stud-stop.js and data/tappet-stud-stop-outline.js
- **Finding confirmed.** The stop's hump over the fixed pin was centred 0.035 up-left of the pin.
- **Stop fix.**
  - The traced hump curves are replaced by a straight top edge, `line(745,706)`, plus a unioned circle of r 0.26 about the pivot. This circle is `p.pivotBossRadius`, and it leaves a 0.03 rim round the 0.23 pivot head.
  - The trimmed outline is regenerated with `node scripts/generate-tappet-stud-stop-outline.mjs` (973 points). The C sweep never reaches the boss.
- **Tappet fix (hidden flaw).**
  - Tappet A's root was a lopsided quadratic blob about C's shaft. It is now a clean belt: the tip arc and a root arc of radius h = 0.25 about the shaft, with the flat underside tangent to both.
  - The root lies inside C's 0.26 hub. The tip, and so the stud contact, is unchanged.

### 086: pump-catch-core.js and scripts/lib/pump-catch-candidate.mjs
- **Finding confirmed.** B's eye bulge was centred above the pin.
- **Fix.**
  - Each bar edge now runs straight to its foot on the pin's perpendicular. This removes the traced bulge and the outer bend corner.
  - A true circle of r 36 source px about the pin is unioned on. The result is a round eye bulging evenly past the bar.
  - The qualified candidate got the same change, because the production-parity test requires it.
- **Rebaked.** `node scripts/generate-pump-catch-cam-rest.mjs` ran in 4.5 min:
  - 1613 states; the previous bake had 1561.
  - 0 subdivisions and 115 geometry splits.
  - Lifts are 2.5955 in both revolutions.
  - The repeat error is 3e-13.
  - Cam-contact time is 3.07 s; it was 3.08 s.
  - The provenance hashes are refreshed.
  - The motion differs from the old bake by up to 0.2 rad at some instants, because the catch's swing timing shifted slightly.

### 056: lathe-gear-engagement.js
- **Finding confirmed.** The rounded end enclosing the slot was centred 0.11 beyond the shaft's rest position at the slot end.
- **Fix.**
  - The end is an arc of r 0.273 about the slot's end-cap centre, where the shaft rests. It flows tangentially into an outer edge concentric with the slot's arc, of radius camRadius + 0.273. That edge meets Brown's traced lower edge at (248,809).
  - Smooth Béziers join it to the traced upper edge and the toe.
  - The slot and the cam walls are unchanged.

### 076: jointed-tappet.js
- **No change (false positive).** The visible tappet is a union of two capsules, so its bend is an arc concentric with pin C by construction. The close-ups confirm this.
- The flagged mesh is `tappetWeb`, the hidden layer between the two cheeks. Its rest-key cutout next to C caught the audit's arc fit.

## Tests and screens

Targeted test files:
- `alternating-peg`, `lathe-gear-engagement`, `pull-pawl`, `tappet-stud-stop`: 28 of 28 pass.
- `pump-catch`: 8 of 8 pass after the rebake. Before the rebake, the parity test failed as expected.
- `tests/models.test.mjs` blocks for 56 and 65: pass. There are no separate blocks for 77, 78 or 86.

Screens, before (HEAD copy) against after:

| Screen | Result |
|---|---|
| `screen-disconnected-parts` | Identical for 56, 65, 77, 78 and 86. No detached parts, slivers or lips; near-miss counts unchanged. |
| `screen-body-intersections` | 56, 65, 77 and 78 identical, at 0.0000. On 86 the screen runs out of memory at HEAD too, so this is pre-existing. |
| `screen-coincident-faces` | 0 flagged for 56, 65, 77, 78 and 86. |
| `check-loop-seams` | 0 seams and 0 pops for 56, 65, 77, 78 and 86. |

## Residuals
- **078 (invisible):** the motion bake predates the concentric eyes. Pawl mass is +8.5% left and +4.4% right; contact surfaces are unchanged.
- **Display profiles:** `src/data/display-profiles.json` bounds for 56, 65 and 86 were not re-measured. The outline changes lie inside the existing envelopes.
