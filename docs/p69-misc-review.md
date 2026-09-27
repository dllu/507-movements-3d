# Pass 69, lane p69-misc: user review fixes for 393, 395, 399, 400, 419 and 420

Reviewer: Claude Opus 5.5, lane p69-misc. Captures are in /dev/shm/p69-misc (not in Git):
`before/`, `after/` and `final/` (production route via `scripts/review-movement-source-views.mjs`).

## 393: lens polisher, lower support flush
- User: "The lower support isn't flush."
- Before, the diagonal brace was a box cut square across its own axis. One corner pushed into the leg and the plank,
  and the other hung clear of them. The leg and brace also stood 0.2 behind the plank's front edge.
- Now the brace is an extruded parallelogram. Its foot is cut vertically against the leg's inner face and its head
  horizontally against the plank's underside. The leg and brace faces are flush with the plank's front edge.
  File: `src/simulation/authored-lens-polishers.js`.
- Evidence: `after/393-t.png` (default, +60 degrees, top), `final/393-default.png`.
- Intersections, 0.01/129: 3 bodies, no overlapping pairs.

## 395: four-way cock shown as one view
- User: show one view, because the animation already shows both orientations.
- The second plate figure (housing, plug and pipes) is removed. The single plug turns through both of Brown's
  positions, a quarter turn apart. The camera fit is centred on the one figure.
- Files: `authored-four-way-cocks.js` and `four-way-cock-parts.js` (second-figure roles dropped). The 395 note in
  `source-presentation.js` is updated.
- Evidence: `after/395-t.png` (phases 0, 0.25, 0.5, plus rotated and oblique views).
- Intersections: 2 bodies, none.

## 399: chain repair link closed and connected
- User: "chain slightly disconnected / missing faces".
- Causes:
  - The U-bars were open TubeGeometry with no end caps, so the hollow ends showed.
  - The swivel-nut cage was an ellipse with its end bars cut away, so the rods passed through gaps.
  - Thin dark bore and thread tubes showed as black rims.
- Fixes:
  - The bars are capped, closed solids.
  - Each nut is Brown's oblong closed loop: rounded-rectangle side bars plus two end-bar blocks bored along the axis,
    abutting flush. One end is bored for the swivel journal and the other is bored and threaded.
  - The journal and screw threads are in the bar's own colour. The female thread is brass.
  - The dark captive-bore tube is removed.
- Kinematics are unchanged in form (pitch x turns law, equal engagement). Dimensions changed:
  - loose separation 2.5
  - screw length 0.98
  - arch 0.75/1.65
  - female-thread phase re-derived from the new offsets
- Evidence: `after/399-t.png`, `after/399-z.png`, `final/399-default.png`.
- Intersections: 4 bodies, none. The pass-49 0.0174 thread-bore overlap is gone. The face scan is clean.

## 400: four-motion feed shading
- The cam's front extension shared each station's corner vertices across its front face, rim, back and bore, so
  computeVertexNormals rounded every edge.
- Fix: `creaseIndexedNormals(frontGeometry)` is applied after the contact triangles are read.
- Worst vertex-to-face normal deviation is now 19.8 degrees. The flat face and rim show a crisp edge.
- Evidence: `/dev/shm/p69-misc/cmp400.png` (before and after).
- The radial body's bumpy D outline is the intended single-lobe cam shape, not shading.
- Intersections: none (the spring is an open tube).

## 419: plain wheels with crank pins
- Removed:
  - the quadrant cues (`rotationIndicator: false`)
  - the dark hubs
  - both crank arms
- The axle stubs now meet each wheel's back face, so the faces are plain. Each wheel carries only its crank pin. The
  bored rod rides at z = 0.76, just in front of both faces, on pins that run from the face to z = 0.87.
- Evidence: `after/419-t.png`.
- Intersections: none solid. The 0.108 band-seating overlap is unchanged and intended.

## 420: the hand pulls, the hammer falls, the spring lifts
- New schedule (4 s cycle):
  1. Rest at 38 degrees on the preloaded spring.
  2. The hand descends from 0.30 s to 1.40 s. It first takes up slack, then the taut cord fixes the lever angle
     (bisection on |tail tip - grip| = cord length). The head rises to 62 degrees, and the lever lifts off the spring
     at its free length (42.5 degrees).
  3. Release at 1.55 s. The hammer falls with constant angular acceleration and reaches the lip exactly at 1.89 s.
  4. After impact, a critically shaped damped rebound driven by the compressed spring returns it to rest.
- During the fall the hand relaxes upward just ahead of the tail. The cord is never stretched (max 1e-15) and is
  taut only while pulling (0.51 s to 1.55 s). Otherwise it hangs as a same-length catenary with 0.03 slack.
- The hand stands 0.30 left of the tail, so the slack sags beside the chord.
- Evidence: `after/420-rope.png` (rest, pulled, falling, rebound), `after/420-t.png`.
- Intersections, all intended: spring seats and segment overlaps (known), cord tie-in at the tail, cord in fist.
- Loop seams (all six IDs): 0 above tolerance, no pops.
