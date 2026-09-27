# Pass 72, lane d: 269, 284, 299, 309, 314, 389, 391, 394, 397, 398

Captures are outside Git in `/dev/shm/p72-d/`:

- `before/` and `after/`: `ID-default.png` (render beside plate) and `ID-oblique.png`.
- `ov397.png` (before) and `ov397b.png` (after): the render warped onto the plate by two fixed landmarks, with
  Brown's ink laid over it in red. `ov391.png` does the same for 391 before the change.
- Phase and rotated sheets (phases, ±60°, top, back): `t269.png`, `t397.png`, `t391.png`.
- `z398.png` / `z398a.png`: crop of 398's output crank, before and after.

Each intersection screen was run on its own (`--spacing=0.01 --samples=129`). `check-loop-seams` over all ten IDs
found 0 seams and 0 pops.

**Framing note for the integrator.** 391 and 397 changed their motion envelope. Their stale `display-profiles.json`
motion boxes now crop them slightly: maxNdc is 1.06 for 391 and 1.11 for 397. Their authored `cameraFitBounds` were
widened to match. They need `measure-display-profiles` rerun, which this lane may not do. 269's envelope is
unchanged apart from depth.

## 269: closed end and rod (improved)

- **Before.** The closed end was joggled behind the gear (z −0.30…−0.42). The black rod cylinder started inside the
  frame at the gear's reach, so in the front view it crossed the middle of the closed end. Brown draws the rod
  leaving the closed end's outer face, in one outline with the frame.
- **Why the joggle was not needed.** The bridge's inner face already stands 0.05 clear of the gear tips at the
  stroke limit, so the gear never reaches it in any view.
- **Change** (`authored-mutilated-racks.js`):
  - The bridge now spans the rails' full depth, a hair inside their faces so no faces are coplanar. The joggles and
    the rod's flat neck were removed.
  - The rod starts at the bridge's outer face (buried 0.01) and uses the frame's material.
  - The rails stop 0.002 inside the bridge's outer face.
  - The hub, shaft and hidden bearing keep their old absolute depths.
- **Result.** `after/269-default.png` reads as Brown's: a solid closed end, with the rod and collar leaving it.
- **Intersections.** Clear after (2 bodies, 69 meshes); the ledger's pass-51 screen was also clear.
- **Faces.** No zfight. Two rail/bridge same-look overlaps were removed.
- **Test.** `movement-269` now requires a flush full-depth closed end, the rod starting at its outer face, and the
  rod sharing the frame's material.
- **Residual (forced, unchanged).** The frame is about 15% long. The gear's 3.5-pitch tip radius needs 1.9 extra
  pitches past the last tooth for the lower-right pair to engage without the gear crossing the closed end.

## 397: rocker upright at rest, Brown's crank and table (improved)

The overlay (`ov397.png`) showed a visible mismatch that the ledger did not record:

- The rocker leaned 6° left in the display pose. Its top joint stood about 20 plate px left of Brown's, over his
  upright pivot.
- The table sat about 35 px left of Brown's and overlapped the link pins.

The cause: the slot's rest angle is +5.9°, and the top joint was built at the rocker's local vertical.

- **Rest lean** (`generate-open-crescent-shuttle.mjs`, baked file regenerated; `authored-intermittent-shuttle-drives.js`).
  - The top joint and upper arm are set back by the law's rest angle, so the rocker stands upright while it rests, as
    Brown draws it.
  - The slot, the law and the closure are unchanged.
  - The top-joint velocity now uses the offset angle.
- **Crank to Brown's measurements.** The centre is (0.68, 0.07) and the radius 1.18. These come from the recorded
  plate points: centre (381, 242), pin (300, 195) and pivot (327, 407) at 79.7 px per unit. They were (0.78, 0.20)
  and 1.22.
- **Table and link.**
  - The guide is 0.03 above the top joint (was 0.08).
  - The bar is 3.89 × 0.18, placed so that at rest it spans Brown's ends.
  - Brown's link is 2.02 long. It is kept at 2.30 (was 2.42), because the rocker swings 65° from upright and the top
    joint then falls 2.22 below the guide. The link must be longer than that; at 2.30 it reaches 75° at the extreme.
- **Result** (`ov397b.png`). The table ends, link, top joint, rocker pivot, crank and pin all land on Brown's lines.
- **Intersections.** None before; none after.
- **Faces.** The pivot bearing's bore is opened to 0.147, which removes its zfight with the arm's bore. Three
  same-look overlaps remain (arms joining the slot body, lug/boss).
- **Motion.**
  - The near-rest creep is ≤ 0.11 rad.
  - The table stroke grows from 4.3 to 5.1.
  - Seam 0; the `movement-397` tests pass unchanged.
- **Residual (forced).**
  - The slot's upper end runs past Brown's stop. With Brown's crank (D = 174 px, r = 94 px) the pin reaches 268 px
    from the pivot, but Brown's slot stops at 238 px. The slot must reach the pin, or the pin leaves it.
  - The table lug stands about 12 plate px left of Brown's, because of the 2.30 link.

## 391: taller guides from a 13-pitch stroke (improved)

- **Measure.**
  - Brown's guides are about 2.15 gear tip diameters tall. The old 10-pitch stroke gave 1.72.
  - The ledger's "80%" understated the gap.
  - At the same scale, Brown's guide pins sit 36% down their grooves in his pose; the old pose had them lower.
