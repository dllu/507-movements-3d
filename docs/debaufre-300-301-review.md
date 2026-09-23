# Movements 300/301 — Debaufre double-wheel escapement: working-solid review

Scope: `makeDebaufreRatchetWheel` and `debaufreFrictionalRestEscapement` in
`src/simulation/authored-escapements.js`. Movement 300 is Brown's front
elevation and 301 the side elevation of the same mechanism. They share one
factory, one geometry and one motion state. Motion is prescribed and
analytic: there is no MuJoCo or other dynamics. Contact is the working tip
against the rendered pallet solids.

## Defects found (baseline)

Visual review against `public/engravings/mm_300.png` and `mm_301.png`:

1. The teeth were broad curved triangles. Brown draws narrow radial stems,
   each ending in a sharp barb hooked forward in the running direction
   (counterclockwise in 300).
2. Each spoke was a box of length `1.72 × rimRadius` centred at
   `0.48 × rimRadius`. It crossed past the hub by `0.38 R` and ran out to the
   tooth-tip radius, so it read as a loose stick.
3. In 301 the wheel planes were `±0.84`, a spacing of 0.51 of the contact
   radius. Brown's spacing is 129/344 = 0.375. With a 36° field and the
   camera at `(12.5, 1.4, 1.0)`, the 8.4-long balance staff showed as a long
   diagonal rod receding to the vanishing point instead of end-on.
4. There was no finite-interface review. The D pallet was built with its
   flat at the tip height and a box rest-edge sticking out past the rest
   face. The 45° brass lips were boxes sitting in the tooth path.
5. Contact witness spheres were shown during contact, so they rendered
   through the tooth and the pallet.

Baseline relative-motion screen (`node scripts/show-body-intersections.mjs 300`,
301 is identical). Default settings are spacing 0.0302 and 65 samples; fine
settings are `--spacing=0.01 --samples=257`.

| pair (4 bodies, 46 meshes) | default | fine |
| --- | --- | --- |
| tooth × D pallet | 0.2980 | 0.2987 |
| spoke × D pallet | 0.1430 | 0.1450 |
| tooth × 45° flange box | 0.0930 | 0.0930 |
| tooth × rest-edge box | 0.0930 | 0.0930 |
| spoke × flange / rest edge | 0.0525 / 0.0516 | 0.0573 / 0.0525 |
| rim × D pallet | 0.0158 | 0.0163 |
| contact witnesses × parts | up to 0.1952 | up to 0.2070 |

All 17 rows were `solid`, and there were no coaxial rows.

## Corrections

- **Teeth.** The new profile is `DEBAUFRE_TOOTH_PROFILE` /
  `debaufreToothOutline`. Each tooth is a thin radial stem from the rim with a
  forward barb. The barb point is at the contact radius. It is both the
  outermost point and the leading point of the tooth. The barb underside is
  cut back steeply (about 51° from radial), so near the pallet only the point
  can reach the rest face. Teeth, rim and hub are unbevelled prisms, so no
  bevel grows the tip past the contact radius. Twelve teeth per wheel are
  retained: 24 projected stations, a half-pitch offset.
- **Wheel.** The rim is now a flat annulus (2.13–2.30) instead of a torus
  thicker than the wheel. The three spokes run from inside the hub (0.32) to
  inside the rim (2.17). The hub is bored for the arbor, which rotates with
  it. The white rotation witness lies along spoke 0.
- **Common arbor.** A spacer drum (radius 0.72) sits between the wheels on
  the arbor. It stands in for Brown's 301 line 79 px below the arbor, which
  closes the space between the wheel planes and hides the arbor there. The
  arbor radius is 0.15.
- **Side-elevation proportions (from 301).** Wheel planes are at `±0.62`
  (Brown 201/330 px). The D radius is 0.80 (Brown 82 px); the pallet collet
  radius is 0.30 and the staff radius 0.12. The staff length is 5.9, matching
  Brown's 300 staff endpoints; previously it was 8.4.
- **Pallet.** Pallet-local x runs along the staff. The approaching teeth move
  toward +x and rest on the face at x = −t/2. All pallet material is on the
  +x side, set back by a 5×10⁻⁴ film, so the resting tip is tangent to the
  face rather than coincident with it. The pallet has these parts:
  - `palletBody`: a plain D (flat at the axis), with a rectangular notch per
    wheel-plane band.
  - `palletSweptBands`: one band per wheel plane, for |z| from 0.46 to 0.78.
  - `impulseLips`: raised brass flanges, ±0.04 about each wheel plane, capped
    at +0.12.

  The band and flange tops are height fields baked by
  `scripts/generate-debaufre-300-301-pallet.mjs` into
  `src/simulation/baked/debaufre-300-301-pallet.js`. For every one of 24000
  poses in a cycle, the densely sampled rendered tooth surfaces (0.004
  spacing) are moved into the pallet frame. Every grid node within 0.005 of a
  point is then lowered to the point's height minus 0.004. The rear band
  mirrors the front one exactly (z → −z, pallet angle → −angle), so the two
  are folded into one symmetric field. The bake aborts if any tooth point
  strikes the plain D outside the bands; this did not happen. The resulting
  entry notch is 0.112 deep. The flange is a ramp of about 13.4°. Reid's
  nominal 45° is kept only as `chamferAngle`, with the measured
  `sweptRampAngle` recorded beside it. The dark "rest edge" strip is now a
  thin line inset on the flat beside the rest face.
