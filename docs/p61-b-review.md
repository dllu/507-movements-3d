# Pass 61, lane b: 281, 282, 284

Captures are in `/dev/shm/h2` (outside Git). Each fix was checked beside the plate, from rotated views and in motion strips, using a freshly restarted non-watching dev server.

## 281: grooved disk and vibrating lever

- **What the plate shows:** the groove is on the disk's front face. The dotted arm behind the hub is a crank arm keyed on the shaft (the hand crank that turns the disk). The dashed lever is the lever's other extreme pose.
- **Change:** removed the pass-59 see-through treatment (`makeSeeThrough`), so the disk is opaque. The rear arm is now a plain crank arm seated on the disk's back face. It carries a round rearward handle (`rear-hand-crank-handle`, r 0.075, 0.36 long).
- **Supports moved back:** the base, A-frame braces, rear bearing and upper fulcrum brace move back 0.30 so the handle clears them over the whole turn. The disk shaft and fulcrum pin are lengthened to reach them.
- **Source presentation:** the note is updated.
- **Captures:** `281a.png` shows the default view and three rotated views. The disk is opaque, and the crank arm and handle are visible from behind.
- **Intersections:** 0.01/129 screen, no solid pairs.

## 282: slotted lever, rack and weight

- **Rear crank, same treatment as 281:** Brown dashes an arm from the axle to the rim behind the disk. It is modelled as a plain crank arm keyed around the hub against the disk's back face, with a short rearward handle (0.18).
- **Frame changes for the handle:**
  - Brown's lower rails are at raster y 370 and 400. The model's rail at y −0.86 moves to −1.21 (y 370), outside the handle's sweep.
  - The disk-bearing stays and the bearing move behind the posts (z −0.64).
- **Rack trimmed:** teeth are now cut only where the sector can reach them. That is within two pitches of the pitch point at some point in the stroke, computed from the sampled rack travel. This gives 7 teeth (offsets −3.5 to +2.5 pitches), which matches Brown's seven. `geometry.rackToothOffsets` is added.
- **Captures:** `282a.png` shows 7 rack teeth in the default view and the rear crank from behind.
- **Intersections:** solids clear. Only the intended seated cord contacts remain (deforming).

## 284: saw-carriage feed (rebuilt)

**Caption:** the crank turns and rocks the horizontal arm of the bell crank about a. The catch on the vertical arm moves the ratchet, the pinion on its shaft drives the carriage rack, and a screw varies the feed.

**Plate analysis:**
- On the ratchet, the plate's r(θ) jumps up abruptly and falls gradually as θ increases. So each tooth's steep radial face faces clockwise.
- The click at the upper left therefore blocks clockwise turning.
- The catch's claw sits at about 3 o'clock under a tooth face. Pulling the catch toward its hinge (up and to the left) turns the wheel anticlockwise.

### Geometry

Every part is one extrusion in its drawn plane. Outlines are built as the intended curves, with tracing used only to measure:
- **Catch stem:** a single circular arc, centre (54.2, 375.3) px and R 209.5 px. It fits the plate's traced centreline within 0.5 px.
- **Scroll and bead:** the stem runs into a clothoid scroll (curvature ramps from −1/R to 0.135/px over 91.7 px, fitted to the curl) that ends in a round bead. Width tapers along the arc length.
- **Claw:** a symmetric point aimed left into the teeth. See the deviation list below for its upper edge.
- **Click:** an eye plus a finger bounded by two circular arcs.
- **Ratchet:** 44 teeth, counted on the plate: tips at 107 px, roots at 100.5 px, radial faces. It uses the shared `spoked-wheel.js` builder: 4 spokes, hub arc 26 px, rim inside 87 px, with spokes at 45° in Brown's pose.
- **Pinion and rack:** 8-tooth pinion and 24 px rack pitch. The rack bar ends square at x 27 and 490.
- **Carriage:** whole, ending just beyond Brown's break lines.
- **Bell crank:** one plate combining the arm, eye, and slotted screw frame. It carries the feed screw's eye head, the threaded rod and the nut slider.
- **Crank and rod:** a tapered crank arm (tangent hull of the two bosses) and a rod with an eye at each end.

