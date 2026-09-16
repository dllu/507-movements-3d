# Lift pumps 448–449: working passages and joints

The official [common lift pump, 448](https://507movements.com/mm_448.html), and
[modern lifting pump, 449](https://507movements.com/mm_449.html), show valved
buckets with rod yokes, lower checks and upper outlets. 449 adds a packed rod
opening and an upward-opening delivery flap. Both official pages mark animation
unavailable and provide no mechanism script. The engraved sections were compared
with the default and advanced browser views.

## Corrections

Both buckets now have actual through-passages. Flat annular seats meet the check
disks instead of toroidal trim entering them. An arch yoke connects the rod above
the moving bucket check, replacing the rod that passed through the valve. The
448 link uses real bored eyes, finite pins and a fixed bored lever bracket;
its front layer clears the yoke. 449's cover and stuffing body have actual rod
bores, and its longer visible rod connects to the yoke crown.

Barrels and tapered suction pipes have finite walls. The barrel side openings
are closed around their thickness and open into the outlets. 448's spout has a
real bore. 449's rising main stops at the enlarged flap chamber and resumes above
it; it no longer runs an unbroken narrow pipe through the moving flap. A circular
flap covers its annular seat, with a bored hinge lug, separate pin and fixed journals connected to the chamber.
The seat has local hinge-eye relief outside the sealing bore; a raised lug web
clears the seat throughout opening.

The invented wells and foundations are hidden. More frontal cameras expose the
working sections, transparent water is subdued to keep the valves visible,
material fog and generic ground are disabled, and bounds cover the full stroke.
The 5.4/4.8-second authored cycles are enforced by minimum display durations,
including after the registry applies viewer timing.

## Verification

```sh
node --test tests/movement-448.test.mjs tests/movement-449.test.mjs tests/lift-pump-working-solids.test.mjs tests/reviewed-cycle-timing.test.mjs
```

The focused run passes 28 tests (including timing checks for four earlier models).
The finite tests use actual rendered triangles, vertices, edge midpoints and face
centroids through 65 poses. Named pairs cover bucket/barrel, yoke/check, check/seat,
rod/cover/packing, lever journals and the delivery flap's chamber, seat and hinge.
The flap lug is also checked against its seat and fixed journals, including the
closed position where independent review caught an initial interference.
Separate checks find an open path through both barrel outlets and real valve
bores. Existing tests retain the kinematic closure, derivative, valve-interlock
and ideal displacement-volume relationships. These are selected sampled checks,
not exhaustive continuous collision proofs.

Chrome source/default and advanced views had no errors or full-cycle clipping;
17-pose projected extents were .878/.883. Bulk captures remain in
`/dev/shm/lift18-*`. Geometry is built once; playback updates transforms only.

## Physical limits

Valve lifts and flap timing still follow prescribed stroke-phase laws. The lower
and bucket valves are reconstructed lifting disks; detailed hinges and dynamic
seating from the sections are not reconstructed. The yoke and barrel dimensions,
clearances and cutaway treatment are inferred. Contact pressure, packing/seal
compression, leakage, priming, pressure losses, required rod force and passive
valve dynamics remain unsolved. Water volumes and tracers illustrate the original
ideal displacement model; they do not subtract every immersed solid, resolve flow
through the openings or prove a pressure-tight junction. MuJoCo is not used for
these prescribed geometric corrections and would not by itself validate fluid
behavior.