- **Witnesses.** The contact spheres stay positioned on the working point but
  are always hidden (`visible = false`). `userData.active` flags the live
  wheel.
- **301 framing.** `cameraDirection` is now `(1, −0.107, 0)`: no yaw, and a
  pitch that puts the camera on the staff axis at the expected fit distance
  of 27. `cameraFov` is 20 to approximate Brown's orthographic plate, and
  `cameraFitBounds` covers the full wheel height down to the D. The staff now
  reads end-on as its collet circle.
- **Motion law.** Unchanged: the same phases, amplitudes, smootherstep
  impulse/drop segments, alternation and continuity. Only `wheelPlaneOffset`,
  `palletRadius` and `wheelRimRadius` changed. The tests' shared-geometry and
  state checks all still hold.

## Evidence

- `node scripts/show-body-intersections.mjs 300|301` gave 2 bodies, 47 meshes
  and no open meshes, with **no penetrating pairs (solid or coaxial)**.
  `--spacing=0.01 --samples=257` gave the same result for both movements.
- `node scripts/generate-debaufre-300-301-pallet.mjs` gave input hash
  `324f119c6062bae3`. Two consecutive runs are byte-identical (sha256
  `40c9ec16…4e04`), and one run takes about 30 s.
- `node --test tests/movement-300.test.mjs tests/movement-301.test.mjs tests/debaufre-300-301-working-solids.test.mjs`:
  22/22 pass. `tests/authored-loader.test.mjs` passes 3/3; the routes are
  unchanged because the factory's ID set did not change. The new test file
  checks the following:
  - the baked fingerprint matches the production geometry;
  - the pallet solids are outward-wound;
  - the spokes end inside the hub and the rim;
  - the barb point is the outermost tooth point;
  - Brown's 301 spacing ratio;
  - no penetration between the escape body and the pallet body at 161 phases
    (0.02 dense points into ray-tested solids);
  - hidden witnesses and 301 framing;
  - **negative controls**: an uncarved plain D in the pallet frame is struck
    by the teeth by more than 0.05, the old failure; and advancing a resting
    wheel by 1° drives its tip into the rest face.
- Working gaps over 8000 contact samples, taken as the minimum over the
  barb's edge across the wheel thickness:
  - frictional rest: 0.0005 (the film) to 0.0038;
  - impulse up to 75% progress: 0.0042 to 0.0104;
  - last 25% of impulse: 0.0078 to 0.0405.
- Review captures:
  - `node scripts/review-movement-source-views.mjs --ids=300,301 --output-dir=/dev/shm/debaufre-review`
    (maxNdc 0.78 and 0.74);
  - `node scripts/review-debaufre-300-301-pallet.mjs --output-dir=/dev/shm/debaufre-pallet-review`
    (pallet close-ups at rest, early/late impulse, drop, rear rest).

  Inspected result: the teeth read as thin forward-hooked stems, the spokes
  join hub and rim, and 301 is side-on with the two wheels close on one arbor.
  In 301 the drum sits between the wheels and the D pallet sits below them
  with its staff end-on.

## Remaining limits (honest residuals)

- The motion is prescribed and kinematic, not physics. The balance is
  sinusoidal with a 42° amplitude, and the wheel follows smootherstep impulse
  and drop segments. Nothing validates the torque, the friction of the rest,
  or the balance dynamics.
- The prescribed wheel eases to zero speed before release while the balance
  keeps turning. The working edge therefore lifts off the carved flange in
  the last ~25% of each impulse, by up to 0.04. The published contact state
  still reports sliding contact there.
- For about 0.3% of rest samples (the last ~1° of balance swing before
  impulse), the barb edge sits up to 0.004 above the entry notch rather than
  on the face. The wheel is prescribed stationary there.
- Carved clearances are bounded by sampling: 24000 poses per cycle, 0.004
  point spacing, and 0.005 dilation plus 0.004 clearance. They are not
  continuously certified. The bake covers only the tooth solids against the
  pallet; the other pairs rely on the screen.
- Brown's barb tip lies slightly inside the knee of the tooth. The model
  makes the barb point outermost so that only it can contact the pallet.
  Brown's lobed hub boss and the inner arc in 300 are not modelled.
- The pallet thickness stays at the motion law's impulse chord (0.673).
  Brown's 300 edge-on pallet is about 0.28 wide and sits about 0.3 left of
  the wheel centre.
- Time 0 is the extreme of the front rest, with the balance at −42°. The
  default 301 frame therefore shows the D tilted, while Brown's plate shows
  it level; level occurs mid-impulse. There is no start-time hook, and
  shifting the cycle origin would change the published canonical times.
- The spacer drum's radius (0.72) is read from one line in 301 and is an
  interpretation. Wheel colours distinguish the front and rear wheels only.
