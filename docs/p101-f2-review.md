# Pass 101 fix lane f2

Lane p101-f2 (Claude Opus 5.5), 2026-09-28. Working tree on top of 25637af plus the other p101 lanes' uncommitted work (p101-u3's 236 flywheel motion is kept). Vite ran on :46042. Captures are outside Git, under `/dev/shm/p101/f2/`.

This lane covers:
- the medium findings for 052, 069, 083, 211, 212 and 236;
- the user's items 071 and 076;
- the lows for 065, 068, 072, 078, 155, 206, 225, 232, 235 and 241, in files claimed by this lane.

Files claimed:
- `authored-intermittent-core.js`, `alternating-pawl-236-working-parts.js` and `pin-clutch.js`;
- `small-single-tooth-index.js` and its profile;
- `mujoco-spring-sector/`, `baked/elbow-pawl.js`;
- `carrier-pawl-225-`, `lift-draw-pawl-232-`, `star-tappet-` and `single-tooth-241-working-parts.js`;
- `jointed-tappet.js`, `tappet-stud-stop.js`, `single-tooth-index.js`, `tilt-hammer.js`, `pull-pawl.js` and the helpers the sub-forks list.

## 236 (medium): the pawls hung on bare pins behind the lever

- **Change** (`alternating-pawl-236-working-parts.js`):
  - The lever now sits on the pawl eyes. It is at z 0.539–0.719, not 0.78–0.96. Its back face rests on c's eye bushing, which ends at 0.42 + 0.117.
  - b's eye carries a boss in its own yellow forward to the lever's back face (z 0.364–0.539). c has a short boss to the same face.
  - The lever's eye rings stand proud only at the front, so the lever's back face is the bearing face.
  - The hinge pins end at the lever's front plus a head, and the fulcrum pin is 0.28 long.
  - The web's holes are 0.002 larger than the ring bores. The coincident-faces screen had flagged three bore-on-bore pairs; it now flags 0.
  - p101-u3's flywheel motion and contact law are untouched. The wheel and the pawls stay in their planes.
- **Captures:** `236/m.png` (default, top, yaw ±50, top zoom on the eyes, back).
- **Tests:**
  - `movement-236` and `alternating-pawl-236-contact` pass 23/23. The depth assert is now 0.65–0.76, and a new check has each pawl eye meet the lever's back face within 0.003.
  - Screens: detached 0, coincident 0, body intersections 0, seams 0.

## 211 (medium): the entry pin read as a stick on the rim

- **Finding checked:** the pin centre sits on an orbit of 8.7 construction units, inside the plain rim at 9.1. That is 1.6 pin radii; the audit's 1.2 measured the pin's edge.
- **Moving the pin inward was studied** (`/tmp/s211.mjs`; results below). The guide law requires the pin to strike the tongue's hump exactly at the line of centres, where the lock releases.
  - With the pin at 8.35 (3 radii) and the hump simply grown 0.35, it strikes 2.3° early, while the pinion is still locked. The model's own guide-clearance check then goes negative, −0.0575.
  - To keep the strike at phase 0, the hump centre must move out from 4.5 to 5.7 units or more. Even moving the pin only to 8.55 needs 5.2 or more.
  - Either way the tongue's tip runs well past the plate's length, which the test holds at 5.5–6.3.
  - Brown draws the pin at the rim, beside the first tooth, so its radius is kept.
- **Change:** the stud now stands only to the tongue's front face. It is 0.155 long, not 0.32, so it no longer sticks out 0.17 past the tongue in rotated views.
- **Captures:** `211/*` in `m212.png` (bottom row).
- **Tests:** `movement-211` passes 5/5.
- **Residual:** the pin still sits 1.6 pin radii inside the rim, as the plate draws it.

## 212 (medium): the hubs were invisible, and a claw-shaped shadow showed

- **Change:**
  - Both hub rings use a darker shade (×0.68) of their wheel's colour, so Brown's double-ring hubs read.
  - The arbors end 0.03 past the hub fronts. They are now 0.66 and 0.70 long, not 1.58, so the stub shadow (the "claw") is gone.
- **Captures:** `m212.png` (top row: default, hub zoom, yaw +50, below).
- **Tests:** `movement-212` passes 5/5. The swept-depth assert is now 0.65–0.75.
- **Not changed:** the 195 half of this finding is in another lane's file.

