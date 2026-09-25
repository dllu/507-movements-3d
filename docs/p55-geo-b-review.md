# Pass 55, lane p55-geo-b: supports, shapes and notation fixes

Scope: 382, 383, 389, 392, 396, 397, 403, 404, 409, 411, 414, 416, 418, 419,
420, 422, 429, 431, 432, 435, 439, 441, 447, 461, 468, 485, 493, 498 and 501,
from the pass-55 audit (`/dev/shm/audit55/d/findings.json` and its tiles). This
lane touched only its own aspects of IDs shared with other lanes:

- 389 and 418: supports only. The cutaway lane owns their sections.
- 420: the bell support only. The ends lane owns the rope.
- 435, 439 and 461: shape, bail and rims only. The water lane owns the water.

Every change was checked in browser captures (port 44435, scratch
`/dev/shm/l5`): the default view at phases 0 and 0.5, rotated views at +60 and
-110 degrees, a view from above and behind, and a tilted oblique, each tiled
beside the plate. Intersections were screened one ID at a time with
`scripts/show-body-intersections.mjs ID --spacing=0.01 --samples=129`. For 439
and 441 the screen ran out of memory at that density, so they used
`--spacing=0.02 --samples=65`. In the table, "clear" means no solid pairs.
Fluid pairs are not listed.

