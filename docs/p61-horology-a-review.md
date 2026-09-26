# Pass 61, lane p61-horology-a: movements 288–296 rebuilt as flat plate parts

The user found that the 288–296 escapements didn't capture Brown's 2D shapes and relied on hidden pins, backing pieces and depth offsets to make the animation work. All nine are now built in one new family module. Each working part is a single extrusion of its intended outline, recovered from the plate as arcs, straight lines and regular tooth forms. The contour tool was used only to measure positions and proportions. The escape wheel's motion is **solved from contact with those same outlines**, not scripted. Lock, recoil or rest, impulse and drop therefore come from the drawn shapes.

## How the motion works (shared kit)

`src/simulation/plate-escapement-kit.js`:

- **Motion law.** The pendulum, balance, lever or detent moves by a smooth prescribed law (a sinusoid, or a pin-in-slot law with bankings for the 296 lever).
- **Contact solver.** `solveDrivenWheel` drives the wheel with a constant train torque and never lets it overlap the other part's outline. Contact is tested separately in each layer.
  - A free wheel accelerates (drop).
  - At a receding face it follows (impulse).
  - When a face pushes into it, it recoils.
  - Otherwise it rests (lock).
  - A push larger than 3 % of a pitch in one step counts as a jam, and the factory refuses to build.
- **Periodic playback.** The solver runs 2 warm-up cycles and records the third. The table is periodic: one tooth (292: one stud pair) per oscillation. The loop closes to within 1e-9 rad and playback is seamless (`wheelAngleAt`).
- **Start pose.** t = 0 is chosen so the oscillator is at its drawn angle and the solved wheel is as close as the physics allows to the drawn tooth phase. Spoke windows are laid out at Brown's angles at t = 0.
- **Extrusion.** `extrudeOutline` gives smooth side normals on curves and crisp creases at corners. It has a sector-triangulation fallback when earcut mis-bridges sharp lens windows; this was found on 296 and is now covered by a test. `turnedSmooth` builds smoothly shaded solids of revolution (294/295).
- **Load time.** Solving happens in the factory, at 0.2–0.7 s per movement in Node.

Factory: `src/simulation/authored-plate-escapements.js`, routed for IDs 288–296. Spoked wheels use the shared `spoked-wheel.js` builder, following the addendum. The p61-spokes lane set 289's lens windows in this file directly.

Removed code and tests:

- **Old factories.** `authored-anchor-`, `-annular-`, `-duplex-`, `-cylinder-` and `-lever-escapements.js` are deleted.
- **Old helpers and baked data.** `anchor-escapement-working-parts.js`, `annular-stud-working-parts.js`, `generated/anchor-escapement-envelopes.js` and `generated/deadbeat-contact-profiles.js` are deleted.
- **Old scripts.** `export-anchor-escapement-envelope.mjs`, `review-duplex-lever-contact.mjs`, `export-deadbeat-contact.mjs`, `generate-anchor-escapement-envelope.py` and `generate-deadbeat-contact.py` are deleted.
- **Shared files.** The 289, 291 and 292 bodies are removed from `authored-deadbeat-`, `-free-` and `-stud-escapements.js`; 303, 313 and 304 are untouched.
- **Old tests.** Tests that pinned the old designs are deleted: `movement-288…296`, `anchor-escapement-working-solids`, `annular-stud-working-solids`, `deadbeat-working-contact`, `stud-pallet-contact`, `duplex-lever-interfaces`, `duplex-293-finite-contact`, `lever-296-finite-contact` and `cylinder-escapement-{support-solids,contact-limits}`. `free-escapement-solids` now covers 313 only. `movement-304` checks 292's new front and back studs.

## Per movement

Solver shares below are per cycle, in wheel pitches: free (drop), follow (impulse or the notch carrying the wheel) and recoil (backward travel).

### 288 — recoil anchor

**Anchor.** The top L is a straight line. The two outer sides are circular arcs through Brown's corner points. The inner edges are straight, and the boss round `a` is a semicircle. The pallet faces are c–e (straight, inner face of H) and d–b (straight heel of K).

**Wheel.**
- The teeth have radial leading faces on the counterclockwise side, a sloped back and a flat root, as drawn.
- The wheel turns counterclockwise, per the arrow, and the tips lead. The slant is no longer reversed.
- Three plain spokes with Brown's hub come from `spoked-wheel.js`. Their spacing is an equal 120° fitted to Brown's 56/199/311°.

**Tooth count.** 31 teeth instead of about 33. At 33, Brown's anchor spans a whole number of pitches from c to d, so both pallets lock at once. This was verified: it jams. With 31, the anchor is used exactly as drawn.

**Motion.** The anchor rests 2° counterclockwise of the plate pose and swings ±3.2°. Recoil is 0.31 pitch per cycle (about 3.6° of wheel), follow 0.62.

The unnecessary back cock is removed. Only short arbors show, as Brown's hatched sections.

### 289 — dead-beat anchor