- **Change** (`authored-alternating-weighted-racks.js`):
  - The stroke is 13 pitches (`extraStrokePitches = 3`), so the wheel makes 1.3 turns (26 whole teeth) per cycle.
  - The crosshead's low point drops 3 pitches, and each rack gains 3 teeth at its lower end.
  - The guide pins stand 3 pitches higher on the racks. At the bottom corner everything above the crosshead is where
    it was, and the grooves grow upward.
  - Lever C and spring d follow the groove top, as before.
  - `sourcePhase` is 0.67 (was 0.71), so the pins sit about a third of the way down, as Brown has them.
  - The camera bounds were extended by the same 0.735.
- **Result** (`after/391-default.png`). The guides are 2.14 tip diameters tall against Brown's 2.15.
- **Intersections.**
  - Before: only spring d's hooks on their studs (0.017 / 0.016).
  - After: the same pair and nothing else.
- **Faces.** Spring d's stud stopped flush with C's rear face (a zfight). It now ends inside C
  (`weighted-rack-selector-contact.js`), and the scan is clean.
- **Tests.** Rewritten for the new design (the old ones pinned a 10-pitch stroke and one turn per cycle):
  - `movement-391`: 17 teeth, 13 pitches per stroke, 1.3 turns per cycle. The monotonic-output tolerance is now
    1e-14, since float noise reaches 5e-15 at the larger angles.
  - `weighted-rack-handoff-solids`: 2.6π per cycle. The old working teeth are pinned at index 3.
  - `weighted-rack-selector-contact`: the per-sample lever-step bound is scaled by the 1.3× pin speed (0.0035 → 0.0046).
  - All 20 pass.
- **Residual (minor).** Lever C and spring d stand higher and reach further above the right guide than Brown's.
  C's pivot is about 3× Brown's height above the groove top, which the selector-contact geometry fixes.

## 398: Brown's eyed crank plate (improved)

- **Change** (`authored-cam-rocking-drives.js`):
  - The output crank was a thin dark-blue bar, invisible on the blue disc. It is now Brown's eyed lever plate: the
    hull of a 0.30 eye on the shaft and a 0.20 eye at the pin, in brass, so it reads as a separate part.
  - The shaft end is 0.155 in radius, which avoids a coaxial overlap with the rear stub.
- **Intersections.** None before; none after.
- **Faces.** Same-look only.
- **Pose (forced).** Brown's crank points up-left, toward the crosshead, while his roller sits at a lobe tip, i.e. at
  the maximum distance d. In a slider-crank, maximum d means the crank points away from the cam: φ = 0, here 32°.
  - Putting the crank at Brown's 135° would turn the three-lobed cam 24°: 20% of its 120° symmetry, and very visible.
  - The lobes were kept as drawn.
- **Residual (forced).** The crank throw is 0.40 against Brown's about 0.6 (0.19 against 0.29 of the disc radius).
  The groove's radial range (0.39–0.77 R) fixes the roller's stroke at 2r.

## 309: fork pins (faces only; nib forced)

- The fork pins P and Q ended flush with the half-fork's rear face (2 zfights). They now stop 0.004 inside it.
- 309 was rebaked (`generate-gravity-escapement-plates.mjs 309`). The plate outlines are identical; only the input
  hash changed. The 310, 311 and 312 entries are byte-identical.
- Intersections: none. Faces: 1 same-look.
- **Residual (forced; see p63-b).** Brown's nib hangs in the lifting tooth's swept path. The swept-cut bake removes it
  entirely.

## Unchanged, residual confirmed

- **284.**
  - The slider stands 4 px low (0.8% of the plate). Brown's setting sweeps 1.16 teeth, and the oblique claw needs
    1.35.
  - Screen: contact only (ratchet/click 0.0001, ratchet/catch 0.0000, coaxial caps 0).
- **299.**
  - The journal stands 0.19 pitch above the tips, against about 0.15.
  - The far teeth read as solid dark faces. The crown's lit side faces away from the camera, and Brown's hatching has
    no rendered equivalent.
  - Screen: tangent pallet contacts (0.0000) only.
- **314.**
  - C reaches 1.60 against 1.70–1.74 (p64-fix-esc2).
  - Screen: wheel/pallet 0.0001 and wheel/C 0.0000, both working contacts.
- **389.**
  - The stop is about 7 plate px (half a tooth to a tooth) high, and the eccentric offset is 17 px against 13
    (p70-b).
  - Screen: clear.
- **394.**
  - Brown's rack pitch (about 14 px) is finer than his pinion's (about 18 px), so his drawing cannot mesh. The model
    keeps his 10-tooth pinion's size and one module for both.
  - Brown's teeth are box-shaped; the model's are 25° stub involutes, needed for the 4-tooth internal difference at
    the ends.
  - Screen: none.

## Tests run

All pass:

- `movement-269` (11)
- `movement-309`, `gravity-escapement-working-solids`, `movement-310`, `movement-311`, `movement-312` (40)
- `movement-391`, `weighted-rack-handoff-solids`, `weighted-rack-selector-contact` (20)
- `movement-397`, `movement-398`, `groove-drive-working-solids`, `alternating-drive-solids`, `source-presentation`
