# Pass 101 lane u1: 037 spherical studs on one Archimedean revolution; 208 clean pinion leaves

Scratch and captures: `/dev/shm/p101/u1/`. Plates: `public/engravings/mm_037.png`, `mm_208.png`.

Claimed files: `authored-gears-core.js`, `conical-stud-geometry.js`, `conical-stud-profile.js` (deleted),
`variable-drive-205-209-parts.js`, `generated-pin-slot-208.js`.

## 037: spherical studs, one-revolution Archimedean spiral, straight ball-groove flutes

User direction: "the top-down view of the studs should be a perfect single revolution archimedean spiral from the innermost rim (top of the cone) to the outside (bottom of the cone) ... spheres embedded with their centers on the cone surface. Right now the studs are too flat and they start too high up."

### Construction (`src/simulation/conical-stud-geometry.js`, `conicalStudGear()`)

- **Studs.** Each stud is a sphere (r 0.045, `SphereGeometry`), centred exactly on the stud cone's pitch surface. The stud body runs 0.004 inside that surface, so every stud stands a full hemisphere proud. Before, the studs were cut button heads 0.024 proud.
- **Spiral.** The spiral's height is linear in output angle ψ, from h_b = −H/2 + r at the bottom rim to h_t = H/2 − r at the top rim over exactly 2π. The cone radius is linear in height, so the plan radius is r(ψ) = r_b + (r_t − r_b)ψ/2π: one revolution of an Archimedean spiral. The ends are inset by the stud radius so the end spheres are tangent to the end faces and do not overhang them. The test checks every stud centre against this formula to 1e-12.
- **Stud placement.** Studs sit on the spiral where the toothed cone has advanced exactly one flute pitch: θ(ψ_i) = i·2π/N. θ(ψ) = ∫R_s/R_t dψ, which has a closed form because both radii are linear in ψ. Near the foot the studs are 6° apart; toward the top they are 25–47° apart.
- **Mean radius.** The solved mean toothed radius is 1.0248 (Brown's is about 1.02). The slope stays at 0.53, and C = 1.8, H = 2.07.
- **Flutes.** There are N = 24 flutes. Each is a straight ball groove: a round channel about one generator of the toothed pitch cone, like Brown's straight flute lines. It receives a sphere at any height. The lands are the pitch cone itself.
  - The groove radius is linear in height, 0.0485 at the foot to 0.0585 at the top.
  - The fluted cone is one closed, indexed solid (36 rows, 22 vertices per flute per row, flat creased end faces).
  - Brown's plate suggests about 28 flutes, but 24 keeps a 0.028 land at the foot between neighbouring grooves; 28 would leave 0.015 slivers.
- **Seam (forced gap).** The two spiral ends lie at one plan angle. A stud at each end would put the top stud and the bottom stud in the same flute at the same moment, with ratios 0.26 and 2.6. The slender top of the stud cone needs about 0.6 rad of turn to lift its stud out of the flute, and the bottom law would drive the flute through it. That seam fails with ≥0.19 overlap (`p37b.py`, g = 0.3–0.6).
  - So the top stud stands 0.7 rad (40°, Δh 0.22) short of the spiral's top end. At the top the studs are already 34–47° apart, so the gap reads as the next spacing.
  - Across the seam the toothed cone advances 2 flutes, and the rate blends from the top ratio to the bottom ratio with a C2 smootherstep of the slope.
  - The bottom stud sits exactly at the bottom rim, which answers "start too high up".
- **Motion.** The law is closed form and monotone, with a Newton-polished inverse. The toothed cone turns exactly once per stud-cone turn (22 + 2 flutes). The stud cone runs at 0.26× to 3.9× the toothed cone's speed; the input is 0.6 rad/s, so the cycle is 10.5 s. The default phase now puts the stud at the line of centres low (output 0.35) with the row rising across the front, as on the plate.
- **Removed.** The stud-cut bake is gone: `src/data/conical-stud-profile.js` and `scripts/bake-conical-stud-profile.mjs`.

### Numbers

`node scripts/probe-conical-stud-contact.mjs 6000`: 6000 output angles, a 600-point sphere per stud, exact 3D distance to each groove axis.

- Minimum groove margin is 0.00117, at the top stud during its approach. There is no overlap anywhere.
- Per-stud margins are 0.0018 to 0.0053.
- Backlash with a stud centred in its flute is 0.0037 at the foot and 0.0122 at the top stud.
- Stud centres are at least 0.138 apart (diameter 0.09).
- Rendered meshes, 160 poses: stud-to-flute clearance is ≥ 0.0021 and land-to-stud-body clearance is ≥ 0.0040.

### Captures

- `cmp37.png`: plate | before | after, default view.
- `after37.png`: default, phase 0.3, top, yaw +40/pitch +25, yaw −40/pitch −25, and a close-up of the stud entering its flute at the line of centres.
- `a37-plan*.png`, `a37-planfar-crop.png`: plan views with the fluted cone hidden (the toothed cone's top overlaps the stud cone in plan, as Brown's proportions require). The studs trace a single spiral from the bottom rim inward.
- `before.png`: HEAD views.

### Tests and screens

- `tests/models.test.mjs` "movement 37 …": rewritten. It checks spheres centred on the pitch cone, the Archimedean spiral formula, the bottom rim start, speed ratio > 8, zero pitch-line speed error and the derivative against the animation. The full file passes 163/163.
- `tests/conical-stud-clearance.test.mjs`: rewritten, 2/2 (probe margin > 0.0008, rendered clearances).
- Screens for 37:
  - body intersections worst 0;
  - disconnected parts 0 detached (7 near-miss pairs, all stud-to-stud on the rigid stud cone);
  - coincident faces 0;
  - loop seams 0.

### Residuals

- The seam gap: the top stud is 40° (Δh 0.22) short of the spiral's top end. It is forced by the one-flute hand-off between ratios 0.26 and 2.6.
- The motion is a prescribed rolling law with a blended seam transfer, not a simulated contact.
- 24 flutes where Brown draws about 28.

### Proposed ledger row (037)

- assessment: reasonable
- visibleFlaws: (empty), or honestly minor: "The top stud stops 40° short of the spiral's top end (seam hand-off)."
- limits (replace):
  > p101: spheres (r 0.045) centred on the stud pitch cone along one Archimedean revolution in plan (bottom rim to top rim, ends inset by the stud radius), one flute pitch apart; 24 straight ball-groove flutes (groove r 0.0485–0.0585). Forced: the spiral's ends share one plan angle, so the top stud stands 0.7 rad short of the top end and the toothed cone advances 2 flutes across the seam with a blended rate; a stud at both ends would trap the top stud (≥0.19 overlap). Prescribed closed-form rolling law; 6000-pose sphere/groove margin ≥0.0012, centred backlash 0.004–0.012.

## 208: clean, regular pinion leaves

User direction: "208 having open slots are okay ... Although the pinion's teeth have a weird shape."

### Cause

Before, the pinion outline was the raw sweep envelope of the pins over all three rings. The pins reached r 0.72 from the pinion axis, 0.28 past its pitch line. The corners of the pin tops trace curtate trochoids that undercut every tooth into a slender hooked finger (`before.png`, right).

### Change

- **Pins.** They now stop at z 0.46, 0.06 past the pitch line (r 0.94). `pinEndZ` changed in the core, and the pin length changed in `variable-drive-205-209-parts.js`.
- **Leaves.** Each is one ideal symmetric outline, like a clock-pinion leaf:
  - radial flanks from the root circle r 0.84, filleted r 0.012 into the root;
  - closed by a single circular cap tangent to both flanks (cap r 0.101, tip r 1.03);
  - slots 0.174 wide at the pitch circle for 0.164 pins.
- **Generator.** `scripts/generate-208-pin-envelope.py` now builds this outline analytically. It then checks the outline against the exported 3D pin sweep (`scripts/export-208-pin-envelope.mjs`) and fails if any pin section overlaps a leaf.
- **Why this shape.**
  - A deeper root with radial flanks is limited by the inner ring. Its pins lag the rack law where they cross the widened strip (`fit208.py`, `ogive.py`).
  - A pure involute tip interferes above r 1.02.
  - Ogival tips close the half-pitch gap to about 0.003 but overlap by about 0.0001.
  - The round cap is the cleanest shape that clears everything.
- **Kept as before.** The open slots, the widened strip [−0.055, 0.205], the 16 slots and the motion law are unchanged. The pins are cut 0.22 shorter; Brown's face view does not show their length.

### Numbers

- Swept-pin clearance ≥ 0.0010 on every ring and the stopped-shift poses (the generator's check).
- `review-208-pin-slots.mjs` (167 poses): 0 inside.
- The largest working gap is 0.012. It occurs at the half-pitch hand-off, where both neighbouring pins ride the round caps; the gap is about 0.001 when a pin is centred. Before, it was 0.0018 with the hooked envelope. The saved-report test bound is relaxed from 0.003 to 0.013 with a comment.

### Captures

- `cmp208.png`: plate | before close-up | after close-up.
- `after208.png`: default, yaw +40/pitch +25, face close-up, yaw −40/pitch −25, edge close-up, and a view from above.
- `outline208a.png`: the new outline.

### Tests and screens

- `tests/movement-208.test.mjs`: 8/8, including a new test for 16 identical, symmetric round-top leaves between the root and tip circles.
- `tests/variable-drive-205-209-solids.test.mjs`: 4/4.
- Neighbours 205–214, `stepped-sector-contact` and `bored-worm`: 61/61.
- Screens for 208: body intersections worst 0; loop seams 0.
  - The one "detached" finding (selector collar bore clearance) and the one coincident pair (disk and input hub) involve parts this change did not touch.

### Proposed ledger row (208)

- assessment: reasonable
- visibleFlaws: (empty)
- limits (append):
  > p101: the pinion leaves are clean clock-pinion leaves (radial flanks, semicircular tips, root r 0.84, tip r 1.03, slots 0.174 at the pitch circle) instead of the hooked pin-sweep envelope; the pins stop 0.06 past the pitch line (were 0.28) so the sweep no longer undercuts them. Swept clearance ≥0.0010 on all rings and shift poses; working gap up to 0.012 at the half-pitch hand-off.

## Regenerated validation reports (pose counts kept)

| Report | Result |
|---|---|
| `docs/validation/200-226-bevel-solids.json` (POSES=33) | only the core file's hash changed |
| `docs/validation/202-264-worm-solids.json` (POSES=33) | only the core file's hash changed |
| `docs/validation/191-196-201-contact.json` (513 poses) | only the core file's hash changed |
| `docs/validation/205-208-209-contact.json` | new hashes for the 208 function, parts file and generated slot. pinSlots: 167 poses, 0 inside, max gap 0.012 |

The feed-worm 195/207 reports fingerprint unchanged functions and were left alone.

## Deferred

None.
