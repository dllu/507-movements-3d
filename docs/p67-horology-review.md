# Pass 67 — horology lane (293, 296, 297, 309)

This pass fixes the user's direct feedback on four escapements. Each fix was checked against
`public/engravings/mm_NNN.png`.

Captures are not in Git. They are in `/dev/shm/p67-horology/`:

- `before/ID-default.png` and `after/ID-default.png`: the render beside the plate. `cmpID.png` shows before above
  after.
- `b/ID-rot.png` (before) and `aID-rot.png` (after): default, ±60° about the vertical, back and top views.
- Phase strips: `a293-ph.png`, `a297-ph.png` and `a309-L.png` / `a309-R.png` (8 phases at each pallet).
- Close views: `a297-zoom.png`, `a309-top.png` (the pivots).

Intersection screens were run one at a time (`--spacing=0.01 --samples=129`). `check-loop-seams --ids=293,296,297,309`
found 0 seams.

## 293 duplex (`authored-plate-escapements.js`)

- **Wheel thickness.** The wheel is now 0.40 thick (it was 0.14), so it reads as Brown's heavy ring in any turned
  view.
  - The long teeth and roller A (now ±0.12) work inside the wheel's layer.
  - The crown pins a stand on the front face (z 0.19–0.33), and pallet B works in front of the wheel (z 0.22–0.32).
  - The staff and the wheel arbor were lengthened to match. The XY geometry and the contact solve are unchanged.
- **Notch.** In Brown's pose, pallet B covers the roller's notch. B now uses the shared see-through style, so the
  notch reads clearly behind it at every phase (`a293-ph.png`). The roller itself stays opaque.
- **Intersections.**
  - Before: roller–wheel 0.0001 (working contact).
  - After: roller–wheel 0.0001 (working contact).
- **Faces:** clean.

## 296 lever (`authored-plate-escapements.js`)

- **Plate.** Brown's three curved crossings are about 22 px across at the rim. Each window's inner arc stops about
  33 px from the centre, so the crossings meet in a broad web round the arbor.
- **Before:** the windows came to within 16 px of the centre, with 34 px at the rim. The crossings pinched to slivers
  at the hub.
- **After:** `spokeTipWidth` is 22 px and `hubRadius` is 33 px, still from `spoked-wheel.js` (lens windows). The
  result matches the plate (`after/296-default.png`).
- **Intersections.** Lever–wheel 0.0000 (working contact). The teeth are unchanged, so this is the same as before.
- **Faces:** one existing zfightSameLook between the arbors.

## 297 lantern (`authored-lantern-escapements.js`, `lantern-finite-playback-parts.js`, `lantern-pallet-contact.js`)

- **Layout.** The order along z is reversed.
  - The plain disc is opaque. The eight pins are seated in it and stand forward from its face, from z 0.70 to 1.30.
  - Bars B and C run from z 0.86 up into arm A. The arm is one plate at z 1.38–1.60, in front of the pin ends, and
    uses the shared see-through style, as Brown dashes it across the wheel.
  - B and C stay solid, like Brown's hatched pallets. The pivot hub and arbor move to the arm layer.
  - The wheel arbor now ends as a short stub behind the disc.
- **Disconnected part.** C was attached only at one corner: the arm's tip edge met C's edge with about 0.02 of
  overlap. The arm's tip edge now lies on C's long axis, so C is carried across its middle, as Brown draws the arm
  ending on C. B crosses the arm's right edge. Arm, hub, B and C are one rigid piece.
- **Motion.** `palletZ` and `armZ` are the only contact constants changed. The contact and bake are planar, and
  `generate-lantern-escapement-motion.mjs --check` passes. No rebake was needed.
- **Intersections.** None, before and after.
- **Faces.** One zfight between the disc and the hub bore. It is inside the arbor and invisible. The earlier one was
  the arm/hub bore, which was also hidden.
- **Tests.** The layout tests were rewritten: the pins rise from the opaque disc, the see-through arm is in front of
  the pin ends, the bars reach into the arm, and both bars are carried by the arm plate in plan.

## 309 Mudge gravity (`authored-gravity-escapements.js`, `baked/gravity-escapement-plates.js`)

- **Teeth.** Brown's teeth were measured on both flanks.
  - Each tip has a nearly radial face on its clockwise (leading) side and a long straight back, about half a pitch,
    down to a land on the root circle.
  - The teeth were symmetric. They are now cut that way. The tips stay on the same stations, so locking and lifting
    are unchanged.
  - The slant matches the plate: on the right the lower flank is radial, and on the left the upper flank is radial.
- **Arms.** Each pallet arm ended about 0.03 short of its hub disc. Both arm edges now run on to the arbor's station
  along the arm, and the hub disc rounds the end, so arm and eye are one plate, as Brown draws them.
- **Rebake.** Only 309 was rebaked (`generate-gravity-escapement-plates.mjs 309`). The 310, 311 and 312 entries are
  byte-identical to before. The swept cut still keeps Brown's pallet features (`a309-L.png`, `a309-R.png`).
- **Intersections.** None, before and after.
- **Faces.** The existing half-fork/fork-pin zfights and the hub/arbor zfightSameLook remain.
- **Tests.** A new test checks the slanted teeth (a root point beside every tip on its clockwise side only) and that
  both arms run into their eyes. It fails on the old bake.

## Tests

The following pass (82 in all):

- `plate-escapements` (2 new tests)
- `movement-297`, `lantern-pallet-contact`, `lantern-working-solids`
- `movement-309` (1 new test), `gravity-escapement-working-solids`, `movement-310`, `movement-311`, `movement-312`
- `source-presentation`
- `movement-304`