**Anchor.** The anchor hangs from `a` far above the wheel. It is built as follows:
- The stem L is straight, with a round eye.
- The band is two arcs concentric with the wheel.
- Pallet H has a locking ledge that is an arc about `a`, ending at c, and a short impulse face c–e.
- Pallet K has an underside that is an arc about `a` from b, and an impulse face b–d.

**Wheel.** 32 hooked, forward-leaning teeth. The lens-window web is set by the p61-spokes lane.

**Anchor swing.** ±2°.

**Dead-beat result.**
- Pallet H rests are exactly dead-beat.
- At K, the forward-hooked tooth face meets corner b before its tip reaches the underside, because the 24.7° slope of an arc about `a` is steeper than the tooth face. The result is a 0.02-pitch recoil there.
- Most of the advance is drop (0.94 pitch); impulse is 0.08.

### 290 — annular pendulum escapement

**Parts.**
- The frame is one extrusion: the ring, the socket and spring C above it, and the rod K with a bob just below Brown's crop.
- Pallets A and B are two identical plain rectangles at the horizontal diameter.
- Wheel D has 7 robust teeth. Each has a nearly radial leading face, a 2° tip land (no knife-edges) and a back that is one circular arc through Brown's measured radii.
- The wheel turns clockwise.
- The fixed chops at the top are a plain block with its pin.

**Motion.** The pendulum swings ±1.8°. The tabs reach radius 83.5 px against tips at 86 (lock about 2.5 px).

**Result.** Recoil 0.045 pitch, but mostly drop (0.97).

**Margin.** Tab radii of 83 and 84 px also work; 82 jams at a tip-to-corner coincidence.

### 291 — Arnold's free (spring-detent) escapement

**Balance.** A plain disc (the impulse roller) with one triangular notch g–h, facing the wheel at t = 0.

**Discharging stud.** A slim tail on the arbor at `a`.

**Detent A.** One extrusion carrying stud i, fixed at b. Stop d hangs under it. The stop reaches from A's plane into the wheel plane, as the caption describes ("attached to the under side").

**Hook k.** A bent tab. Its post sits at the back of A's plane and its lip reaches over the passing spring, which runs in front of the post and on past A's end to the stud.

**Passing spring.**
- It is held in stud i.
- On the swing that bends it, only the free end beyond k flexes.
- On the other swing it lifts A through the lip.

**Wheel B.** 13 hooked teeth leaning clockwise, with the tip leading and an undercut face. The wheel turns clockwise, consistent with the teeth, the notch side and the caption.

**Kinematics.**
- The balance swings ±250°.
- The stud lifts A by 7.8 px at d.
- The released tooth falls into the notch as it comes round and drives it (follow 0.46).
- A falls back and d stops the next tooth. There is no run-through.

**Deviations.** The balance centre is shifted (+7, +4) px and d is moved 9 px left. Both give locked tips 4 px of roller clearance and 4 px of impulse engagement. At t = 0 the notch faces the wheel as drawn, so A is shown partly lifted (about 1.7°).

### 292 — stud escapement

**Anchor.** Hung at F:
- The front arm runs from F to B, then bends to pallet c.
- The back arm runs straight from F to pallet R.
- Both arms are plain bars.
- Each pallet's locking face is an arc about F, square to the studs' path. Its end is a long inclined impulse face that forms Brown's pointed tips.

**Wheel.**
- 48 triangular studs, alternately on the front and back of the rim.
- Four plain spokes from `spoked-wheel.js`.
- The wheel turns clockwise.

**Layers.** The arm plates lie clear of the studs' ends: the front arm in front of the front studs, the back arm behind the back studs. Each pallet is a block on its arm's end reaching into its studs' layer. This is needed because the arms cross the rim in plan.

**Motion.** Anchor swing ±2°. Recoil is exactly 0 (dead-beat), follow 0.52 and drop 0.49 per stud pair.

### 293 — duplex escapement

**Balance staff.** Roller A with a notch, in the wheel plane, and the impulse pallet B in front. B is two circular arcs bulging right, with a pointed tip.

**Wheel.**
- 13 long radial spike teeth.
- 13 crown pins `a` on the rim face.
- A large full wheel, whose lower part is beyond Brown's crop.
- The wheel turns clockwise.

**Single-beat action.**
- A long tooth rests on the roller, passes through the notch, and a pin drives B (impulse).
- On the return swing, the notch only nudges the resting tooth back (recoil 0.07).
- B's reach (187.5 px) makes its path just dip across the pin circle near the line of centres. On the dead swing it therefore passes between the resting pins.
- Follow 0.66, drop 0.42 per cycle.

**Smoothness.** The balance motion is a smooth sinusoid (±100°). The old jerky motion is gone.

**Margin.** A reach of 187–188 px works; 189 hits a resting pin on the dead swing.

### 294 and 295 — one cylinder escapement model

