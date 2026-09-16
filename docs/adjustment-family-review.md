# Wedge, stand and chain-link adjustment pass: 381, 382, 399

Primary references: [381](https://507movements.com/mm_381.html),
[382](https://507movements.com/mm_382.html), and
[399](https://507movements.com/mm_399.html), checked 2026-09-15 alongside the
local engravings. All three official pages mark Animated unavailable and contain
no canvas model. Their reversible adjustment schedules are illustrative, not
measured source timing. Exact rigid transforms suffice; no live physics is needed
for the demonstrated unloaded adjustments.

## Corrections

- **381:** The previous board began beyond the ends of the wedges, so the stated
  zero plane gap never clamped any wood. The board now overlaps both wedges by at
  least 0.45 units throughout insertion. Their full-height outer faces and the
  cheek faces form matching inclined dovetails, replacing a rectangular overhang.
  Contact-face indices lie within the wedges instead of protruding into the wood.
  The existing straight sliding law and 0.38 wedge slope are retained.
- **382:** Replaced solid socket and hinge barrels with actual bores. A continuous
  hollow pillar joins the socket, whose finite side opening and bored radial boss
  receive the closed set-screw thread. The second screw now extends through all
  three hinge barrels, with an actual threaded segment entering the left barrel.
  A stem-side bridge supports the outer hinge barrels; the stem ends below the
  hinge axle. A rear bracket offsets the mirror behind the stem and hinge through
  the tilt envelope. Glass meets its frame instead of floating inside it.
- **399:** Replaced spring-like tubular helices and fake solid bore markers with
  closed male and complementary female screw threads. Both screws have the same
  physical handedness; the existing opposed nut rotations remain compatible with
  the two translating halves. The oval nut cages have actual axial openings and
  bored swivel journals. Retaining heads sit beyond the bearing faces rather than
  inside the bearing solids. Screw lengths leave room for the opposite retaining
  head at full tightening, including the rounded screw tips.

All three use sampled full-cycle bounds, suppress generic ground and material
fog, and expose the working interfaces from their default camera directions.
The construction reuses `boredCylinderGeometry`, `boredLatheGeometry`, finite
plate clipping, closed screw-thread geometry and the existing fit helper.

## Validation

`node --test tests/movement-381.test.mjs tests/movement-382.test.mjs tests/movement-399.test.mjs tests/adjustment-contact-solids.test.mjs`

28 tests pass: 24 existing analytic/source/binding checks and four independent
finite-surface checks. The new checks sample 65 adjustment poses for actual wedge
contact, dovetail fit, socket/hinge/mirror clearances and swivel/cage/tip clearance.
Both male/female thread pairs are checked through the full two-turn adjustment at
33 poses against rendered triangle surfaces, with positive finite clearance.
These bounded samples are regression evidence, not exhaustive collision proofs.

Chrome source/default/front/advanced review reported no browser errors or
full-cycle clipping (17 poses, maximum absolute projected coordinate 0.866,
0.829 and 0.859 respectively). Final board length, screw-tip shortening, radial-opening clearance and hinge
thread engagement edits remain inside those bounds and are covered by the
finite checks. Review captures and fetched source HTML remain in `/dev/shm`.

## Remaining assumptions

Dimensions, colors and unloaded adjustment ranges remain engineered. The wedge
schedule synchronizes two independently operated wedges; wood compliance,
friction and self-locking force are not simulated. Mirror set screws remain
loosened during adjustment; their locking friction, detailed mating female thread
and hinge preload are schematic. The chain link uses a square thread section and
synchronized equal-pitch adjustment; backlash, operator torque, tensile loading
and strength are not solved. The source leaves those properties unspecified.