## 083 (medium, and its low): the flat apex with a ring perched on it, and the undrawn clevis

- **Where the part lives:** production 083 is the baked MuJoCo model, `mujoco-spring-sector/geometry.js`, not the factory in `authored-intermittent-core`.
- **Change:**
  - Sector C is one extrusion. Its apex is a round boss (r 0.30) about B. The two sides run straight and tangent from the boss to the first and last tooth roots.
  - The sector rides 0.01–0.11 up its spring guides (read from the bake). So the boss is centred at the mid-lift position, and B's collar (r 0.219) always lies inside it. The collar is shaded darker, so it reads as a collar on the shaft.
  - Rod A now ends plainly in a round end. The remote fork, pin, nut and stem are physics-only and hidden, like the spring guides.
- **Re-bake:** `node scripts/bake-mujoco-movement.mjs 83`.
  - The loop is 4 s with 250 samples.
  - The seam is 0.061 px raw and 0.022 px after correction.
  - The round trip is 0.056 px, within the 0.161 limit.
  - The wheel wrap is unchanged, one tooth per period.
  - The provenance hashes are new.
- **Tests:** `mujoco-spring-sector` passes 5/5. Three updates:
  - the sector now has 4 contours, because the boss closes B's guide clearance into a hole;
  - the collision-outline simplification bound is 1e-5, because the boss arc simplifies by 2e-6, far above the crown;
  - the audit ignores hidden physics-only parts.
- **Filled-opening clearance above the crown:** 0.197, against the 0.19 limit.
- **Captures:** `083/m.png`.

## 052 (medium): the grip grazed the end barrel

- **Finding checked:** the barrel is 0.27 in radius, not 0.37. The grip's back surface stayed at r ≥ 0.275, so it grazed the barrel with 0.005 clearance rather than passing into it. It read as touching in the top view.
- **Change:** the lever stands 0.05 further forward (z 0.385), and the shoe's front face with it (0.32). The follower and pivot pins are moved to match, so no bare length is added. The grip now passes 0.057 clear in front of the barrel (min r 0.325; `/dev/shm/p101/f2/pen52.mjs`).
- **Tests:** `pin-clutch` passes 5/5.

## 069 (medium): the ragged teeth on wheel A

- **Finding checked:** A's thirty teeth were already exact rotated copies (symmetry error 4e-15). The real flaw was the traced S-curved flank.
- **Change:** new script `scripts/generate-small-single-tooth-ideal-profile.mjs`, run with RR=2.15 and RF=0.60.
  - Each tooth is two straight flanks, Brown's long back and short steep face, with the root at 0.60 of the pitch.
  - The root has a 0.07 fillet and the tip is rounded to 0.035.
  - The tip radius is chosen so B's plain rim seats between two tips with 0.0002 rad of play, as before.
  - The root is 2.15, against 2.24 traced. A shallower root jams B's traced tooth at 2.92–3.03 rad.
  - B is unchanged.
- **Motion:** re-solved with the same first-allowed quasistatic method (5200 steps).
  - The dwell pose is iterated so each turn closes exactly two pitches (miss 4e-12).
  - Entry is at 2.621 and the resisting-load pause at 3.997. The stroke eases into the rim seat, with exit at 4.3035. Peak speed is 0.453.
- **Tests:** `small-single-tooth-index` passes 8/8.
  - A new assert checks the 30-fold symmetry.
  - The pause knot angles are updated.
  - The approach to the exit is now a deceleration (speed < −0.1 at 0.02 before exit), not an abrupt rim stop.
- **Captures:** `069/m.png` (default, ph .45, mesh zooms, teeth zoom, left oblique).

## 071 (user): more symmetric slits

- **Change:** each slit is now one clean, constant-width circular-arc slot, fitted to the stud's path across the rim. Before, each was a tapered swept channel with trimmed tips, and the two outlines differed.
  - Both slits share one width: stud radius + 0.03 clearance + the larger path spread, giving a half-width of 0.150. That is a little wider than strictly needed, as the user suggested.
- **Exact mirror images are not possible:**
  - The entering and leaving stud paths are not mirror images. The best mirror axis (−14.5°) still leaves 0.12 of mismatch, and the paths differ by up to 8° across the rim band.
  - Mirrored slits would have to contain both paths, making them about 0.40 wide.