**Layering:** posts and carriage are behind; then rack and pinion; then the shaft hanger; then the ratchet, catch and click in one plane.

**Supports (least intrusive):**
- The left post is behind the carriage and the right post is under it.
- A bracket from the left post carries fulcrum a.
- A flat hanger carries the ratchet shaft. It runs between pinion and ratchet down to a foot block on the left post, and the foot block is also the carriage's left way.
- A bearing plate on the right post carries the crank shaft.

### Motion (contact-solved, `solveFeed`)

- **Crank:** the crank turns clockwise with a 2.4 s period, and the four-bar solve gives the bell-crank angle.
- **Catch and click:**
  - Both fall under gravity onto the teeth. They are held off by an exact contact solve on the real outlines: circle/segment crossing angles, vertex-edge both ways, entering crossings only.
  - The catch drives only when seated in a pocket.
  - The wheel's clockwise limit is where the click actually stands, from a contact solve that rotates the wheel against the click.
- **Result:**
  - The wheel advances exactly one tooth anticlockwise per crank turn. It overtravels about 0.05 pitch and settles back onto the click as the catch returns, held by the carriage load.
  - The click rides up the tooth backs and drops into each pocket; it never lifts on a return.
  - The carriage feeds to the left, 0.54 units over 8 strokes.
- **Gig-back (9th turn):** the sawyer lifts catch and click, runs the carriage back, and lowers both onto the teeth. The load then settles the wheel clockwise until the click catches its pocket.
- **Seamless loop:** the gig-back ends in exactly the state the loop starts from (difference below 1e-15). The loop is 21.6 s.
- **Rack travel:** the rack stays in mesh at all times, with its end at least 5 teeth past the pinion.
- **Timing:** display time 0 is Brown's pose (horizontal arm) in the third stroke. The solve runs once per page load (about 0.8 s in Node) and is cached.

**Deviations (recorded):**
- **Feed-screw setting (hinge moved down):** Brown's hinge position (65 px below a) gives the catch only 1.16 pitches of travel. The catch could not pass the next tooth tip on the return. The screw setting nearest the drawing that feeds one tooth with a clear drop is 81.4 px, which is inside the drawn slot. So the catch hangs 16 px lower than drawn.
- **Claw upper edge (flattened):** Brown's claw upper edge slopes up into the stem, which would strike the tooth above before seating. The claw's upper edge is therefore level, forming a throat under the stem, so the point reaches the pocket corner.
- **Gig-back:** this is the sawyer's action and Brown does not describe it. It is needed to close the loop without the carriage running away.

**Removed:**
- `saw-feed-working-parts.js`, the baked holding path, its generator and its test.
- The old undrawn parts: index markers, box spokes, and the curved-tube pawl that pushed.

**Captures:**

| File | Shows |
|---|---|
| `after/284-default.png` | Beside the plate |
| `284rot.png` | Rotated views, including two gig-back poses |
| `284zs.png` | Zoomed 12-frame stroke strip: claw seated under a face, pulling up |

**Intersections:** 0.01/129 screen. The worst depths are 0.0004 (catch × ratchet) and 0.0001 (click × ratchet), both seated contact. Pin/eye pairs are coaxial with depth 0.

## Tests

| File | Result |
|---|---|
| `tests/movement-284.test.mjs` | Rewritten: 7 pass |
| `tests/movement-282.test.mjs` | Rack count 12 → 7: 8 pass |
| `tests/see-through-part.test.mjs` | 281 now has no see-through parts: 9 pass |
| `tests/cam-281-286-solids.test.mjs` | 5 pass |
| `tests/movement-281.test.mjs` | 9 pass |
| `tests/rack-output-solids.test.mjs` | 2 pass |
| `tests/rotation-indicator.test.mjs` | 5 pass |

`tests/source-presentation.test.mjs` fails on 288 (another lane's entry), not on these IDs.
