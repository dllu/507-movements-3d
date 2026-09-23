# Movement 303 Graham anchor review (pass 49)

Reviewer: Claude Opus 5.5 — primary agent, 2026-09-23. Production views were
inspected beside Brown's plate before and after the correction. The motion law
(concentric D/E locks, A/B impulse, finite drops) is unchanged and analytic;
MuJoCo is not used.

## Defects found

The relative-motion screen
([screen-body-intersections.mjs](../scripts/screen-body-intersections.mjs))
found, before correction:

| Pair | Depth |
| --- | --- |
| wheel hub around a fixed, unbored arbor | 0.2497 |
| wheel hub / pendulum rod (rod passed through the hub) | 0.1600 |
| teeth / left arm D | 0.1145 |
| teeth / right pallet E body | 0.0962 |
| teeth / right arm E | 0.0781 |
| teeth / left pallet D body | 0.0668 |
| frame base / pendulum bob | 0.0444 |

Visual differences from the plate: near-symmetric teeth with roots spanning
0.96 pitch instead of Brown's narrow teeth and wide gaps; thin bar arms instead
of the broad D–C–E anchor; a post in line with the wheel centre; white contact
markers at the pallet tips.

Causes: E's pallet body was built on the arbor side of its inner locking face
(the same wrong-side error as the verge pallets); straight arms ran through the
tooth path to E; the escape arbor was fixed while the hub turned on it; the
rod, arbor and base were at conflicting depths.

## Correction

- **Teeth:** `grahamToothOutline` gives narrow teeth (0.3 pitch at the root)
  with a slightly forward-leaning front face ending at the unchanged working
  tip and a back-sloping top, matching Brown's gaps.
- **Anchor:** each side is one baked outline from
  [generate-graham-303-anchor.mjs](../scripts/generate-graham-303-anchor.mjs):
  a blank made of the hub, a 0.36-wide arm to an outer corner, and a 0.34-thick
  pallet built on the correct side of the solved lock/impulse loci, minus the
  envelope swept by every nearby tooth in the anchor frame over one period
  (4000 poses, convex hulls between consecutive poses, clearance covering both
  bevel mitres plus 0.003). The result is the broad hooked D and E pallets of
  the plate. The bake is byte-reproducible and records a geometry fingerprint
  that a test checks against production.
- **Pendulum and supports:** the escape arbor turns with the wheel; the rod and
  a lens bob hang behind the wheel as in the plate (occluded by rim and spokes),
  joined to the pallet arbor through the anchor bearing. The frame post stands
  outside the wheel and bob swing, with rear bars and bosses to both bearing
  rings; the base is below the bob.
- The contact marker still tracks the active tip but no longer renders.

## Evidence

- Screen after correction at 0.01 spacing and 257 phases: no sampled
  penetration between wheel, anchor/pendulum and frame. Four white working-face
  edge tubes are open shells and are checked only as sources.
- [graham-303-working-solids.test.mjs](../tests/graham-303-working-solids.test.mjs):
  bake fingerprint matches production; all three bodies clear at 97 phases;
  over 2000 phases the active tip is never inside its face and stays
  0.0136–0.0302 from the anchor surface during lock and impulse. Negative
  control: advancing a locked wheel 2° drives the tip into each lock face.
- The eight movement-303 tests pass (marker assertion now hidden/active).

## Remaining limits

- Working faces sit 0.014–0.030 from the nominal tip rather than touching; the
  motion law still places the tip on the solved locus.
- The anchor outline is reconstructed from Brown's proportions and the solved
  loci, not traced; its outer corners and arm widths are approximations.
- Pendulum swing, impulse force, drop impacts and escapement energy remain
  prescribed. The added rear frame is not in the plate.