- **Tests:** `movement-071` passes 6/6.
  - The mouth-time bound is now < 300 samples (282). A slit mouth crosses the upper lock stud a little longer, and the other lock stud bears on rim throughout, as asserted per sample.
  - No stud penetrates the rim (< 1e-9), the rim is in two pieces, and no rim tip is thinner than 0.9 × minimumRimTip.
- **Captures:** `071/m.png`.

## 076 (user): straight struck arm (not changed)

See `/dev/shm/p101/f2/076/notes.md`, from the sub-fork's 44-case production-dynamics sweep.
- Pivot C sits at radius 1.772. A stud on a concentric orbit can only pass a straight arm by driving it through the radius to the mirror angle, and a longer arm does not help.
- Every straight arm (length 0.43–0.85, restQ 0.1–0.48, overlap 0.01–0.10) throws A 1.46–1.58 teeth and fails to reset:
  - B stays folded on a tooth, or
  - the heavier arm drops the tappet to q −0.43 to −1.59, or
  - small overlaps jam at the stud.
- The bend stays. A straight arm would need an undrawn counterweight or spring, or moving Brown's C or D.
- The files are byte-identical.

## Lows in lane files

### 155: the rod was the same orange as the lever

- The production model is `baked/elbow-pawl.js`. The pinned input rod (`body:rod`, `body:slider`) is now steel grey 0x7e8584.
- `elbow-pawl-baked` passes 2/2.
- Capture: `155/m.png`.

### 206: the polygonal ring

- The face step is a true 256-sided ring. The bevelled annulus had 18 segments, showing 20° chords.
- `movement-206` passes 7/7. Capture: `206/zring.png`.

### 225: the pale plinth

- The ground block keeps the shared ground look's darker side faces. Before, the top-face material was on every face.
- The top face is the project-wide ground colour (0xbfb6a0), kept for consistency.
- Capture: `225/*`.

### 232: bare black pin columns

- Both of C's eyes carry C-coloured bosses:
  - the upper pivot boss runs to carrier A's back face (0.10–0.42);
  - the coupler-eye boss runs to the coupler's back face (0.10–0.80).
- The upper pin is trimmed to −0.12…0.60.
- Brown's depth order (coupler/B in front of A in front of C) means the coupler joint must cross A's plane beside A, so it is a tall C-coloured stud, not a bare pin.
- Body intersections 0; `movement-232` passes 8/8.
- Captures: `232/m.png`.

### 235: the hub crescent and the long pin spikes

- The star's hub lies within the star's faces, so the bore is Brown's plain hole.
- The arbor is now 0.26–0.74, and the arm's pivot pin 0.19–0.47 (was −0.26–0.46).
- `movement-235` passes 8/8; the depth assert is now 0.7.
- Capture: `235/*`.

### 241: pins through both faces

- Each pin and hub ends at its part stack plus a head:
  - output arbor −0.26–0.24;
  - driver arbor −0.18–0.30;
  - driver hub −0.15–0.27;
  - click pin 0.01–0.27.
- A's hub lies within the wheel's faces.
- The driver disk's bore is 0.1, so it no longer coincides with the hub's bore. The screen had flagged this pre-existing pair; it now flags 0.
- `movement-241` passes 9/9. Capture: `241/*`.

### 072 and 078

These were done by the lows2 sub-fork; the details are in `/dev/shm/p101/f2/lows2/notes.md`.
- **072:** the wiper tips are filleted to r 0.036, and the drop face is turned 0.079 rad to keep the full lift. Release, fall and landing are re-solved, and landing speed is now 0.701.
- **078:** lever B is one extrusion of circles joined by tangent lines, with a straight tapered handle. Lever-coloured collars span each pawl pin gap.
- `tilt-hammer` passes 9/9 and `pull-pawl` 7/7.

## Screens (for the lane's IDs)

- **Disconnected parts:** detached counts match the audit baseline.
  - The 211 bore near-miss and the 235 and 241 "floating" driver/star groups are frameless moving groups, already present in the audit screen.
  - No new near-miss is a short-of-pin gap.
- **Coincident faces:** 0 flagged pairs, except 212's pre-existing finger/wheel contact pair (area 4e-5, opposite-facing).
- **Loop seams:** 0 across all 12 IDs checked.
- **Tests:**
  - The movement tests for every intermittent-core ID, plus pin-clutch, small-single-tooth-index and elbow-pawl-baked, pass 131/131.
  - `mujoco-spring-sector` passes 5/5.

