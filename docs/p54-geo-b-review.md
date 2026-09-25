# Pass 54, lane p54-geo-b: construction and geometry fixes

Scope: 277, 309, 314, 318, 341, 352, 353, 366, 381, 382, 386, 391, 400, 451,
472, 493, 498 and 501, from the pass-54 audit (`/dev/shm/audit54/c` and `d`).
Every change was checked in browser captures from the default view and several
rotated views and phases (`/dev/shm/t5`, port 44415). Intersections were
screened one ID at a time with
`scripts/show-body-intersections.mjs ID --spacing=0.01 --samples=129`.

| ID | Change | Intersections (0.01, 129 poses) |
|---|---|---|
| 277 | Added a minimal lock plate behind the hammer, made of narrow straps. It joins three mounts: the tumbler arbor, spring c's block and the mainspring root block. The arbor now runs from the plate's bore through the hammer and ends in a plain steel face just in front of the hammer, so it no longer reads as a black hole. Spring c's block now reaches back to the plate, and the mainspring clamp sits on it. | clear, before and after |
| 309 | Removed the floating pendulum suspension eye (the pendulum is not drawn). Brown's small circle between the arbors C is now the end of a fixed suspension stud. The stud runs back to the same rear plane as the pallet arbors. | clear |
| 314 | The banking pins now run back into a small banking bridge behind the lever tail. An arm joins the bridge to the lever bearing. | clear (the fork-tine meshes are open, as before) |
| 318 | The wire grid is now a solid silvered sector plate standing on the movement plate, behind the balance rim, as Brown draws it. The arcs and divisions are shallow dark lines on its face. | only the existing spring-to-collet seat (0.009) |
| 341 | The left crankshaft end now stands 0.02 proud of the crank face, which removes the z-fighting. It still clears the rod plane. | clear |
| 352 | The legs and the arched head share one square section. The head is one extrusion that includes the top 0.5 of each leg, so there are no gaps and no change of section. | only the existing seated hanger/groove contact (0.0145) |
| 353 | The hammer's striking face is dressed through the strike point, square to the anvil at the impact angle. It now lands flat. | the face rests on the anvil at 0.0000; nothing sinks in |
| 366 | Removed the clipping plane and the flat section faces. Both bevel wheels are whole. | clear |
| 381 | Removed the plan-view display copy, so there is one clamp. The camera is now an oblique from above the throat end (fov 20), so both the end section and the plan read. | only cheek/wedge sliding contact (0.0000) |
| 382 | The glass now faces away from the stand, with a back board behind it. Brown's raised rounded plate is on the back, and a short neck in the frame colour carries it to the hinge. That neck replaces the black strut. The socket set screw is turned 0.5 rad toward the front. The frame's lowest clearance to the screw rose from 0.025 to 0.27. | clear |
| 386 | Solid plugs now close each side piece's pole bore. The outer end is flush. The end that meets the opposite piece's complement has its plug set 0.09 below the face, so the passing complement and the rounds clear it. | clear (an earlier flush plug hit the complement by 0.006) |
| 391 | Spring d is a solid coil (tube mesh), not a one-pixel line. It runs in front of C, clear of the rest stop. The top bar carrying C's pivot, the stop and spring d's anchor is kept out of the removed frame. A web joins it to the outer face of the right guide b casting. The anchor and C's stud are lengthened to reach the spring plane. | the spring's end legs sit on the studs (hook seats, 0.017 and 0.018) |
| 400 | The return spring now sits inside fork A, as Brown draws it. It is compressed between A's new left cross-leg and a fixed stop between the rails, and pushes A back. It used to hang off the end, attached to nothing. | clear (the spring tube is open) |
| 451 | Re-routed the side outlet curve that `force-pump-working-parts.js` builds, so its centreline radius is at least 0.327 against a pipe radius of 0.24. The inner-bend sliver is gone. | fluid overlaps only |
| 472 | The inner edge of the S-arm's opening is kept about 33 px inside the outer edge, down to the foot. At y 760 it used to cross the outer edge and cut the casting in two. The air channel now stops inside the arm. | solid clear; air display (fluid) only |
| 493 | The stone is a squared block of the same extent, not Brown's ragged break-line outline. | only seated contacts (0.0000) |
| 498 | The ivory scale board is back, behind the tube plane, and the marks sit on its face. Two brass bands round the open leg, each with a strap, carry the board. From behind, only the board shows. | clear |
| 501 | A narrow ivory board carries the inch marks. A band round the long leg, with a strap, holds it. | clear |

## Remaining limits

- 277: the lock plate is undrawn by Brown. It is kept to straps, but in the
  default view some of it shows between the hammer neck and spring c's block,
  and below the mainspring.
- 309: Brown omits the frame. The pallet arbors, the wheel arbor and the new
  suspension stud all end at a common rear plane with no bearings drawn.
- 314: the banking bridge's arm is undrawn. When the lever banks, a thin grey
  strip of it shows beside the tail.
- 318: the scale plate stands on the paper-coloured movement plate, which is
  still nearly invisible against the page. No SLOW/FAST lettering is modelled.
- 353: to land flat, the face slopes about 15 degrees more than Brown's
  raised-pose sketch in the default view.
- 381: Brown gives two orthographic figures. The single model's oblique
  default view shows both at once, but it is not either figure.
- 382: the neck from the hinge to the back plate is still an undrawn member,
  now in the frame's colour and running behind Brown's plate. The glass shows
  only from behind the stand.
- 391: the rest of the fixed frame stays removed. The guides b and their
  stubs are as before. The link and C's swing are unchanged.
- 400: the fixed stop's own support is undrawn, like the rest of the frame.
  `springExtension` in the state now means compression.
- 498 and 501: the bands and straps that hold the boards are undrawn by
  Brown, and are kept minimal. 501's tenth marks remain dense.
