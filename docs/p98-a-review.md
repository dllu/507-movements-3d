# Pass 98, lane a: eye centring (122, 125, 198, 334, 363), the 133 crank handle and 209's fork

Source: the programmatic eye-centring audit (/dev/shm/p97/eyes/report.md), plus
the user's note on 133's handle ("still has an annoying kink … make all the
handles have the cylindrical portion be flush with the back side of the
lever"). Each finding was checked against the plate and the audit render
before it was fixed. Scratch captures are in /dev/shm/p98/a.

Metric: the audit's RANSAC end-arc fit (the rounded outline round each pin),
offset of the arc centre from the pin axis as a fraction of the arc radius.
Re-run with /dev/shm/p97/eyes/screen-eyes.mjs on all six movements after the
fixes: no pin in 122, 125, 133, 198, 334 or 363 has an end-arc offset above
1.1% (the residue is the screen's 5-degree bin quantisation).

| id | pin / part | before | after |
|---|---|---|---|
| 125 | upperRightPin / upperLink | 0.38 | 0.011 |
| 125 | lowerRightPin / lowerLink | 0.26 | 0.006 |
| 125 | upperLeftPin, lowerLeftPin | 0.06, 0.04 | 0.008, 0.006 |
| 122 | centerPin / outputBar | 0.043 | 0.004 |
| 198 | upper-right pivot / carrier plate | 0.095 | 0.004 |
| 198 | lower-left pivot / carrier plate | 0.233 | 0.007 |
| 334 | pivot F / half-round seat | 0.72 | 0.000 |
| 363 | fulcrum axle / cheek | 0.37 (report) | 0.008 |

## 125 (src/simulation/mujoco-cascaded-traverse/geometry.js)

The two floating bars were traced Bezier outlines, with the right-hand pins
well inboard of the rounded ends. Each bar is now two end arcs concentric with
its end pins (radius 12.5 source px for the lower bar, 13 for the upper) joined
by symmetric cubic bows that are G1 with the arcs. The sags (lower 3/6 px top
and bottom, upper 7/8 px) follow Brown's slightly lens-shaped bars and keep
the raised centre pins inside with 3 to 4 px of metal. The audit attributed
this to authored-gears-core.js, but production 125 is the baked MuJoCo model,
so the fix is in its geometry module. The link shape changes the bars'
inertia, so 125 was rebaked (see below).

Captures: 125-{before,after}-{default,upper,lower,rot,rot2}.png, 125-cmp.png.

## 122 (src/simulation/mujoco-variable-traverse/geometry.js)

The output bar's eye end was a hand-traced Bezier bulge. It is now a true arc
of radius 25 source px about the centre pin, met by straight tangents from the
existing neck corners (404,169) and (407,209). Rebaked.

Captures: 122-{before,after}-{default,bar,rot,rot2}.png, 122-cmp.png.

## 198 (src/simulation/authored-gears-core.js)

The rack-carrier plate was a Catmull-Rom trace warped by a Gaussian towards
the modelled pivots, which sit 7 to 11 px from Brown's drawn eyes. That left
both lobes off-centre. The outline is now built in source pixels (the carrier
is unrotated in the source pose) from straight edges and circular arcs:
- a lobe of radius 20 px concentric with the upper-right pivot, joined to the
  top edge by an 8 px concave fillet and running tangentially into a straight
  right edge
- a foot of radius 16 px concentric with the lower-left pivot, joined to the
  bottom edge by a 40 px concave sweep and running tangentially into a
  straight left edge
- 38 px and 40 px fillets at the other two corners.

The right edge still lands at Brown's x = 463. The foot is tighter than the
drawn one because the modelled pivot is 11 px left of and 8 px above the drawn
eye. The traced list is kept as `userData.sourceOutline` for reference.

Captures: 198-{before,after}-{default,lobe,foot,rot,lobe-rot}.png,
198-cmp.png, 198-cmp2.png.

## 334 (src/simulation/authored-beam-engine-parallel-motions.js)

Confirmed on the plate: F sits in a round seat standing on the bed. The model
was a half disc centred on the bed line, so F sat near its top. The seat is now
the disc about F (the same 1.6-unit radius) cut off by the bed's top face.
It is still behind the beam (z -0.45 to -0.17, beam from -0.033), so it has
no new contacts. The body-intersection screen is unchanged (only the known
0.0000 backing-roller contact).

Captures: 334-{before,after}-{default,F,Frot,Frot2}.png, 334-cmp.png.

## 363 (src/simulation/authored-seesaws.js)

The cheek top was a half-ellipse (0.25 wide, 0.305 tall) about the axle. It is
now a semicircle of radius 0.25 concentric with the axle. The cheek width,
brace seats (x = +-0.25) and the axle cap are unchanged. Brown draws the pin
a little below the centre of the post's rounded top. The brief's
concentricity rule takes precedence here, and the pin stays where it is
drawn.

Captures: 363-{before,after}-{default,top,toprot,toprot2}.png, 363-cmp.png.

## 133 crank handle (src/simulation/authored-gears-core.js)

Before: the grip cylinder started 0.03 in front of the arm's back face, and
an oversized (1.08 r) ball on its tip made a step. The arm was a box whose
back face would have been coplanar with a flush grip end. After:
- The grip is one closed turned solid (LatheGeometry with creased normals):
  a flat back face flush with the crank arm's back face (z 0.1975), a
  straight cylinder of r 0.085, and a hemispherical end of the same radius.
  There is no step or kink.
- The arm is a flat plate cut round the grip circle, so no faces coincide.
- `crankGripTip` is now an Object3D marker at the centre of the grip's end.
  It marks the traced crank path used by the tests, and the old white ball
  is gone.
No other crank handles exist in the authored-gears-core movements this lane
touched (122 and 125 are MuJoCo modules; 198 has none).

Captures: 133-{before,after}-{default,grip,grip-back,grip-side}.png,
133-after-{back-close,oblique-close}.png, 133-before.png, 133-after-all.png.

## 209: the forked catch now works (src/simulation/authored-gears-core.js, src/simulation/variable-drive-205-209-parts.js)

The user reported: "The forked catch on 209 doesn't seem to be doing anything
and seems to be a wrong geometry. In theory it should engage a pin on the
orange gear."

The caption reads: "The teeth are for making the motion continuous, or it
would cease at the point of contact shown in the figure. The forked catch is
to guide the teeth into proper contact." Brown draws the plate at the dead
point, where the smooth arcs hand over to the teeth. He draws a two-horned
catch on the driven (blue) wheel next to its axis, with its V opening towards
the driver's first teeth. The official page has no animation.

My interpretation: the catch has to take hold of something on the driver as
the pair passes the dead point. That something has to reach the catch's
plane, in front of both wheels, so it is a pin. The old fork was a rigid
decoration: the horn was traced from the plate, and nothing ever entered it.

The fix:
- A round pin (r 0.045) stands on the front face of the driver's second tooth,
  exactly at its pitch point (role `fork-pin-on-entering-driver-tooth`). It
  runs from 0.015 inside the tooth to just past the fork's front face.
- Relative to the driven wheel, a pitch point traces a cusp. It comes in,
  touches the driven pitch curve in a tooth space, and goes out along a
  second branch. The fork's V is cut round exactly that path: the horns are
  tapered bands outside each branch, the mouth is the pin path closed by the
  chord across it, and everything the pin sweeps over a whole cycle is
  removed with 0.012 clearance. A web joins the crotch to the bored boss
  concentric with the driven axis (r 0.27, bore 0.135). The horns' reach
  (0.98 from the axis) gives an engagement window from t = -0.49 s to
  +1.50 s about the source pose, with the V's bottom at t = 0.5 s.
- Result, checked at 8193 poses per cycle: the pin never enters the fork, the
  minimum gap is 0.0115, and throughout the window the pin stays within
  0.012 of a horn wall. It rides in along the lower horn, bottoms in the
  crotch as the teeth take up, and leaves along the upper horn. At the
  default (source) pose the fork matches the plate: horns to the left and
  upward, with the pin entering the mouth.
- The motion is still prescribed by the ideal no-slip ellipse law. The pin's
  load is not simulated (`passiveForkTransmitsPower` stays false). The
  reconstruction note says so.
- 205 and 208 share variable-drive-205-209-parts.js. Their geometry hashes
  are identical before and after (6ec6ce8b621c28ad and 20ef010bf3ccec0a).
- Tests: a new movement-209 test checks that the pin is on the driver rotor,
  that there is one fork piece, that the source pose is inside the window,
  that the pin clears the fork by more than 0.011 at 2049 poses, and that it
  bears within 0.0125 during engagement. The variable-drive note regex was
  updated. The 205-208-209-contact report was regenerated (513/513/167
  poses; the results are unchanged and only the hashes moved). Screens: 0
  detached, 0 slivers, 0 coincident faces, 0 solid intersections, and the
  boss and horn are concentric with the shaft (offset 0).

Captures: 209-before-phases.png, 209-after-phases.png,
209-after-eng.png (8 engagement phases, close-up), 209-after-vs-plate.png,
209-after-rot.png.

## Screens and tests

- screen-disconnected-parts (122, 125, 133, 198, 334, 363): 0 detached,
  0 slivers, 0 lips. No near-miss involves an edited part except the
  existing bore clearances.
- screen-coincident-faces: 0 flagged on 133, 198, 334 and 363. On 122 and
  125, 1 and 2 pairs of about 1e-7 area (rod/link bore clearances, not
  edited faces).
- screen-body-intersections (133, 198, 334, 363): worst solid 0.0000. 133's
  open mesh (the first hemisphere tip) was removed by making the grip one
  closed lathe.
- node --test: mangle-rack-working-contact, movement-198, movement-334,
  movement-363, sector-press-* (sector-press-rod now tests the grip body, not
  the tip marker, for rod clearance) and seesaw-finite-supports: 44/44 pass.
  models.test blocks for 122, 125 and 133: 3/3 pass. bevel-200-226-solids,
  special-worm-solids, irregular-gear-family and variable-drive-205-209-solids:
  22/22 pass.
- Regenerated reports that fingerprint authored-gears-core.js (the same
  pose counts; only the hashes changed): 200-226-bevel-solids (POSES=33),
  202-264-worm-solids (POSES=33) and 191-196-201-contact (513 poses).
- Rebakes (`node scripts/bake-mujoco-movement.mjs 122`, then `125`): 122 has a 116 s loop, 0.0000 px raw seam and a 0.0065 px round trip. 125 has a 1748 s loop (437 periods), 0.0000 px raw seam and a 0.0068 px round trip. mujoco-baked-loops, mujoco-cascaded-traverse and mujoco-variable-traverse: 127/127 pass. models.test blocks for 122, 125 and 133 pass after the final edits.
- Also regenerated for 209: 205-208-209-contact.