## Sub-fork evidence (065, 068, 072, 078, 076)

### 065

**Finding (p101 audit, low).** C's locking notch had a small hooked lip at the top of one flank and a rounded bump beside it. The stop's toe was a knife-sharp point.

**Change.** Files: `src/simulation/tappet-stud-stop-contact.js`, `src/simulation/tappet-stud-stop.js`, and the regenerated `src/data/tappet-stud-stop-outline.js`.
- **Rounded toe.** The toe is now a round end of radius 0.04. Its centre sits 0.04 outside C's rim, so at rest the toe arc rests on the rim. Tangent lines join it to Brown's toe base.
- **Clean V notch.** C's notch is now a single V: two straight flanks and one root arc. It is the convex hull of the toe disc (radius plus 0.004 relief) along the toe's path while the passing stud thrusts the stop. The old notch was the exact trace of the toe point, which produced the lip and the bump.
- **Stop motion, per Brown's text.** "The end between studs is thrust out, and the other extremity enters the notch … the lever is again forced up … held by periphery of C." The motion is new and runs in four stages:
  - **Entry.** The stud drives the stop, as before, down to its deepest thrust (the knee, −0.2236 rad). The toe runs 0.004 clear of the leading flank.
  - **Rest.** The stop then stays at that angle.
  - **Lift.** The notch's trailing flank lifts the toe; this is a cam contact.
  - **Seat.** The flank's corner seats the toe back on the rim 0.019 rad of C after the index ends.
- **Continuity.** The stop angle is continuous, with a largest step of 1.5e-4 rad per 1e-4 rad of C. It rises monotonically after the knee. The stud clearance is ≥ −4e-7, which is the same as before.
- **Stop outline trim.** The generator now keeps every notch vertex when it trims the stop. Before, subsampled chords cut across the concave notch and gouged the toe. Brown's toe point sits just inside the toe arc, which avoids a polygon-clipping degeneracy and a spur at the toe's lower left.

**Captures** (`/dev/shm/p101/f2/lows1/`):
- `m65_after.png`: default view; yaw ±50°; notch zoom; eight index phases.
- `m65z.png`: toe zooms at rest, mid-index and oblique.
- Before: `/dev/shm/p101/r001/zD/m65.png` and `z65stop5.png`.

**Tests.**
- `tests/tappet-stud-stop.test.mjs` passes 7/7. Two tests were updated:
  - The contact-normal test now checks each drive stage. In the stud stage, the stud does positive work on the stop and the toe clears the leading flank. In the flank stage, C does positive work on the stop and the stop clears the passing stud. It requires all three stages. The massless stop carries no load, so only the tappet transmits D's torque.
  - The toe test now requires a rounded arc of at least 0.04 in place of a toe-point vertex.
- `tests/models.test.mjs`: 163/163.
- `node scripts/check-loop-seams.mjs --ids=65,68`: 0 seams.
- Screens for 65:
  - `screen-disconnected-parts`: 0 detached, 0 slivers, 0 lips, and 4 near-misses. All four are the unchanged layout: bore clearances, disk gaps, and the driven disk against the stop.
  - `screen-coincident-faces`: 0.

**Residuals.**
- The toe's right side meets the stop's top edge in a small relieved step. This is the 0.006 running relief where C sweeps past, as before.
- The notch is wider at the rim than Brown's.
- The stop is kinematically prescribed and has no weight.

**Proposed ledger row.**
- assessment: reasonable
- visibleFlaws: (none)
- limits (append): "p101: C's notch is one V (straight flanks and a root arc: the hull of the 0.04-radius toe along its stud-driven path, 0.004 relief). The stop follows the stud to its deepest point, rests, then is lifted by the notch's trailing flank and seated on the rim 0.019 rad after the index (Brown's text). The stop is massless and kinematic."

### 068

**Finding (p101 audit, low).** Tooth A's flanks and the notches beside it in B's rim were hand-traced S-wobbles, and A's tip was a knife point.

