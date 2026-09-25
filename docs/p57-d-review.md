# Pass 57 lane p57-d review (387–498)

Scope: the pass-57 rotated-view findings in `/dev/shm/audit57/d/findings.json` for 387, 393,
394, 400, 401, 403, 405, 406, 415, 424, 427, 428, 433, 448–451, 456, 458, 459, 477, 483, 490
and 498. 382 was skipped as instructed. Reviewer: Claude Opus 5.5 (lane p57-d), 2026-09-25.
Nothing was committed.

Method: each ID was captured in the production loader (`async-engine` + `model-loader`)
from a freshly restarted, non-watching vite server on port 44474. Each capture set is the
audit's six views: (a) default phase 0, (b) default phase 0.5, (c) rotated +60°, (d) rotated
−110°, (e) top/behind, (f) tilted. Zooms were added where needed. The tiles are
`/dev/shm/n57d/after/T<ID>.jpg`, and the "before" state is the audit tiles
`/dev/shm/audit57/d/T<ID>.jpg`. Intersection screens used
`scripts/screen-body-intersections.mjs --worker=ID --spacing=0.01 --samples=129`, one at a
time. `fluid` (water) and `deforming` (rope/cord) rows are not listed.

New shared helper: `src/simulation/drawing-board-parts.js` (`addDrawingBoard`), used by 403,
405 and 406. It builds a plain paper-coloured board whose top face is the drawing plane.
The pins stand in blind bores, and the board is solid below them, so nothing shows through
from behind.

## Per movement

