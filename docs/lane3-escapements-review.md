# Lane 3: verge, Debaufre, seven-tooth and three-legged escapements (source match)

Reviewer: Claude Opus 5.5, 2026-09-23. Scope: Movements 234, 238, 298, 299,
300, 301, 302, 306 and 307. The shared rule for this pass is that each movement
should match Brown's engraving in its initial camera, part shapes and part
set. Production-route captures
(`scripts/review-movement-source-views.mjs`) were inspected beside
`public/engravings/mm_NNN.png` before and after each change. Motion laws are
unchanged unless noted. MuJoCo is not used by any of these movements.

## 234 — verge and crown wheel

Changes (`vergeAndCrownWheelEscapement` options, 234 only):

- Brown draws a flush toothed plate on a shallow band, not a deep cup, so the
  floor now sits at the tooth base, with a dark disk marking the bore. The
  hub stays under the plate and the arbor stops below it. The arbor radius is
  0.2, as drawn.
- The band is 0.44 deep and the rim 0.14 thick (it was 0.34). The teeth are
  0.72 tall, a third of the radius (they were 1.0).
- The pallets are plain flags A: each is one brass plate, 0.56 wide, running
  from the spindle to the release edge. There is no narrow neck and no dark
  lip.
- S is a round rod 8.4 long.
- Presentation: the model is turned 180° about the crown axis, and the camera
  direction is `[6.2, 4.9, 6.9]`. This sets S falling about 22° to the right
  across the wheel with its near end low, and puts the steep flag on the
  left, as Brown draws it. The journal caps and both witness marks are removed.

The verge law is unchanged. Tooth height and rim thickness do not enter it,
because the pallets never go below the tip plane.

Intersections: `audit-verge-crown-clearances.mjs` at 513 phases and 0.02
spacing found only tangent tip/face and root/neck contact (< 1e-5).
`show-body-intersections.mjs 234 --spacing=0.01 --samples=129` also found only
0.0000 tip contacts. The negative control in
`verge-crown-working-solids.test.mjs` still detects more than 0.02.

Residual: the flags are about 0.23 R long against Brown's 0.44 R. The verge
equation fixes that length: with a 100° included angle and 25° swing,
h/R = 0.059 and the tip distance is h / cos 75°.

## 299 — clock verge (Brown's edge-on detail)

- Presentation: `rotate [π/2, π/2, 0]` stands the crown upright. The camera
  `[0, 0.035, -1]` looks along the verge staff from the crown end. The field
  is 8° over a crop of the journal, the two pallets and about two pitches of
  band and teeth. The journal therefore reads end-on, with the pallets
  radiating about 100° apart over teeth on either side, as in the plate.
- The foliot is built, but the presentation removes it, since Brown's detail
  crops it out. The staff now ends at a collar (the drawn journal) just
  outside the lower pallet; it used to project 4.8 toward the camera.
- The crown now shows its solid band, as Brown hatches it. The hub and arbor
  are lowered below the tooth base. The pallets are plain blades (no lips).
- The teeth are 0.8 tall (they were 1.0). Brown's proportion suggests about
  0.6, but 0.6 and 0.7 let the 45° foliot swing's dipping pallet hit the tooth
  backs by 0.013–0.016. 0.8 is clean.
- Tests: `movement-299.test.mjs` now asserts that the foliot is detached by the
  presentation and that the band is visible. The foliot geometry checks are
  kept.

Intersections: the audit (513 phases) and `show-body-intersections 299` found
only tangent working contact.

Residual: this is a true single view of a working verge. The engaged near and
far teeth project close together under the journal, while Brown's schematic
draws them one pitch apart on either side. The crop also shows the far-side
teeth and the arbor below the band.

## 302 — two-weight balance verge

- Pallets A and B are now single brass blades. The carrier continues the
  working face at full width, 0.15 thick, up to the arbor. The narrow neck and
  dark lip are hidden, and the carriers no longer stand proud.

Intersections: the audit (513 phases) and `show-body-intersections 302` found
only tangent contact.

Residual: the blades are about 0.5 long against Brown's 0.72 (the verge law).
At t = 0 one blade hides behind the collar, where Brown shows an open V. The
lower weight arrangement is still inferred.

