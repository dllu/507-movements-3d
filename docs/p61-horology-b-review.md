# Pass 61, lane p61-horology-b: horology 297–321 (excluding 288–296)

Reviewer: Claude Opus 5.5 (lane p61-horology-b), 2026-09-26. The user's
standing rules for this pass are in the lane brief: parts are flat extruded 2D
outlines built from the plate's intended geometry, with no pins, depth offsets
or backing pieces added just to make the animation work. Kinematics must
suit the drawn shapes, and tooth slant and rotation must match the plate.
Spoked-wheel webs are left to lane p61-spokes, which owns
`src/simulation/spoked-wheel.js`.

Captures were taken from a freshly restarted, non-watching dev server on port
44534 (`/dev/shm/h4/cap.mjs`): the default view beside the plate, four phases,
±60° rotations and an oblique view. The final tiles are in
`/dev/shm/h4/final/t<ID>.png`, the before tiles in `/dev/shm/h4/before/`, and
the close-ups in `/dev/shm/h4/after/`. The intersection screens used
`scripts/show-body-intersections.mjs ID --spacing=0.01 --samples=129`.

## Changes

### 298: geared balance with wire-loop pallets (rebuilt)
- **Pallets:** the flat helical "screw" bands are replaced by two round-wire
  loops (tube radius 0.035). The top of each loop wraps over the arbor and
  sinks 0.012 into it, so the loop is soldered on and no longer floats. The
  lower working arc of each loop is a short opposite-handed helix
  (0.22/rad along the arbor). From the release end, the wire bends straight
  up, away from the escaping tooth.
- **Contact law:** the law is numeric. It is the signed distance from the
  wire centreline to the tooth's leading face and tip corner, solved by golden
  section and bisection. It is tabulated per loop as a natural cubic spline of
  the arbor angle, so playback is smooth. Each wire runs 0.005 above its
  nominal tip corner, so the corner meets the lower half of the wire and the
  wire lifts clear on release.
- **Direction:** the wheel now only turns counter-clockwise. Each tooth lands
  as the arbor reverses, when the catching loop is at its farthest point, so
  there is no recoil. The drop is a monotone speed profile, (1−u)²·(quadratic),
  and the minimum wheel speed is 0. There are 26 teeth, counted from the plate
  (previously 20). Each tooth has a radial leading face and a straight back,
  leaning counter-clockwise as drawn. The four lens crossings are true vesicas
  made from two circular arcs each.
- **Evidence:** the rendered tube clears the wheel mesh by at least 0.0015 at
  2000 phases (`/dev/shm/h4/clr298.mjs`). The intersection screen is clear.
  Close-ups are in `/dev/shm/h4/after/t298z.png`.
- **Residuals:** the loop tops sit level with the rod top, where Brown draws
  them about 0.3 higher, because loops that high would not be attached. The
  three-spoke balance C web belongs to the spokes lane.

### 300/301: Debaufre, one shared model
- Presentation differences are removed. The spacer drum is now the same in
  both views, the lobed boss and yoke arc are front-only no more, and the
  side-only emissive hack is gone. The model now only differs by camera and
  display-clock offset. A test compares every mesh (role, vertex count,
  colour, emissive) between 300 and 301.
- Each wheel has four spokes, 90° apart, on a round boss. Brown cuts off the
  upper two. This is an interim box-spoke build: lane p61-spokes should swap
  it for `spoked-wheel.js`.
- The white witness sphere and wheel witness strip are deleted from the
  model, and their `remove` entries are dropped. A moderate wheel self-glow,
  shared by both views, keeps the edge-on 301 strips from reading as a
  patchwork.
- The baked pallet bands are unaffected because the tooth geometry is
  unchanged. Both intersection screens are clear.

### 304: Le Paute A/B pins
- The A pins keep Brown's half-round D outline.
- The B pins are now Brown's trapezoid. It is inscribed in the A outline, with
  the full-diameter trailing base, chord flanks, and a short leading side that
  is exactly the working arc. The pallets therefore work both forms unchanged.
- Both forms are brass, so they read against the wheel.
- The intersection screen is clear.

### 306: smoother opening
- The lower-left sweep is a quarter-ellipse Bézier from the side step to the
  flat bottom edge. Its point-reflection is the top-right lobe. The upper-left
  lobe is a centripetal spline through the traced knots.
- The new curves lie outside the old polyline, so they only widen the hole.
- The screen shows only working contact (0.0000).

### 309: Mudge gravity escapement (rebuilt)
- **Pallets:** each pallet is one flat plate in the wheel's plane. It is
  Brown's broad arm, measured on the left pallet and mirrored in its outer
  edge, at the plate's 0.22 width. The left end has lifting face B on the arm
  end and locking notch b. The right end has lifting block A on the inner edge
  and hook a at the end. Each plate carries a threaded stem square to the arm
  edge with the ball weight on it.
- **Removed parts:** the separate front arm layer, the black lift pads and the
  white nibs at other depths are gone. Only the half-forks to P and Q stand in
  front of the wheel, on the same arbor C.