| ID | Change | Capture showing the fix | Screen (after) | Proposed ledger text |
|---|---|---|---|---|
| 387 | The pontoon slab and round keel are replaced by an open boat hull. It is a shell with superellipse sections, pointed ends and a sheer that rises to the bow (the stern stays low under the swinging stringers). A thwart spans the boat, and the end-frame posts run down onto it. | T387 a, b, d, e | clear | Brown's small open boat carries the floating end frame on a thwart. Residual: the hull is beamy (about 2.4 × 2.55) so that it can hold both posts. |
| 393 | The shaft-bearing arm now runs back past the lens and the cup's sweep to a plain pillar on the table's rear edge. | T393 c, d, f | clear | Upright shaft bearing carried by a pillar on the table. Limit: the pillar shows at the back in rotated views. |
| 394 | Added a back bar behind the rack. It has a bored boss for the pinion shaft's rear end, a forward bracket with a guide slotted for the rod's ±0.10 transverse shift, and a pillar with a foot. The bar is added after the camera fit. | T394 a, c, d, f | clear (guide was first 0.039/0.035 against collar/rack; narrowed to x 4.67–4.89) | Pinion shaft and input rod carried on a back bar. Limit: the pillar and foot show below the rack. |
| 400 | Added a back bar behind carrier A's rails, two C-guides round the rear rail (open toward the fork), a strap carrying the spring stop, a pillar with a foot, and two bored camshaft pedestals on feet. | T400 a, c, d, f | clear (0.0035 rail/guide fixed by 0.008 clearance) | Carrier A slides in guides; the camshaft runs in pedestals; the spring stop is fixed. Limit: the pedestals and pillar show below the cam in the side elevation. |
| 401 | Added a standard that cradles the faceplate shaft bearing and a pedestal that cradles the treadle fulcrum bearing. Both are behind the moving parts and stand on feet on a floor below the treadle's sweep. They are added after the camera fit. | T401 a, d, e | clear | Both bearings carried on standards. Limit: the standard shows under the wheel. |
| 403 | Drawing board under the arc and pins. The pins are run into blind bores, and the washers seat on the board. | T403 c, d, e | only pre-existing pin/rule-crossing (0.0086) and intended pencil/arc contact (0.0078) | Arc and pins on a drawing board. |
| 405 | Drawing board (top = drawing plane at −0.17) with blind bores for both focus collars. | T405 c, d, e | clear | Both branches traced on a board; the focus pins stand in it. Limit: the board fills the default view. |
| 406 | Drawing board at the pencil point (−0.26). The trace is a thin stroke lying on it (z scale 0.3). The straightedge and the square's stock now reach the board. The focus axle stands in a blind bore, with the collar seated on the board. The white directrix edge stripe is hidden. | T406 c, d, e | pre-existing cord attachment rows (axle × blade cord 0.058, known since pass 49); the pencil tip/trace contact is 0.011 (intended) | Parabola, pins, straightedge and square carried on a board. Limit: the square's blade still rides 0.87 above the board, carried by its stock. |
| 415 | The slack pawl cords are now a circular sag arc of exactly the cord's material length. Before, they were two straight runs meeting at a corner. | T415 a, b (zoom) | unchanged: pawl eye coaxial 0.01 (pre-existing) | The cords sag smoothly from crank E to the pawls. |
| 424 | Ports: the dark slabs are hidden. A's side walls now have through-slots closed outside by steam chests, and B's top and bottom walls (moving with B) are slotted. A is deepened to z −0.41…0.80, so B no longer stands proud. The translucent back is replaced by an opaque back cover. Shaft b runs into a bored boss on a front arm from A's top wall. | T424 a, c, d, e | crank arm × shaft coaxial 0.24 (the crank is fast on its shaft, pre-existing) | Ports are slots through the walls; the casing is closed behind; shaft b is carried by a front arm. Limit: the arm crosses C in the default view (Brown's section removes the front head). |
| 427 | Back head inside the casing, flush with its rear face and bored for shaft B. Shaft B is extended into a blind bearing boss on the head. | T427 d, e | clear | Casing closed behind; shaft in a rear bearing. |
| 428 | Same as 427: back head, bored, with a blind boss. Shaft B extended. | T428 d, e | clear | Casing closed behind; shaft in a rear bearing. |
| 433 | The spill sheet no longer runs through the floats: it starts below them (y −0.13) and falls. The jet sheet ends above the floats' upper edges (y 0.53). | T433 d, f and zooms | only `fluid` jet/float rows | The jet stops at the floats; spent water falls from beneath them. |
| 448 | Bucket body, bucket seat and check, foot seat and foot check are cut on the barrel's section plane. The side spout is a whole pipe in the barrel colour, not a cut trough. | T448 c, d, e | clear (seat/check seated 0) | Moving parts cut with the barrel. |
| 449 | Same as 448, plus the delivery flap, its seat, hinge and lug. The front flap journal (which would float in front of the cut) is hidden. | T449 c, d, e | clear | Moving parts cut with the barrel. |
| 450 | Piston, suction check and outlet check, and both seats, are added to the cutaway spec. | T450 c, d, e | lever pivot × delivery pipe coaxial 0.0099 (pre-existing) | Moving parts cut with the barrel. |
| 451 | Same as 450 (piston, suction and delivery checks and seats). | T451 c, d, e | clear | Moving parts cut with the barrel. |
| 456 | The ring's through-notches are replaced by port holes in the wall's middle layer only (`portedCasingGeometry`). Pipe F now reaches into the wall. Added a back head: a rim recessed round the drum spider, a plate bored for axle A, and a blind boss. | T456 a, d, e, zooms | clear (cam/piston rollers seated 0) | Casing closed behind with whole ring joints. |
| 458 | Brown's shelf on the left post: a board through a notch round the post, on a bracket. | T458 a | clear | Shelf on the left post. |
| 459 | Added a crank lug (behind the arm's plane) and a crank pin to the tappet. The worm-step arm now ends on the pin's surface. Earlier variants cut the arm through the eye (0.044–0.082). | T459 zooms (z1–z3) | 0.0071 worm × star wheels (pre-existing) | Worm step carried by an arm pinned to the tappet. |
| 477 | The sealed liquid fills valve D's whole cavity (inner profile inset 0.006), clipped with the section. | T477 a, b, c | only `fluid` rows (see note) | The liquid fills the hollow valve. |
| 483 | Branch pipes rerouted (radius 0.11, centripetal curve) behind and outside the bellows end plates, with an elbow fitting and a stub into the plate bore. Nothing now pokes through the side panels. The zigzag wire is replaced by a coil spring hooked on a crosshead stud and the rocker pin, with its geometry updated in place. | T483 a, c, d and zoom | see note | Pipes inside the case; over-centre coil spring on real attachments. |
| 490 | Pale deck under the whole gear, below the handles' sweep. The posts, pedestals and feet are carried down to it, and the rudder stock runs through a bore in it. | T490 a, c, d, e | see note | Steering gear stands on a deck. Limit: the deck is a large pale backdrop in the plan view. |
| 498 | The boiler shell is closed by a far head and stands on two saddle standards (beyond the crop) with feet at the gauge floor level. | T498 d, e | see note | Boiler closed and supported beyond the crop. |

Screens for 477, 483, 490 and 498 (the "see note" cells):

- 477: clear. Only the pre-existing diaphragm-seat coaxial rows remain (≤ 0.001).
- 483: the rerouted branches are clear. The first reroute grazed B's skirts at the port
  (0.059), so each branch now starts vertically inside the port ring. What remains is the
  valve-work rows in parts not touched here (crosshead × outlet 0.064, stem × rocker 0.060,
  and so on; pass 49 already recorded 0.062). The coil spring passes the valve stem near
  its rocker-pin hook (a `deforming` row of 0.059).
- 490: clear (0.02/65 screen; the 0.01/129 run crashed the worker). Only a rope/clamp
  `deforming` row remains.
- 498: clear.

## Tests

These all pass: movement-387 (updated: the boat hull and thwart roles replace the pontoon
role), 393, 394, 400, 401, 403, 405, 406, 415, 424, 427, 428, 433, 448–451, 456, 458, 459,
477, 483, 490 and 498. Also passing:

- drawing-template-working-solids, ejector-trap, four-motion-feed, gas-meter (the coil
  geometry is retained in place), hyperbola-finite-cord, mercury-instrument, one-way-clutch,
  piston-engine, polishing-interfaces, reversing-transmission (both), rope-steering-performance,
  rotary-engine-427-429, rotary-pump-455-456, steering-spatial, turbine-433-435,
  well-bucket, well-scoop-gutter, lift-pump, force-pump and source-presentation.
- movement-392, 404, 416, 419, 421, 436, 452–455, 476, 497 and 499; reviewed-cycle-timing;
  coupling-clearance; authored-loader; and models "all movements aim for two seconds".

## Display profiles to re-measure

387, 393, 394, 400, 401, 403, 405, 406, 424, 456, 458, 490 and 498.
