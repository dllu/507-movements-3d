# Pass 64 lane p64-fix-pawls: in-plane pawls for 206, 225, 235, 236 and 240

Audit findings (`/dev/shm/audit64/{a,b}/findings.json`): each pawl, click or stop reached its
ratchet through a pin, cranked foot or cross-cylinder that stuck out of its own plane. In 240 the
lower S-lever was also a round bent tube. The user's rule is to capture the pawl or detent outline so
that it engages the teeth in-plane, with no added pins, depth offsets or protrusions.

The same approach is used for all five movements. Each pawl is a single flat extrusion of Brown's
outline, and its working nose is that outline's own rounded end. The pawl lies inside the ratchet's
tooth band. Where two pawls stack on one pin, the wheel is made thick enough to cover both. The body
is shaped so that only the nose enters a tooth space. The band runs outside the tip circle and drops a
short neck or finger into the space's opening. Where a return or free-run path was baked offline, the
generator now checks the whole plate outline, not only the nose circle. No wheel direction changed.

Captures (outside Git): `/dev/shm/p64-fix-pawls/before-*.jpg` and `after-*.jpg` show five views each
(default, rotated +60 and -70 about vertical, back and top), at four phases. The official default and
oblique captures are in `/dev/shm/p64-fix-pawls/review/`, and the side-by-side sheet is
`review-defaults.jpg`. The 2D outline and tooth plots are `g225.png`, `g235.png`, `g240.png`,
`p206.png` and `rest240.png`.

## 206: shared-pivot double-stroke ratchet

- **Before:** the curved pawls sat in front of the wheel (z 0.30 and 0.53) and reached the teeth
  through black finger pins that ran back into the tooth plane.
- **After:**
  - The wheel is 0.39 thick at z 0.215 (0.02 to 0.41).
  - The left pawl is at z 0.12 and the right pawl is at z 0.32. Both lie inside the tooth band.
  - Each pawl outline is a band concentric with the wheel. Its inner edge is 0.11 clear of the tips.
  - Each band ends in a square-cut end whose inner corner is a short wedge nose. The nose enters the
    tooth space through its opening and ends in a rounded tip. The tip radius is the solved finger
    radius less the bevel.
  - The band narrows into a smaller pin eye (radius 0.155), which clears the tips at the low
    reversal.
  - The lever moves to z 0.56 and the common pin is shortened.
  - The finger meshes are gone. `contactFinger` is now an empty marker at the nose centre.
- **Kinematics:** unchanged (still 53 teeth, clockwise, one tooth per vibration).
- **Intersections:** before, none. After, two 0.0001 solid contacts, which are the intended
  nose/tooth contacts. The 2D outline probe shows at least 0.0005 clearance everywhere else.
- **Residual:** the arcs sit closer to the tips than Brown's wide-bowed bands. The right nose reads
  as a short wedge rather than Brown's plain square end.

## 225: vibrating carrier with one hinged pawl

- **Before:** the pawl was a thin plate above the wheel with a black 0.46-long cross-pin nose.
- **After:**
  - The wheel moves to the pawl's plane (z 0.23), and the shaft and journal move with it.
  - The pawl is a flat bar whose rounded tip has the working nose radius (0.09).
  - The bar arches away from the wheel near its end: its centreline passes (0.45L, -0.20) and
    (0.8L, -0.28). Only the tip enters the tooth space, both on the drive and while the pawl drags
    back.
  - `carrierPawlBarClearance225` checks the whole outline. Over the full cycle the minimum is 0.00020,
    which equals the designed running gap.
- **Intersections:** clean before and after.
- **Residual:** the arched end reads as a gentle hook where Brown draws a plain curved bar.

## 235: spring tappet arm and star ratchet

- **Before:** the grey holding click and the tappet hook reached the star through 0.72-long nose
  cylinders.
- **After:**
  - The star is 0.22 thick at z 0.5, and the tappet hook and holding click share its plane.
  - The tappet is Brown's beak. Its upper edge sweeps down and back from a rounded nose that is
    tangent-matched at -2.35 rad. The nose arc covers every drive contact direction (-2.24 to
    -1.0 rad).
  - The holding click is a slender band concentric with the star, 0.05 outside the tips. It drops a
    straight tapered hook into the tooth space, and has a smaller eye (0.09) that clears the passing
    points.
  - The click bearing moves in front of the star (z 0.65) and its pin is shortened.
  - `scripts/generate-star-tappet-paths.mjs` now checks the whole outline. The baked paths did not
    change (`--check` passes).
  - Test results: drive gap 0.00054, seated hold gap 0.00055.