- **Working faces:** the offline swept-cut bake
  (`scripts/generate-gravity-escapement-plates.mjs 309`) trims the plates to
  the exact tooth envelopes with a 0.006 running clearance.
- **Kinematics fix:** with a whole pitch per beat, a fallen pallet's stop
  landed inside the next tooth. The stations are now at 135° and 45°, which
  are Brown's b and a notches, 7.5 pitches apart. The wheel steps half a pitch
  per beat, so the stop always falls over a tooth space. Pickup and unlock
  angles are now 1.5° and 2.1°.
- **Frame and pendulum:** the pendulum stays presented away, as Brown omits
  it, and there is no frame. The screen and
  `gravity-escapement-working-solids` are clear.
- **Residuals:** the wheel web belongs to the spokes lane. The lifting face on
  the left arm makes a 33° wedge corner where Brown draws about 56°.

### Others reviewed and fixed
- **297:** arm A and its pallets are one flat plate, Brown's tapered arm with
  the B and C outlines. B and C are straight bars that stand back from the
  plate to the pin ends. The two bridge beams and the axial "mount" pins are
  removed. The baked contact is unchanged because the bars' XY shapes are
  unchanged. The screen is clear.
- **313:** the decorative sine bows are removed from the detent spring and the
  detent body, so detent D is straight as drawn. The screen and tests are
  clear.

## Verdict table

| ID | Checked for | Verdict | Action |
|----|-------------|---------|--------|
| 297 | outlines, hidden pins, slant | Tree-like arm with bridges and mount pins | Fixed: one flat arm plate. Residual: pin ends still protrude in front of the disc so B/C can work them; the arm is drawn solid where Brown dashes it |
| 298 | user items | Screw-like, disconnected pallets; wheel recoiled | Fixed (rebuilt) |
| 299 | outlines, slant, motion | Hooked, concave-backed crown teeth match the plate; motion smooth | No change |
| 300 | user items | Two-spoke wheels; separate presentation | Fixed; spoke web pending the spokes lane |
| 301 | user items | Same | Fixed (shared model) |
| 302 | all | Currently throws `crownWheel.userData.body` undefined after the spokes lane's crown-wheel change | Not my edit; flagged to the coordinator |
| 303 | outlines | Anchor and slim teeth read like the plate | No change (wheel web: spokes lane) |
| 304 | user item | B pin was a sliver | Fixed |
| 305 | all | Good (earlier fixes hold) | No change |
| 306 | user item | Polyline lobes | Fixed |
| 307 | all | Long legs, slot and D/E stops as drawn | No change |
| 308 | all | Star wheel, lever Q and click C as drawn | No change |
| 309 | user item | Narrow bars plus pads and nibs at other depths | Rebuilt |
| 310 | pins and protrusions | The lifting and beat pins are Brown's parts | No change |
| 311 | same | Same | No change |
| 312 | same | Fork pins E and F as drawn | No change |
| 313 | outlines | Wavy detent | Fixed (straight) |
| 314 | outlines, protrusions | Layered construction: a nib pushed back into the wheel plane, a post from pallet C to the roller, and a grey front cock that reads as an undrawn stand | Not rebuilt this pass. The lever pivot sits inside the balance disc's outline, so a rear support needs a rebore. Wheel chamfers: spokes lane |
| 315 | all | Hanger, rod, bob and crank as drawn | No change |
| 316 | all | Jar pendulum | No change |
| 317 | all | Compound bar | No change |
| 318 | supports | Back bar and cock follow the support convention; the scale is drawn | No change |
| 319 | all | Compensation balance | No change |
| 320 | faceted shading | The sector shading is the deliberate quadrant rotation cue (`rotation-indicators.js`), not facets | No change |
| 321 | all (quick look) | Going barrel reads like the plate | No change |

The sector shading on 314's balance and 320's pulleys is the quadrant cue.

A numeric jerk screen (`/dev/shm/h4/jerk.mjs`) flags only the escapement
impacts (drops and locks) and no position discontinuities. 298's wheel no
longer stops and reverses.

## Tests

These pass:
- `movement-297`, `lantern-pallet-contact` (rewritten: no mount pins; the bars
  reach into the one-piece arm), `lantern-working-solids`,
  `lantern-stop-233-contact`
- `movement-298` (rewritten for wire loops, the numeric contact and no recoil)
- `movement-300` (four spokes 90° apart) and `movement-301` (one-model mesh
  signature)
- `debaufre-300-301-working-solids`
- `movement-304` (trapezoid B), `annular-stud-working-solids`,
  `stud-pallet-contact`
- `movement-306`, `three-leg-dead-rest`, `pin-escapement-working-solids`,
  `movement-307`
- `movement-309` (half-pitch beat, one-plane plates),
  `gravity-escapement-working-solids`
- `movement-313`, `free-escapement-solids`, `chronometer-return-contact`,
  `detached-chronometer-working`
- `source-presentation`, restricted to my IDs. The full run fails at 288,
  which belongs to the other lane.

`movement-302` and `verge-crown-working-solids` (302) fail on the spokes
lane's crown-wheel change. This lane did not touch that code.

## Display profiles to re-measure

298, 300, 301 and 309 (geometry changed), and 297.