**Change.**
- **New generator: `scripts/generate-single-tooth-ideal-profile.mjs`.** It is derived from `generate-single-tooth-rounded-profile.mjs`, with the same C wheel, the same forward-only quasistatic projection with C corners, and the same entry-event bisection. It regenerated `src/data/single-tooth-index-profile.js` with `--tip-radius=0.07 --taper=15` (defaults: notch radius 0.1, floor 1.13, wall lean 20°, tooth angle 0.43°).
- **Tooth A.** A is now symmetric about its centre line. It has a round tip of radius 0.07, with the crest kept at Brown's 1.417, and straight flanks that converge 15° towards the tip.
- **Notches.** Each flank runs tangent into a notch with a circular floor (radius 0.1, deepest at 1.13). The notch's outer wall is a straight line, leaning 20° from the radial, out to the rim. The two notches are mirror images.
- **C unchanged.** C's ten slots and concave locking arcs are unchanged.
- **Sweep.** Tip radius 0.045–0.06 with a taper of 12° or less jams: the tooth meets the slot before the relief releases C's lock corner. Every case with tip radius 0.06–0.075 and taper 12–22° closes the cycle.
- **Result.** The cycle closure is −1.79e-7, as before. Contact starts at 1.49× speed (was 1.14×), peaks at 1.964× (was below 1.96×), and eases into the rim lock by t = 1.29. The lock seat is unchanged.

**Captures** (`/dev/shm/p101/f2/lows1/`):
- `m68_after.png`: default view; yaw ±50°; eight index phases.
- `m68z.png`: tooth zoom after, alongside the before capture `/dev/shm/p101/r001/zD/z68b.png`.

**Tests.**
- `tests/single-tooth-index.test.mjs` passes 7/7. Three changes:
  - A new check that the tooth and notches mirror about A's centre line (under 2e-3, point to polyline), with tip radius 0.06–0.08.
  - The contact-start speed band is now 1.4–1.6.
  - The peak band is now 1.9–2.0.
- `tests/models.test.mjs`: 163/163.
- Loop seams: 0.
- Screens for 68: disconnected 0 (no near-misses, slivers or lips); coincident 0.

**Residuals.**
- The notches are somewhat larger and rounder than Brown's small nicks. They must clear C's lock corners.
- The tooth is wider than the trace, to carry the 0.07 tip.
- The entry at 1.49× is an idealized impact.

**Proposed ledger row.**
- assessment: reasonable
- visibleFlaws: (none)
- limits (append): "p101: tooth A is ideal and symmetric: a 0.07 round tip and straight flanks converging 15°, running tangent into two mirror notches (circular floors of radius 0.1 at 1.13, straight walls leaning 20°). The motion was re-solved with the same quasistatic contact projection: one notch per turn, closure −1.8e-7, contact starting at 1.49× and peaking at 1.96×."

### 072

- **Finding (p101 low):** cam B's four wipers ended in knife-sharp points, and the hammer nose slid off each point.
- **Change:**
  - Each tip is now a fillet of radius 0.06 × the tip radius (0.036). It is tangent to the circular flank and to the radial drop face (`tiltHammerTipFillet` in `src/simulation/tilt-hammer-motion.js`; the outline comes from `tiltHammerCamRing` in `src/simulation/tilt-hammer.js`).
  - A plain fillet on the 57° corner would cut the lift by 18%. To keep it, the drop face stands 0.0794 rad further round (`tipFaceTurn`), where the continued flank is higher. The solver chose that angle so the crest lift equals the sharp tip's exactly: q −0.0051098.
  - `scripts/round-tilt-hammer-wiper-tips.mjs` (new, re-runnable) re-solves the arc/tip handoff, crest and force release on the rounded tip. It then rebuilds the RK4 gravity fall with the same step, to the unchanged rest q = 0.08.
    - The release lies on the fillet, 0.81 rad before the drop face.
    - The events are now flankEnd 0.980, crest 1.126, release 1.319 and landing 1.460. Landing velocity is 0.701, against 0.726 before; the fall has 1131 knots.
  - The entry, the flank, the striker seat and the flat landing are unchanged.
- **Tests:** `tests/tilt-hammer.test.mjs` passes 9/9.
  - The cam-gap check now measures against the runtime rounded outline, sampled at 2048 flank and 4096 fillet steps.
  - The peak-speed bound is now 0.69–0.71.
  - New asserts cover the tip radius and the preserved crest.
- **Screens:**
  - Loop seams (72, 78): 0.
  - Coincident faces: 0.
  - Disconnected parts: the one floating cam/hub/shaft group was already there in the audit screen. It is the presentation-removed cam post, as documented.