Both IDs are built by the same `cylinderEscapement` builder. They differ only in presentation:
- **294.** The cylinder axis is rotated horizontal and the camera sits to the right-front. The wheel and its arbor are removed from view, since Brown draws the cylinder alone.
- **295.** The view looks along the axis. The near end of the cylinder is cut away at the wheel, as Brown's section shows.

A test checks that both models have identical parts.

**Cylinder.** A smooth turned tube with Brown's 294 profile:
- pivot, collar, a convex dome and a flange;
- the tube;
- the passage cut to a C (wall 180°, rounded lips A and B);
- Brown's deeper cut, as a narrow back wall;
- the lower plug, the balance collet, the collars and the lower pivot.

**Wheel.**
- 15 teeth.
- The web (rim, stalks and round-bottomed valleys) lies in the deep-cut plane.
- Each wedge pallet a, b, c stands on a short pillar at the passage level, as Brown's plan overlays them.

**Action.** Balance swing ±100°. Each wedge rests on the outside of the cylinder, enters, rests on the inside and leaves over the lips.

**Result.** Mostly drop (0.94): the lips' contact with the inclined wedge faces gives little impulse. Recoil 0.01.

### 296 — lever escapement

**Lever E-B-C.** One extrusion from Brown's outline: pentagon body, two pallet prongs, arm C. The notch E is a plain slot, and the fork end is square to it, so the roller pin never meets the horns when out of the slot.

**Balance D.** A disc carrying the roller pin, behind the lever as drawn. It takes the quadrant rotation cue.

**Lever motion.** The pin carries the lever while it is in the slot (±49° of the balance's ±230° swing). The lever then rests at the banking it reached (±5.0°).

**Wheel A.**
- 15 claw teeth: a convex circular back rising to a leading tip, and an undercut face.
- Three lens windows positioned as Brown draws them (right, lower left, upper left) from `spoked-wheel.js`.
- The wheel turns clockwise.

**Result.** Locks are clean. The impulse faces carry little (follow 0.02); the wheel mostly drops while the lever swings.

**Margin.** With a faster wheel (drop acceleration ≥ 200) the wheel runs through, so the lock margin is thin.

## Evidence

**Captures.** Before captures are in `/dev/shm/h3/before`; after captures are in `/dev/shm/h3/b` (fresh non-watching server on port 44533). Each set has the default view beside the plate, rotations A and B, a side view and 8-frame motion strips. I looked at every tile: `b/T288…T296.png` and `b/combo.png`.

**Plan-view contact plots.** Used to diagnose and tune each design; the script is `/dev/shm/h3/plot.mjs`.

**Intersections.** Screened with `show-body-intersections.mjs ID --spacing=0.01 --samples=129`.

| ID | Result |
| --- | --- |
| 288 | wheel–anchor contact 0.0000 only |
| 289 | contact 0.0000 only |
| 290 | contact 0.0000 only (the earlier 0.10 spring-in-chops overlap is fixed) |
| 291 | spring on stud 0.005, spring joint 0.005 and lip 0.003 (prescribed contacts, at the voxel limit); stop and wheel contact 0.0002 |
| 292 | pallet–stud contact 0.0000 only (the earlier 0.06 back arm through the back studs is fixed by layering) |
| 293 | roller–wheel 0.0001 |
| 294 | none |
| 295 | lip–wedge 0.0001 |
| 296 | contact 0.0000 only |

Arbors now run in bores with 0.006 clearance, which removes the coaxial touches.

**Tests.** All pass:
- the new `tests/plate-escapements.test.mjs` (10 tests);
- `authored-loader`, `source-presentation` and `rotation-indicator`;
- `movement-297`, `movement-303`, `movement-304`, `movement-313` and `movement-314`;
- `free-escapement-solids` and `chronometer-return-contact`.

`generate-authored-routes.mjs --check` passes.

The new tests cover:
- one pitch per cycle, with no jam or teleport;
- no overlap between the solved wheel and the contact outlines, or the whole anchor, frame and lever outlines;
- single-plane, single-extrusion parts for 288, 289, 290 and 296;
- wheel directions;
- 288's radial leading faces;
- 290's equal rectangular pallets;
- 294 and 295 sharing one model;
- smooth radial normals on the cylinder tube;
- caps covering exactly their outlines.

## Remaining limits (honest residuals)

- **Prescribed oscillators.** Oscillator motion is prescribed and does not react to the wheel. Impulse is kinematic contact, not an energy balance.
- **Mostly-drop cycles.** Impulse shares are small in 289, 290, 295 and 296; those cycles are mostly drop.
- **Brown's numbers changed.**
  - 288 has 31 teeth instead of about 33.
  - 291's balance and stop d are shifted by 7–9 px.
  - 292's pallets are idealized pallet blocks.
  - 293's balance reach is 187.5 px instead of 199.
- **Display profiles are stale.** `src/data/display-profiles.json` still holds the old motion bounds and speeds for 288–296. Framing uses authored `cameraFitBounds`, so it isn't affected, but playback speed caps are.