| ID | Change | Intersections after |
|---|---|---|
| 382 | The frame back is now Brown's: a broad rim round a recessed rounded pocket, with a raised vertical bar down the pocket that has a rounded lower end. The hinge lug is cast on the bar. The frame stands 0.28 closer to the hinge, so the neck is 0.47 long instead of 0.85. It still clears the collar and the screw over the whole adjustment envelope. | clear |
| 383 | Added the matching side frame at the other end of the rolls: an arch with its feet, the three bored crossbars and the bearings. Every shaft now runs in a bearing at both ends. | clear |
| 389 | The rear spine and bridges that carry the eccentric-shaft and stop-pawl bearings are no longer removed. The spine now stops at the rear guide cheek instead of hanging below it. They stay behind the rack and pawls. | tooth/pawl 0.0000 (working contact) |
| 392 | The spring's anchor is now clamped by a stud to a plain bracket arm behind the leaf. The arm is carried by the right-hand rear standard, which rises to the spring line. | clear |
| 396 | Added one plain diametral arm that carries balance rim B on its staff. It lies in the rim's plane, behind the escape wheel, and the wheel staff stands outside the rim. | 0.0709 roller pin/fork prong (existing); nothing new |
| 397 | Added a short ground sill with a lug under the rocker pivot (Brown's grounded boss). One slim rear standard carries the crank bearing, and above it a short channel guide for the shuttle bar. The guide sits where the bar overlaps it at every point of its 4.7-unit stroke. Its lower lip stays clear of the slider pin's path. | clear |
| 403 | Removed the laid-out chord and versed-sine lines and the white pin caps. The brace fasteners are dark instead of white. | not rescreened (removals and a colour change only) |
| 404 | The greatest bend is now the plate's shallow arc: sagitta 0.92 on a 2.70 half span, ratio 0.34, down from 1.34 (ratio 0.50). The least bend is 0.50. At full bend the ends leave the rollers at about 37 degrees instead of 53. The bar still passes under both rollers at every phase, and the overhang stays 0.61 to 0.70 beyond the contact. | 0.055 roller axle in its standard (both fixed, not touched this pass); bar/pad 0.0000 |
| 409 | Brown's graduation ticks on the blue leg are removed (source-presentation). | not rescreened (removal only) |
| 411 | The ruled grid on the recording drum is removed (source-presentation). The drum is plain paper. | not rescreened (removal only) |
| 414 | The face web of wheel A grows from radius 2.235 to 2.36. In oblique views the raised scroll teeth no longer overhang the wheel edge. | 0.0001 pinion/shaft (working contact); the 219/224/414 contact report was rerun: 0 inside, 0 penetration |
| 416 | Spring A is now Brown's helical spring. A wire coil (9 turns) runs between an eye on the fixed stud A and an eye on crank pin B. Its centre line is rebuilt every frame, so the coils open and close with the eye distance while the wire stays round. The force law is unchanged. The frame is no longer removed: a slab, two slim wheel standards, a treadle-pivot pedestal and the spring stud's standard now carry everything. | only the welded coil-leg seats on the eyes (0.0095 and 0.0090) |
| 418 | The valve seat is now the floor of the valve chest, in frame colour. A back wall and two end walls, cut on the casing's section plane, join it to the chest cover, so it no longer floats. | clear |
| 419 | The slim grounded rear standard that carries the A and B axles is no longer removed. It stays behind the discs and clear of the rocking frame. | only the intended band seats (0.108) |
| 420 | The bell's post and overhead arm are no longer removed. The post now stands on its own foot plate beyond the plank. | bell parts clear; the existing spring seats (0.103 and 0.092) are unchanged |
| 422 | The casing is one clean half-section. The vase casing is now full depth (z -0.40 to 0.64) with a solid back cover, so the sector chamber is closed behind and cut only on its front plane. The valve chest has a back cover too. The valve seat is plain and sits inside the chest cavity. Its faces no longer coincide with the chest's side faces, which caused the black comb strip. | seat/valve 0.0000 (sliding contact) |
| 429 | The casing is one piece. Its back cover is the whole oval with its necks, so both bores and the port channels are closed behind. The necks read as cut channels, not pairs of plates. The fixed piston shafts now run back into that cover. The black packing strips painted on the lobe faces are removed. | clear; the Holly mating audit was rerun and is unchanged (1025 poses, 0 penetration) |
| 431 | The two bearing pedestals are no longer removed. The front one stands on a new footing beside the race bed. | 0.2197 hub, spoke and shaft (the hub is fixed on the shaft; the screen puts the shaft with the fixed bearings) |
| 432 | The two bearing pedestals are no longer removed. | fluid only |
| 435 | No change by this lane. The pale disc in the runner centre is gone in the current tree after concurrent water-lane work (see the note below). | — |
| 439 | Added an iron bail from two ears on the bucket up to the rope's end. The rope is tied 0.30 above the kinematic attachment point. The bail's plane is turned 50 degrees, so the falling stream clears the wire. | rope seats on the bail (0.012) and on the counterweight eye (0.040) |
| 441 | The inclined bearing standards, the front and rear hollow-shaft bearings and the stream bed are no longer removed. The rim is a wooden hoop in the wheel colour (0.10 by 0.10), not a thin black ring. | fluid only |
| 447 | The anchor now lies on the river bed and is shaped like Brown's: a shank, a crown, two curved arms with flukes, and a stock. The line rises 0.90 from the anchor ring to the bow. The plan radius is still exactly 2.92 and the true rope length is sqrt(2.92² + 0.90²). The lower hull narrows from the gunwale outline to a bottom 0.62 as wide, with an upright stern at the rudder notch. The boat now has flared sides and a fine bow, not a flat lozenge. | rope seats in the swivels (0.0000) only |
| 461 | The gutter channel walls use the gutter timber colour (a shade darker), not black. | not rescreened (material only) |
| 468 | The X-in-box section marks on the tie ends are removed (source-presentation). | not rescreened (removal only) |
| 485 | The lattice sail frames and stocks use a timber tone, not black. The cap's curb ring is in the cap colour. | not rescreened (material only) |
| 493 | The bore liners (bottom and walls) use the stone's material. Their faces coincide with the stone's hole and cut face, and in different colours those shared faces flickered into dashes along the hole edges. | not rescreened (material only) |
| 498 | Removed the brass bands and straps. The scale board is now a deeper board behind the open leg, with a round groove in which the glass lies. The marks stay on its front face beside the tube. | fluid only |
| 501 | The same grooved board behind the long leg carries the inch marks. The band and strap are gone. | fluid only |

## Reconstruction choices and remaining limits

- 382: a 0.47 neck still joins the hinge to the back bar. Brown's perspective
  hides any such depth. Because of the default yaw, the bar reads just left of
  the hinge, not just right of it as in the plate.
- 383: the matching near-side frame is undrawn by Brown, and its crossbars
  cross the roll ends in the default end view.
- 389: in the default view a thin grey bridge shows behind each pawl pivot.
- 392: the bracket arm and riser are undrawn. The default camera is slightly
  above the leaf, so the arm reads as an L below the spring.
- 396: Brown draws no arm. The watch plate and the bosses behind it are still
  removed, so the staffs' rear bearings are unsupported.
- 397: the sill, standard and channel guide are undrawn. The long guide rails
  and bed remain removed.
- 404: the maximum shape is a true circle (a tapered spring bar) and the
  minimum a parabola, interpolated. This is not an elastic beam solution.
- 409 and 411: Brown engraves the graduations and the ruled paper. They are
  omitted under the "no ticks or marks" rule.
- 414: the translucent back plate is replaced by the correction module's
  spiral strip. The three web arms still show in front of the face web.
- 416: Brown's circle at A may be the coil seen end-on. The coil now runs
  along the A-to-B line, which matches the linear spring law. It has no guide
  rod, so at the short end compression it would buckle. The slab and standards
  change the default framing.
- 418: the chest body is inferred. The small dark steam-port stub below the
  seat remains.
- 420: the post and arm are undrawn. The camera fit now includes them, so the
  bell reads slightly smaller.
- 422: the chest and casing are cut at the front plane, so no front cover is
  shown anywhere. That is the intended half-section.
- 429: the shafts still stand forward of the casing face as fixed stubs, with
  no front cover.
- 431 and 432: the pedestals are undrawn by Brown. The front pedestal crosses
  the lower wheel in the side elevation.
- 435: this lane did not change 435. At the current tree the centre shows the
  open discharge (background through the foundation's hole). The water lane
  should confirm that this is their change.
- 441: the inclined standard crosses the lower wheel in the front view. The
  trip pin and its post are still removed, so the tipping pin is not shown.
- 447: the anchor is seen through the translucent river. Current force, sag
  and buoyancy are still prescribed.
- 468: the bolt heads (small dark discs on the log tops) remain. They stand
  for bolts Brown draws as holes.

## Tests

The following passed:

- `tests/movement-<ID>.test.mjs` for all 29 IDs.
- `cock-ferry-working-solids`, `groove-drive-working-solids`,
  `jack-389-contact`, `mercury-instrument-working-solids`,
  `reciprocating-cord-working-solids`, `persian-bucket-trip`,
  `reed-396-working-parts`, `textile-planer-working-parts`,
  `variable-face-gear-solids` (after rerunning
  `review-variable-face-contact.mjs` and
  `save-variable-face-contact-report.mjs`), `rotary-engine-427-429-solids`,
  `holly-mating-profile` (after rerunning `export-holly-contact.mjs` and
  `review-holly-contact.py`), `valve-family-solids`,
  `water-lifting-441-443-solids`, `water-wheel-430-432-solids`,
  `well-scoop-gutter-solids`, `wind-rotor-working-interfaces`,
  `spring-pivot-family-solids`, `steam-engine-working-solids`,
  `water-mechanism-439-440-444-solids`, `pendulum-instrument-solids`,
  `mujoco-persian-drill`, `source-presentation`, `adjustment-contact-solids`,
  `movement-191` and `reviewed-cycle-timing`.

Test edits, each for a deliberate change:

- `movement-404`: thresholds scaled to the shallower bend.
- `movement-416` and `spring-pivot-family-solids`: the helical spring's roles
  and shape.
- `movement-447`: the rope rises to the bow. The plan radius and the 3D rope
  length are each checked exactly.