- **Captures:** `72-m.png` (default, three cam zooms, yaw +50, ph .45). The earlier sharp tips are in `/dev/shm/p101/r001/zD/m72.png`.
- **Not re-run:** `scripts/check-tilt-hammer-runtime.mjs` and the record/export scripts need the missing `artifacts/review/072-*` checkpoints, which are historical.

### 078

- **Finding (p101 low):** lever B pinched into a neck and swelled into a bulb just outboard of the right pawl pin. Both pawls hung on bare grey pins across a 0.19 gap (pawl front face z 0.165, lever back face z 0.355).
- **Change** (`src/simulation/pull-pawl-geometry.js`):
  - Lever B is now one extrusion of circles joined by tangent lines:
    - the left end, concentric with the left pawl pin (36 px);
    - the right eye, concentric with its pin (42 px);
    - the hand lever, a straight taper from that eye to a round end (24.5 px, Brown's bar width there) with no neck or bulb.
    - The bores are unchanged.
  - Each pawl pin carries a lever-coloured distance collar from the lever's back face to the pawl eye (z 0.166–0.355, the pawl eye's own radius, 24/28 px).
    - The collars belong to the prescribed lever family, so the pawl masses used by the baked dynamics are unchanged.
    - The part count goes from 23 to 25.
- **Tests:** `tests/pull-pawl.test.mjs` passes 7/7 (only the part count was updated). Seams 0, coincident faces 0 and detached parts 0. The 8 near-miss pairs are running clearances.
- **Captures:** before `78b-m.png`, after `78a-m.png` (default, lever zoom, yaw +50, rear oblique zoom, top, ph .6).

### 076 sweep

User item: make the kinked struck arm straight, and perhaps a little longer on the right so it takes stud D more cleanly.

**Result: not changed.** I made a real attempt, and a straight arm cannot work with Brown's pivots. `src/simulation/jointed-tappet.js` and `src/data/jointed-tappet-profile.js` are byte-identical to before (git diff is empty).

**Geometry.** Pivot C sits at radius 1.772 from the common axis, at a direction of −3.8°. With the arm straight (collinear with C→B), Brown's drawn tappet points 21° above that radius at the plate pose, and 48° above it at rest (restQ 0.48).
- A stud on a concentric orbit can only catch the arm if the orbit cuts the arm's reach. Pushing the arm down toward the radius then makes its tip reach further out, so the stud cannot slip off the end. It has to drive the arm through the radius to the mirror angle.
- Lengthening the arm does not change this, because the tip reach is greatest along the radius whatever the length.
- The current bell crank (the arm bent 0.48 rad at C) exists so that the struck arm rests near the radius while B still rests low enough to drop clear on the return.

**Sweep.** I used the production contact dynamics (`scripts/lib/jointed-tappet-076-dynamics.mjs`, dt 1.25e-4, one 6 s strike, the same load and damping as the bake). The script and results are in `sweep.mjs`, `sweep1.txt` and `sweep2.txt` in this directory.
- Parameters: straight arm length 0.43–0.85 (the current arm is 0.425), restQ 0.1–0.48, and stud overlap 0.01–0.10, 44 cases in all.
- Every case overtravels: A is thrown 1.46–1.58 teeth (baseline 1.16), and the tappet swings 0.9–2.1 rad (baseline 1.02).
- No case returns to rest:
  - With an arm of 0.43, B stays folded on a tooth back (α −0.72 to −0.91), so the next strike would lose the count.
  - With an arm of 0.46 or more, the longer arm outweighs B's side. The tappet falls the wrong way (q −0.43 to −1.59) and never resets.
  - Cases of 0.70 or more also leave A 0.01–0.04 tooth off its seat.
- Overlaps of 0.02 or less at restQ ≥ 0.4, and 0.01 at restQ 0.3, jam at the stud (contact projection infeasible at about 0.7–0.8 s).
- The baseline (kink 0.48) reproduces: one tooth, q back to 0.48, α 0, click seated.

**Would work only with changes the rules bar:** an undrawn counterweight or return spring, moving Brown's C or D, or a non-concentric stud path.

**Residual:** the struck arm keeps its 0.48 rad bend at C, which the ledger already documents. The engagement near the tip corner (overlap 0.05) stays as it is.