## 300 / 301 — Debaufre

- The wheel matches Brown's front elevation. There is a lobed, flat-topped
  boss around a 0.3 collet, and two spokes down-left and down-right at ±55°
  from the vertical (there were three at 120°). The rim is 1.78–1.95 (it was
  2.13–2.30), so the barbed stems are as long as drawn. The pallet bake was
  regenerated (`generate-debaufre-300-301-pallet.mjs`, input hash
  `286533e9b5c5fbed`). The rest/impulse/tail gap test still passes.
- 301 starts its clock a quarter cycle later (`geometry.displayCycleOffset`),
  mid-impulse, where the D is level with its flat up as Brown draws it. Its
  canonical times shift with it. `stateAtCycleCoordinate` is unchanged, so
  300 and 301 still publish the identical mechanism state.
- Presentation removes the wheel and pallet witness marks from both.

Tried and reverted: I slaved impulse to the balance angle, with the wheel
still driving at release and a monotone free drop carrying that speed. After
rebaking, the end-of-impulse lift-off got worse (0.066 against 0.04). The flange end is
carved by the parked teeth as the pallet swings to ±42°, so the lift-off is
geometric, not an artefact of the easing. The original smootherstep law and
the bake for it were kept.

Intersections: `show-body-intersections 300|301 --spacing=0.01 --samples=129`
found no penetrating pairs. The 161-phase body test and the negative controls
pass.

Residual: the pallet is still 0.67 thick against Brown's about 0.28. That
thickness is the impulse chord, 2R sin(impulse/2). The end-of-impulse lift-off
stays at up to about 0.04. The spacer drum still shows as a dark disk behind
the boss in 300. 301 still frames the whole wheel, where Brown breaks it off
above the arbor.

## 238 — seven-tooth anchor

- Presentation removes the two white motion indices. Geometry and law are
  unchanged.
- `show-body-intersections 238 --spacing=0.01 --samples=129` found only the
  coaxial fit of the A hub in its fixed journal (0.04), the anchor body
  against that journal (0.01), and tangent B contact. These are unchanged by
  this pass.
- Residual: the star wheel is drawn about 20% larger relative to the anchor
  than in Brown's plate.

## 298 — geared-balance watch verge (`authored-geared-balance-verge.js`)

- The pallets are now wire loops closed around the verge rod, as drawn. The
  lower arc of each loop is the unchanged helical working face, with 0.002
  running clearance. The return over the top clears the teeth over the full
  ±30° swing. The wire is 0.09 thick (it was 0.07).
- The recorded flaw "escape wheel 0.25 lower than drawn" was re-measured and
  does not hold. The hub centre is within 1 px of Brown's, and the top teeth
  sit 0.15 below the arbor, against Brown's about 0.12. The wheel was not
  moved.
- `show-body-intersections 298` found no penetrating pairs at 129 or 513
  samples.
- Residual: each loop is about 0.5 long along the arbor, against Brown's 0.35.
  The helix pitch sets that length.

## 306 / 307 — three-legged escapements (`authored-three-legged-escapements.js`)

- Both now use a contact-selected wheel law. The wheel moves only as the
  finite faces allow, and drops freely between faces, ending in impact.
- 306: the opening is a point-symmetric stepped S. The vertical steps are the
  impulse faces and the side steps are half-dead rests with about 0.4°
  recoil. The legs are narrow strips bent into sharp tips, and the pendulum
  strips pass behind the screws.
- 307: stops D and E are arcs about the pendulum pivot, so the lock is truly
  dead. Three sharp backward pins act on pallets A/B at the steps of the slot.
  The neck is broken off as drawn, and t = 0 is Brown's pose, locked on D.
- `show-body-intersections --spacing=0.01 --samples=129`: before, 306 had
  0.149 and 307 had 0.070 / 0.058. After, only working contact at 0.0000 in
  both. The finite-solid tests include 257 phases and negative controls.
- Residual: the pendulum is prescribed and the drops are ideal. 306's escape
  angle is 0.68°, not Beckett's 1°. In 307 the slot sits lower than drawn,
  the spears are broad near the hub, and A/B are mostly hidden behind the hub.
