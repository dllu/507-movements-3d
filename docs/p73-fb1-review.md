# Pass 73, lane fb1: 450, 451, 452, 455, 456, 466

Reviewer: Claude (lane p73-fb1), against `public/engravings/mm_NNN.png` and the
pass-73 audit findings. Captures are outside Git in `/dev/shm/p73-fb1/`:
`before/` and `final/` (default view at phases 0, 0.25, 0.5, 0.75; tiles
`final/t-NNN.jpg`), `final-rv/` (render beside the plate plus the oblique view),
and `a45x/`, `a466/`, `a456z.jpg`, `a455.jpg`, `a452.jpg` (rotated and zoomed views).

## 450, 451: force pumps (handle on a swing link)

**How it works.** The solid piston rises and the suction check opens: water
fills the barrel. The piston descends, suction shuts and the delivery check
opens. In 450 the water goes up the riser. In 451 it goes into the air chamber.
Brown pins the handle straight to the rod top. The handle's left end rides on a
swing link, and 450 pins the foot of that link in a lug on the barrel. The
caption of 451 calls it the "same as above".

**What was wrong.** The handle turned about a fixed boss carried by a capsule
bracket that ended in the barrel's cut rim, so it connected to nothing. A short
slider link, which Brown does not draw, joined the handle to the rod.

**What changed.**
- The kinematics are new (`swingLinkHandleState` in `authored-force-pumps.js`):
  - The rod pin stays on the barrel axis.
  - The handle end E sits one rod-pin radius behind it.
  - |E − lug pin| equals the link length exactly.
  - Velocity and acceleration are analytic.
- The rod offset grows by the removed link's length, so the piston travel is
  unchanged.
- The geometry is new (`force-pump-working-parts.js`):
  - The handle is a flat bar with bored bosses.
  - The rod top carries a clevis with a crosshead and two bored cheeks.
  - The swing link is a bored plate: straight in 450, bowed outward in 451 as
    drawn.
  - A lug grows from the barrel wall, and pins pass through bores.
  - The slider link and joint pin are removed.

**Fluids.** Unchanged: the checks, water volumes and air law are as validated
in pass 69.

**Fresh captures.** `final/t-450.jpg`, `final/t-451.jpg`, and `a45x.jpg`
(−60°, back, and +60° zoom on the lug, link and clevis).

**Tests.** `force-pump-working-solids`: clearances for the link, lug, pins,
clevis and handle over 65 poses. `movement-450` and `movement-451`: exact
closure of the swing link and handle, and the rendered link endpoints.

**Residual.** Brown does not draw the 451 link's lower pin. It is inferred from
450 ("same as above").

## 452: double-acting pump

**What was wrong.**
- Pale rectangles showed in the cylinder water. They were shadow-map light
  leaking past the gland notch and rod bore onto the white rear section face,
  seen through the water. Disabling shadows confirmed the cause.
- At the bottom of the stroke the rod top stood only 0.1 above the gland.

**What changed.**
- The rear face no longer receives shadows.
- Stroke amplitude went from 1.05 to 0.90 and rod length from 3.70 to 3.85.
  The top of the stroke is unchanged, so the framing is unchanged. The rod now
  stands 0.40 clear of the gland at the bottom of the stroke.

**Fresh captures.** `a452.jpg` and `final/t-452.jpg`.

## 455: old rotary pump

**What was wrong.** The paper-white rear web read as the case behind a hollow
ring. The 0.4-long shaft ended just behind a cover only 0.012 thick, so from
behind it read as an empty black hole.

**What changed.**
- The rear web is now in the rotor's colour and takes no shadows, so the drum
  reads as closed. Brown leaves the drum face plain.
- The rear cover is 0.06 thick and carries a fixed bearing boss.
- The shaft runs from the web through the cover and boss and ends beyond them,
  with the shared quadrant cue.

**Fresh captures.** `a455.jpg` (default, +60°, back).

**Residual.** The default view now shows an orange web inside the drum, where
Brown's interior is blank paper.

## 456: Cary's rotary pump

**What was wrong.** The harmonic-flank cam looked like a near-round egg. The
rollers hid under the yoke bar. An ink outline loop was drawn on the cam face.

**What changed.**
- The follower law (`rotary-pump-contact.js`) now has heart-cam uniform-rise
  flanks: Archimedean spirals entered through 12% cycloidal ramps. The dwell
  at E and the constant width through the axle are kept.
- The cam now shows a notch at E and a rounded point opposite.
- The roller radius went from 0.11 to 0.13 (the drum slot half-width is 0.14).
  The yoke bar was narrowed from 0.15 to 0.10, so both rollers now show on the
  cam rim.
- The outline loop was removed.

**Fresh captures.** `a456z.jpg` and `final/t-456.jpg`.

**Tests.** The finite-difference velocity tolerance in `movement-456` rose from
3e-10 to 1e-9 (round-off limited at step 1e-6 on the steeper flanks). The other
tests pass unchanged.

**Residual.** The notch is shallow, because the sealing dwell at E rounds it.

## 466: hydrostatic press

The factory was rebuilt on the plate: `authored-hydrostatic-presses.js`, with
px mapped uniformly to model units. It no longer uses `hydraulic-force-parts.js`,
and its entry in `CUTAWAY_SPECS` was removed.

**How it works.**
- On the upstroke the plunger draws water through the rose, suction pipe and
  foot check.
- On the downstroke it forces water past the check in the valve chest, down the
  riser, along the small pipe and under the hollow ram.
- Twelve strokes lift the ram. The ideal Pascal law applies, with the plate's
  4:1 diameter ratio (16:1 force).
- The lever is pinned through the plunger's crosshead, which has a mortise. The
  lever's fulcrum rides a swing link from Brown's T lug.
- The ball weight sits on the spindle of a dead-weight safety valve on the
  chest. Lifting it lets the ram down: water leaves through a rear discharge
  into the cistern, and the cistern level falls and recovers by exactly the
  water held under the ram.

**Section.** As Brown sections them, these are back halves with cut faces: the
ram cylinder, the hollow ram, the barrel with its stuffing box, suction chamber,
pipe and rose, the valve chest, and the cistern. The frame, dome, bowl, platen,
bales, plunger, crosshead, lever, link and valve are whole.

**Bales (user report).** There are four bales, as drawn. They stand on the
platen, on each other and against the head plate. They compress between platen
and head as the ram rises and recover on let-down.

**Water.**
- The press water is a lathe of the bore minus the moving ram. It grows by
  exactly A_ram × lift (to within 0.5%, from faceting).
- The barrel water follows the plunger tip.
- The channels, pipe and suction side stand full.
- The cistern level is conserved.

**Fresh captures.** `final-rv/466-default.png`, `a466p.jpg` (pumping, hold,
let-down), and `a466v.jpg` (zooms and ±60°, top and back views).

**Residuals.**
- Brown's thin line from the lever end to the ball is not modelled; its
  function is unclear.
- The chest passages and check positions are inferred.
- The fluted bowl is smooth.
- The column sockets in the flanges are not cored.
- The default pose shows the lever near the top of its stroke, where Brown's
  slopes down.

## Checks run

- Loop seams (`scripts/check-loop-seams.mjs --ids=450,451,452,455,456,466`):
  0 seams above tolerance, 0 pops.
- Faces: 452 and 456 clean. The remaining flags are:
  - degenerate axis triangles of lathes;
  - small internal coplanar contacts (inside the 450/451 clevis, and the 466
    chest against the barrel, area ≤ 0.0014);
  - the pre-existing 450 piston self-contact and the 455 recess-water
    degeneracies.
- Intersections: see the lane report.