- **Intersections:** before, none apart from the pre-existing open spring tube. After, the same.

## 236: alternating pawls b and c

- **Before:** cranked tip plates and pawl-coloured toe cylinders reached back from pawls b and c to
  the wheel.
- **After:**
  - The wheel is 0.32 thick at z 0.36. Pawl b (z 0.30) and pawl c (z 0.42) lie inside it.
  - Each straight pawl ends in its own rounded toe with a half-angle of 105°.
  - Pawl b's trailing edge tapers toward the toe, so the next tooth tip clears it at the end of the
    stroke.
  - The wheel-arbor stud boss moves with the wheel.
  - The body bore opens to 0.075 and the eye to 0.1. This removes coplanar z-fighting with the hub.
- **Intersections:** clean before and after. The maximum toe gap is 0.00013 (24-chord sagitta).
- **Residual (unchanged, outside this lane):** grey fixed stud bosses and flanges behind fulcrum a
  and the wheel arbor show in rotated views. Brown does not draw them.

## 240: three ratchet stops

- **Before:** all three stops reached the wheel through 0.46-long toe cylinders. Their
  source-shaped bodies ran to the tooth roots, which only worked because the bodies were in another
  plane. The lower S-lever was a round grey tube.
- **Wheel geometry:** the model wheel was about 18% larger than Brown's and off-centre, so in-plane
  stops could not clear it. The wheel now follows the plate: tips about 135 px about the hub at
  (213, 234), giving radius 1.9 and root 1.56. The stops' pivots are re-derived from the same pixel
  anchors.
- **After:**
  - The wheel sits at the stops' plane (z 0.32).
  - The hook stop is a bowed band, and the straight stop is a bar.
  - Each runs to a neck just outside the tip circle and then into its own rounded toe (radius 0.0645):
    the hook along the opening bisector, the straight stop radially, so its bar runs on over the next
    tip.
  - Stop C is a block with Brown's round knob and a toe finger. It is one flat plate with Brown's flat
    S-lever, whose band course is traced from the plate pixels.
  - The S-lever runs right under the wheel, loops back, and ends in a pointed leaf round the pivot
    eye.
  - C and the S-lever turn rigidly about that eye.
  - The dynamic leaf-spring tube and the attachment pin are no longer drawn or built.
  - Pivot pins are shortened, and the collars sit just off the plate faces.
  - `scripts/generate-ratchet-stop-240-paths.mjs` now checks the whole plate outline and was rerun.
    The new maxima are 0.112, 0.088 and 0.112 rad.
- **Clearance:** the minimum whole-outline clearance is 0.0005 (seated), and C's is 0.0008.
- **Intersections:** clean before and after.
- **Residual:**
  - C's flexing spring is not modelled. C and the S-lever turn rigidly about the lever's eye, which
    is noted in `reconstructionNote`.
  - One degenerate triangle in the wheel body is pre-existing: it also appears with the old radius.

## Files

- `src/simulation/authored-intermittent-core.js` (only these movements' functions and
  `makeCurvedSharedPivotPawl`, which only 206 uses)
- `src/simulation/carrier-pawl-225-working-parts.js`
- `src/simulation/star-tappet-working-parts.js`
- `scripts/generate-star-tappet-paths.mjs`
- `src/simulation/alternating-pawl-236-working-parts.js`
- `src/simulation/ratchet-stop-240-working-parts.js`
- `scripts/generate-ratchet-stop-240-paths.mjs`
- `src/simulation/baked/ratchet-stop-240-paths.js`
- Tests:
  - `tests/movement-206.test.mjs`
  - `tests/movement-225.test.mjs` and `tests/carrier-pawl-225-contact.test.mjs`
  - `tests/movement-235.test.mjs` and `tests/star-tappet-working-parts.test.mjs`
  - `tests/alternating-pawl-236-contact.test.mjs`
  - `tests/movement-240.test.mjs` and `tests/ratchet-stop-240-working-parts.test.mjs`

These tests had pinned the pin and tube designs. They now assert the in-plane outlines instead.
