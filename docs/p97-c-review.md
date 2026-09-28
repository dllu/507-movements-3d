# Pass 97, lane p97-c: user findings on 131 and 132

Reviewer: Claude Opus 5.5, lane p97-c. Date: 2026-09-28. The findings come from the user's own review (screenshots `/dev/shm/p97/img/92.png`, `93.png` and `94.png`), so they are authoritative. Captures and scratch files are in `/dev/shm/p97/c/`, outside Git.

Files claimed under `/dev/shm/p97/claims` (owner p97-c):
- `authored-cranks.js`: only the 132 factory changed, plus a `mergeGeometries` import.
- `slotted-sector.js`: the production 131 model, loaded by `model-loader.js`.
- `toggle-socket-disk.js`: used only by 132.
  - It gains an optional `boreRadius`, which defaults to 0.
  - With the default, the geometry is byte-identical. The position and index hash for 132's old lower-disk call is `8385465d…` both before and after.

## 131: the mutilated gear was asymmetric (fixed)

**Plate.** Brown draws a sector with three spokes on a round hub:
- two straight side bars and one middle spoke;
- two rounded-triangle openings closed by arcs concentric with the pivot.

The old web used two free-hand "pockets" traced from the raster. They were unequal, and the right side bar was a thin sliver (user screenshot 92).

**Change** (`src/simulation/slotted-sector.js`):
- The pockets are gone. The web is now one symmetric extrusion. Each window comes from the shared spoked-wheel window builder (`spokedWheelWindow`, which is called and not edited). Each window has:
  - two straight spoke edges;
  - a rim arc at r 0.99 and a hub-band arc at r 0.42, both concentric with the pivot;
  - fillets of 0.10 at the hub and 0.08 at the rim.
- The side bars, the middle spoke and the rim band are each 0.19 wide.
- The two windows mirror about the sector's bisector. The fan's side edges are the side bars' outer edges, and they meet the root circle exactly at the ends of the tooth span.
- These are unchanged:
  - the 9 working teeth;
  - the tooth profiles;
  - the rack, slot and pin;
  - the kinematics.
- The pivot bore (r 0.19), the hub (r 0.30), the separate hub boss and the pivot shaft (r 0.18) are all centred on the pivot.

**Tests.** `tests/slotted-sector-reconstruction.test.mjs` now asserts:
- the two windows mirror each other to within 2e-3;
- the middle spoke is 0.19 ± 0.002;
- the side bar and rim band widths are between 0.17 and 0.192.

The existing checks still pass over 721 phases: a 0.001 pin/slot fit, no body/rack or tooth/rack overlap, working engagement below 0.002, and the wrong-phase control. The `movement 131` block in `tests/models.test.mjs` passes.

**Screens.**
- Coincident faces: 0 flagged.
- Loop seams: 0.
- Body screen: unchanged from before (0.195, the input shaft against the slot arm, already in the ledger).
- Disconnected parts: the rack bar and lower guide shoe stand 0.02 apart as a near-miss. This is unchanged: it is the running clearance of the guide.

**Captures.**
- `131-before-zoom.png` / `131-after-zoom.png`
- `131-after-def.png`, `131-after-ph5.png`
- `131-after-rot.png` (yaw +40, pitch +25), `131-after-rot2.png` (yaw −40, pitch −25)
- `131-compare.png` (plate | before | after | rotated)

**Residual.** Brown's openings are a little rounder than the ideal filleted windows. This follows the rulebook's "ideal curves, not hand wobble".

## 132: the central rod and the colours (fixed)

**Plate.** The rod circled in the user's image 94 is about 42 px across. That is the same width as the spindle that sticks up above the head. It runs down the axis between the crossed bars into the lower disk.

**Change** (`twinObliqueRodTogglePressMotion` in `authored-cranks.js`):
- **The rod is the upper rotor's own spindle.** It turns with the upper disk and now continues from the head down the axis to below the lower disk.
- **Lower disk.** It has a plain through bore of r 0.256 (the rod radius plus 0.006 clearance). This uses the new `boreRadius` option of `toggleSocketDisk`.
- **Pedestal.** It is now a turned solid with a bore of r 0.259, in place of a solid `CylinderGeometry`. Making it 0.003 wider than the disk's bore leaves no coincident bore walls where the pedestal is sunk into the disk and the platen.
- **Platen.** It takes the rod end in a blind bore, so the pressing face stays whole.
  - It is one closed mesh: a bored top slab over a plain block, with the shared faces left out, and a floor fanned from the bore wall's own bottom ring.
  - The body screen reports it closed.
- **Rod radius.** It is 0.25; the plate shows about 0.34. At the open limit, the oblique bars' centre lines pass 0.415 from the axis, and the square bars' half-diagonal is 0.12. So 0.25 is about the largest radius that keeps a clear gap.
  - The test samples 721 phases and requires the bar-to-rod gap to stay above 0.03.
- **Engagement.**
  - At the open limit, the rod end sits 0.02 above the blind bore's floor.
  - At full press, the rod is still 0.20 deep in the lower disk.
- **Colours.** These now come from the project palette:
  - bars: `accent` gold;
  - lower disk and pedestal: `driven` blue;
  - platen and guide ears: `brass`, the timber colour the project already uses for wooden parts. Brown hatches the platen with wood grain.
  - The upper assembly stays `driver` orange and the rod stays `ink`.
- **Winding fix.** While screening, I found the shared `boredHorizontalPlate` builds its bore walls inside-out when the outline goes clockwise in its (x, −z) frame, because ExtrudeGeometry re-winds holes only for an anticlockwise outline.
  - 132's three head rails and the bearing collar used such outlines, so their shaft bores faced into the metal.
  - I reordered those outlines in 132 to fix them. The shared helper is not changed; `cord-traverse-working-parts.js` also uses it and may be affected, so I flag it for its owner.
  - With this fix, the body screen's coaxial shaft/rail overlap went from 0.021 to 0.
- **Reconstruction note.** Updated to describe the rod.

**Tests.** The `movement 132` block in `tests/models.test.mjs` now asserts:
- the platen's dimensions, read from `geometry.userData`;
- that the rod is the rotor shaft;
- the bores in the disk and the platen;
- the rod's clearance to the blind bore floor at the open limit;
- the 0.2 engagement at full press;
- the sampled bar-to-rod clearance.

All 16 crank tests in `models.test.mjs` pass. `authored-loader.test.mjs` also passes (the routes are unchanged).

**Screens.**
- Coincident faces: 0 flagged.
- Body screen:
  - open meshes: 0;
  - coaxial overlap: 0;
  - worst solid overlap: 0.1596, from each bar's own box against its own ball end. That overlap is inside one part and was already there.
- Disconnected parts: the bed block and the centre foot are detached. This was already the case and is already in the ledger.
- Loop seams: 0.

**Captures.**
- `132-before-def.png`, `132-before-rot.png`
- `132-after-def.png`, `132-after-closed.png`
- `132-after-rot.png`, `132-after-rot2.png`
- `132-after-zoom.png`, `132-after-top.png`
- `132-after-bore.png` (lower parts hidden, closed)
- `132-after-platenbore.png` (the platen's blind bore)
- `132-compare.png`

## Validation reports

These reports fingerprint `authored-cranks.js`:
- 146-source-measurements
- 156, 157 and 158 oracle comparisons
- 159-source-clearance
- 160-authored-review
- 160-spatial-band

Their hashes had already gone stale because of the uncommitted pass-96 edit. I regenerated them with their own scripts, keeping the pose counts; none of them carries `sourceCommit`. No report fingerprints `slotted-sector.js` or `toggle-socket-disk.js`.
