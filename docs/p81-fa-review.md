# Pass 81 lane p81-fa: 13, 86, 181/182, 195, 213, 232, 310

The audit findings are in `/dev/shm/audit81/a/findings.json`. Captures are kept outside Git in
`/dev/shm/p81-fa/`:

- `tiles/ID.png`: the default view beside the plate, the oblique view, and the rotated, back, top
  and seam phase views.
- `86-before-z3.png` and `86-after-z3.png`: the model at the maximum zoom-out (3x the fit
  distance).
- `181-after.png`: back and oblique views of 181 and 182.
- `213-before.png` and `213-after.png`
- `232-after-z.png`
- `310-after.png`
- `p213z.png`: a plate crop.

## 13: single movable pulley

- **Before:** plate 12's hauling hand and cuffed forearm were inside the default view. Rotated, the
  forearm ended in a flat cuff.
- **After:**
  - The hand is removed. Brown draws none.
  - The free fall leaves the sheave at Brown's angle: 13° from vertical, steeply down and to the
    left. Before, it left at 45°.
  - The fall runs straight past the plate's left crop and ends as a clean capped rope below the
    default frame at every hauling phase (base effort length 6.0).
  - The camera fit covers everything except the free fall, plus the fall only as far as Brown's
    crop (1.1).
- **Residual:** the long tail can be seen running out of the frame in rotated and top views. At
  extreme zoom-out its end is visible.
- **Follow-up for the integrator:** the display-profile motion bounds and floor for 13 are now stale.
  They are regenerated centrally.
- **Validation:** `docs/validation/141-review.json` was regenerated with `sourceCommit` kept. Only the
  `authored-belts.js` hash changed.

## 86: cam-latched pump catch

- **Before:** the two open band runs ended at x = 5.3. In zoomed-out rotated views they stopped in
  mid-air.
- **After:**
  - The runs continue straight to x = 26. Their capped ends stay outside the frame of every orbit up
    to the maximum zoom-out.
  - The tubular segment count scales with length, so the lay is unchanged.
  - The study data are not changed. `sampledMotionBounds` widens the studied `profile.motionBounds`
    only to the band ends. The default framing is unchanged, because the authored fit bounds
    intersect the motion box.
- **Test:** the pump-catch test now checks each part against the model's own `sampledMotionBounds`.
- **Residual:** the plain pump rod below the plinth still ends at a fixed length. It was not flagged.

## 181, 182: diagonal catch (baked)

- **Before:** seen from behind, the hub bores were open and black. The fixed shafts stopped short
  inside the catch hub (0.309 vs 0.32) and inside the lower back-weight sleeve (-0.766 vs -0.74).
- **After:** in `assembly.js`, each fixed shaft now runs from its round head through the bore and
  ends flush with the rearmost bored face of the body it carries:
  - catch: 0.309
  - upper handle: -0.58
  - lower handle: -0.766
- **Shaft material:** the shafts are now the heads' steel. A flush black end still read as a hole.
- **Handle arms:** the reported arm gap of about 0.13 is measured from the arm plate to the shaft
  through the handle's own bored hub. Each arm is fused into a hub (outer radius 0.43, bore 0.12)
  that runs on the shaft. There is no visible gap, so this is a screen false positive.
- **Rebake and validation:**
  - Rebaked with `scripts/bake-diagonal-catch.mjs` (9001 keys, 777 compact).
  - `review-diagonal-catch-assembly.mjs` finds no intersections in 8.05M queries.
- **Stale evidence:** `docs/validation/181-browser.json` has no generator. Its source hashes are now
  stale.

## 195: opposed feed-roll worm wheels

- **Before:** the lower wheel's visible face was a plain disc, so its rotation could not be seen.
  Both hubs were thin black cylinders (r 0.19).
- **After:**
  - Both wheels carry Brown's hub, turned in the wheel metal: a boss of r 0.32 (about a quarter of
    the wheel) with a raised collar of r 0.16 on each face. These are Brown's two circles, measured
    at 32 px and 16 px.
  - The shaft (r 0.073) is unchanged.
  - The lower plain back face and the lower hub take the shared quadrant cue
    (`rotation-indicators.js` 195). The toothed upper wheel takes none.
  - The change is in the 195 branch of `feed-worm-assembly-parts.js`.
