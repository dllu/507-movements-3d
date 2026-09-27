# Pass 74, lane a: user review of 490, 491, 492 and 494

Captures (default, 33 %/66 %/98 % phases, ±60° about vertical, back, top and
side) were taken with a lane-local script on the production route
(`model-loader.js` + `async-engine.js`) before and after the changes, plus the
standard `scripts/review-movement-source-views.mjs` default/oblique pair. All
captures live outside Git under `/dev/shm/p74-a/{before,after,src-before,src-after}`.

## 494 — tongs for lifting stones

User: "494 is disconnected" and "the chain appears very far from the rock's
centre of gravity when viewed from the side".

Before: the curved jaw tubes started 0.29 from the fulcrum, leaving a gap
between each jaw and its eye; the links sat at z ±0.38, the shackle ring, rope
and fixed eye at z 0.62, and the stone body at z −0.48, so the side view showed
the chain about 1.1 in front of the stone's centre.

Changes (`src/simulation/authored-stone-tongs.js`):

- Each tong is now one extruded plate: straight upper arm, bored fulcrum eye,
  bored side-pin eye, curved gripping arm and tapered point in a single
  outline, so arm, eye and curve join without gaps.
- One flat chain: tongs at z ±0.12 (just enough for the crossing), each link
  lies in the plane of the tong it never touches (the opposite rhombus side),
  and the shackle strap and hoist rope hang in the stone's centre plane z 0.
  The stone, its bite sockets and the ground bed are centred on z 0. All pins
  are centred on z 0 and run through every member they join.
- Brown's shackle is a straight strap from the common link pin up to an eye to
  which the rope is seized; the undrawn fixed overhead eye and the ring are
  gone. The rope runs straight on past the top crop (`beyondPlateCrop`).

Evidence: `after/494.png` (all views), `src-after/494-default.png`; side view
shows strap, rope and pins directly over the stone. Intersections (0.01,
129 samples): only the rope seized on the strap's crown at 0.0000 depth.
Faces: clean.

## 490 — ordinary steering apparatus

User: "Rope for 490 needs to be taut."

Before: an equal-slack bow sagged each free span (visible S-curves in the top
and rotated views). Now every free span is a straight, densely sampled line
from the tiller clamp to its guide sheave tangent and from the sheave to the
barrel (`src/simulation/authored-rope-steering.js`). The helm limit is 20°
(was 25°). An ordinary unquadranted tiller lengthens the taut branch sum as the
helm goes over; that excess (0.189, 1.4 %) is taken as rope stretch and
disclosed in `dynamics.historicalSlackDisclosure`.

Evidence: `after/490.png` (top and rotated views show straight spans).
Intersections (0.02 spacing, 33 samples; 0.01/129 runs out of heap): only the
intended seizing of the rope ends inside the tiller clamps (0.0275).
Faces: clean. Loop seams: clean.

## 491 — capstan

User: "The pawl is rotating about an axis perpendicular to what's drawn."

Before: the pawl was a radial arm on the side of the collar turning about a
tangential axis. Brown draws it flat against the front of the lower drum,
swinging in the plane of the drawing on a pin that points at the viewer.

Changes (`authored-capstans.js`, `capstan-finite-parts.js`,
`capstan-pawl-contact.js`, generated `capstan-pawl-profile.js`,
`scripts/generate-capstan-pawl-contact.mjs`):

- The pawl is a curved flat dog (Brown's shape: round boss, bulged back,
  rounded nose) on a radial pin with a head, lying in the tangent plane of the
  lower drum at the front (the plate's pose at t 0), its nose hanging down
  toward the recoil side onto the crown teeth. Its axis is radial at every
  angle; the old side cheeks are gone.
- The lower drum now runs down behind the teeth to just above the deck (the
  plate's rectangular lower part) instead of leaving a dark gap, and the
  undrawn band under the ratchet is removed. The crown ring is narrowed to
  1.15–1.45 so the pawl nose works on it, as in the plate where the ring is
  only a little wider than the drum.
- The contact table is re-baked for the new pawl: for each pivot tooth phase
  the lowest angle at which the whole finite pawl outline (three faces) clears
  the actual crown triangles, plus a 2D check of every convex ratchet edge
  (crests, ramp top edges and ramp diagonals) against the pawl outline, with
  playback-interval lifting so linear interpolation never cuts a crest. The
  nose rolls over each crest and drops in 12.5 % of a tooth.
- Tooth direction unchanged and matches the plate: vertical faces on the left
  of each tooth facing the pawl, ramps falling to the right; recoil drives the
  nose into a face and seats it (hinge moment −0.32, drive moment −1.22).

Evidence: `after/491.png`, `src-after/491-default.png` and the nose phase
strip `after/ph491-*.png`. Intersections (0.02 spacing, 33 samples; 0.01/129
runs out of heap): no body overlaps (only the pre-existing open dome mesh is
listed). Faces: clean (the lower drum's bore was eased to 0.152 and the pin
shank shortened into its head to remove two coincident faces). Loop seams
clean. Contact test: minimum finite pawl/ratchet clearance 0.0004 over 1024
poses per tooth; the working nose stays within 0.002 of the ramp. Because the pawl now swings
in the tangent plane, its nose moves forward while falling and lands about a
third of a tooth up the next ramp rather than in the valley against the face
as drawn (Brown shows the held, recoil-seated pose).

## 492 — boat-detaching hook

User: "seems quite different from the engraving and needs to be reworked."

Rebuilt from the plate and caption (`authored-boat-detachers.js`, new):

- One unit as drawn: a flat waisted standard with top and middle pin bosses,
  a turned collar and a helically threaded shank; the tongue hinged on the top
  pin behind the standard; the bent lever on the middle fulcrum with a broad
  upper arm ending in a rectangular eye, and a long S-curved lower arm to the
  rope eye; the tackle hook in a plane turned 55°, its round bend under the
  tongue, hanging from the lower block (cropped at the top) whose falls run
  straight up past the plate; the release rope seized at the lower eye running
  straight off to the right. Plate positions of the two pins, the eye, the rope
  eye and the hook throat are kept (60 px per unit).
- Kinematics: the tongue's end lies along the chord of the eye's travel about
  the fulcrum, so pulling the rope slides the eye straight off the tongue end
  without bearing on it (the locked load is radial to the lever). The
  liberated tongue swings up; the hook rests on it throughout, its height
  solved as the highest clear position of its bend, shank, bill and neck
  against the tongue and hinge eye, until the tongue leaves the throat at
  −105.9°; the hook then rises free. The demonstration resets in reverse.
- No boat, second unit, pull bar, hand or indices (none drawn).

Evidence: `after/492.png`, `src-after/492-default.png`, `after/ph492-*.png`.
Intersections (0.01, 129 samples): none. Faces: one small tube-shading
finding on the hook bar (0.46 % of its triangles). Loop seams clean.

## Tests

`movement-490`, `rope-steering-performance`, `steering-spatial-solids`,
`reviewed-cycle-timing`, `movement-491`, `capstan-491-finite`,
`movement-492`, `boat-detacher-contact`, `spatial-linkage-solids` (492),
`movement-494`, `lifting-contact-solids` (494). Old tests that pinned the slack
rope, the side-mounted pawl and the two-unit detacher were rewritten for the
new designs.
