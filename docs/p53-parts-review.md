# Pass 53 · p53-parts lane (63, 277, 305)

Captures: default, oblique, yaw −60°, yaw 35°, side (yaw 90°) and top views at
several phases, from a private non-watching server; all inspected beside the
plates. Intersections: `show-body-intersections.mjs ID --spacing=0.01 --samples=129`.

## 063 snap-action star counter

- Removed the undrawn leg zone (fragment-discard shader following the pawl) and
  the dashed hidden outline of the drop's leg (`makeHiddenInkLine`). In rotated
  views they cut the pawl and drop off. The drop is now one whole solid plate.
- Pawl redrawn as one plate with Brown's simple smooth outline: ring, broad
  arm with a gently falling upper edge under the striker (the dip is gone),
  a straight inner edge to a pointed nose, and one smooth curve back over the
  shoulder. The separate stepped nose block and its notched tip are gone.
- The one-piece pawl spans z −0.22…0.04 (pins end at −0.12, star starts at
  −0.09), so its nose works in the star's plane. The planar solver now checks
  the whole pawl outline against the star (`noseAt = pawlAt`). Rebaked:
  fingerprint e4c43a18, advance −35.96° (one point), repeat error 0.0039,
  maximum drop lift 20.2°.
- While the pawl hangs lowest a narrow strip of the drop's leg shows between
  the lobe and the disk; it is the real part, not hidden.
- Intersections: clear before, clear after (5 bodies, no pairs).

## 277 Colt cylinder ratchet

- Spring c widened when it bent because its extruded caps were triangulated
  into long triangles that spanned the bend. Both springs are now finely
  stationed ribbons with round ends, so every cross-section moves rigidly
  (edge lengths keep their rest values within 0.01; test added).
- Added Brown's linkage at the right: a stirrup link pinned in the hammer at
  his open circle (raster 385,425) and running behind the hammer to an eye pin
  (438,323), and the mainspring leaf from that eye pin down to the right along
  his two lever lines. The leaf continues past Brown's crop (2.3 long) to a
  small fixed root block (undrawn, needed to anchor it). Its tip bend is solved
  per hammer angle so the rigid link keeps its length; cocking draws the eye
  down about 0.7 and bends the leaf about 26° at the tip.
- The whole cylinder is modelled: 4.4 long, running off Brown's left crop, with
  a finished front face, six blind chambers and a solid breech. Removed the
  dark edge-ring tori, the dark longitudinal strips and the hammer's black
  outline loop (rim/marker parts Brown does not draw).
- Intersections: clear before; after, 6 bodies, no pairs, no open meshes.
- Remaining: the dog's hook still works about 0.86 below Brown's tip and the
  ratchet teeth are shallow (unchanged working constraint). The default view
  shows the mainspring's root block to the right of Brown's crop because the
  frame covers the cocked hammer's sweep.

## 305 Macdowall single-pin escapement

- The pendulum is one plate: eye, rod, bottle and foot traced from Brown's
  outline half-widths (the old outline was about 15% too wide at the belly and
  the neck), with the escapement opening cut directly to Brown's two D windows
  (upper-left and lower-right, 80 × 50 px, rounded outer corners). The round
  hole, the two jagged filler pallets, their stand-offs, the separate eye ring
  and neck are gone.
- The opening's own edges are the pallets: the upper-right solid's lower edge
  and the lower-left solid's upper edge are the dead faces, concentric with the
  pivot where the pin works (|x| ≤ 0.4) and easing level beyond so the windows
  keep Brown's straight edges; the edges at x = ±pin radius are the upright
  impulse faces. The kinematics are unchanged. The existing finite-face impulse
  test runs against the plate itself.
- The disc (radius 0.44) now runs behind the plate and shows through both
  windows as Brown draws it. The pin is set into the arbor end, flush with the
  disc face, and stands forward through the plate. The disc's rim torus, the pin
  carrier cap and the index marks are removed. The pin is now ruby-coloured.
- The lower adjustments are eccentric bushes flush in Brown's two holes, with
  off-centre screw heads as on the plate. They replace the proud gold collars
  with white slots. The suspension pin is shortened to the plate thickness.
- Intersections: before, clear apart from the documented ≈0.0006 release
  corner. After, one plate/pin pair at 0.0000 (the same prescribed release
  corner; the 2D measure is −0.0006). Fixing the plate's outline winding also
  removed a 0.0063 coaxial pivot report.
- Remaining: Brown's pin sits about 22 px from the arbor, but the model keeps
  the historical 1:60 eccentricity (0.075), so the pin is small and close to
  the arbor. The prescribed release/landing still has its sub-millimetre corner
  contact.