- **Reports:**
  - `authored-gears-core.js` is untouched, so the reports that fingerprint it did not need a rerun.
  - The reports that fingerprint `feed-worm-assembly-parts.js` were rerun: `feed-worm-195-solids`
    (POSES=17), `feed-worm-195-working-faces` and `feed-worm-207-working-faces`. Only the hashes
    changed.
- **Residual:** the boss is the wheel colour, so it reads mainly by its edge and shadow.

## 213: split-rim winding stop

- **The audit's premise is wrong.** Plate 213 does draw the pin: it is the small circle in the ring's
  tooth space, above the ratchet (crop `p213z.png`). The Geneva-type stop needs it, and the
  reconstruction notes and the caption lineage (212/213) agree. It was kept.
- **What was wrong was its presentation:** it was a brass stub bridging a 0.34 axial gap and
  standing 0.08 proud of the ring.
- **After:**
  - The ratchet runs just behind the ring, with a 0.03 axial gap.
  - The pin is turned in the ratchet's own material.
  - It rises from the ratchet's middle plane only through the ring's tooth band and ends flush with
    the ring's front face. In the default view it reads as Brown's circle in the notch.
  - The planar contact and the motion are unchanged.
- **Test:** the old test pinned a gap greater than 0.33. It now checks for a running gap of 0.02 to
  0.05.

## 232: lift-and-draw pawl

- **Before:** pawl C sat in front of the wheel (z 0.31) and engaged it through a roller and axle
  reaching back into the tooth plane. The retaining click did the same.
- **Wheel radii:** the wheel's tip and root radii were set to Brown's proportions relative to A's
  pivot height: tip 0.915 L = 1.90 and root 0.773 L = 1.61. Before, they were 2.02 and 1.69.
  - This lets C's eye and band lie in the wheel's own plane, clear of the tips.
  - The pin circle of C's eye clears the tips by 0.04.
- **Pawl C:**
  - C is one flat plate (z ±0.1, inside the wheel's ±0.19). It is Brown's sector band, concentric
    with the wheel, 0.06 to 0.36 outside the tips.
  - Its square end drops one finger into the tooth space. The finger's rounded end (r 0.065) is the
    working tip.
  - The draw contact is on the flank at r 1.76.
  - The upper pivot pin and the coupler pin now reach back through C's eyes.
- **Retaining click:** removed, because Brown draws no click. A's two holes are its fixing bolts,
  and the caption names only B, C and the wheel. The wheel dwells by prescribed friction. The fixed
  pin remains as A's slot guide pin.
- **Checks:**
  - A 2D polygon check over 400 cycle samples: zero overlap area, 0.038 clearance on the back stroke,
    and touching only at the seat and draw.
  - The solid test gives a minimum gap above -2e-6.
- **Tests:** the tests were rewritten for the new radii, the draw radius and the absent click.
- **Residual:**
  - C's band sits just outside the tips, where Brown overlaps them.
  - The carrier lift and drop are still prescribed.
  - Nothing holds the wheel against rollback between draws.

## 310: Grimthorpe single three-legged gravity escapement

- **Before:** the fly cross-arm (depth 0.075) and the vanes (depth 0.075) had coplanar front and back
  faces where the arm ends overlap the vanes.
- **After:** the cross-arm is 0.055 deep, so its ends bury inside the vanes.
- **Rebake:** only 310's plate entry was rebaked. Its `inputHash` changed and its plate outlines are
  identical. The 309, 311 and 312 entries are byte-identical.

## Screens

- **Intersections** (`show-body-intersections`, spacing 0.01, 129 samples), before and after:
  - 181, 195, 213, 232 and 310 show no pairs in either run.
  - 13 and 86 exhaust the screen's heap (4 GB) in both runs, because their long laid ropes are too
    large. They were not screened.
- **Loop seams:** all eight IDs are clean.
- **`scan-bad-faces`:**
  - The 310 fly-vane z-fight is gone. Two pre-existing arm/bracket pairs that look the same remain.
  - 213 keeps its pre-existing ring/stud back-to-back contact, which is the friction fit.
  - 86 and 232 are clean.
