# 138: traced cam with baked gravity follower

Browser 138 now loads a 420 KB baked bundle containing the engraving-based cam,
a correctly proportioned pointed follower and passive MuJoCo motion. No physics
or collision-mesh construction runs in the browser. An eight-second revolution
preserves the recorded startup and loops continuously. Restart, fog removal and
full-stroke framing are enabled.

## Engraving and animation comparison

The [source page](https://507movements.com/mm_138.html) includes a 2D animation.
Its seven-circle construction differs from the engraving: the old model missed
the upper-right corner by about 16 pixels, the left point by about 9 pixels and
the bottom point by about 6 pixels. The caption specifies variable alternating
rectilinear motion, without requiring circular profile segments.

The replacement uses seven cubic segments traced from the engraving, preserving
its sharp corners. At 20 separately recorded edge landmarks, maximum distance
to the tessellated outline is 2.485 pixels. The [overlay](validation/138-outline-review.svg)
has been rendered and visually checked; it follows the ink without fitting a
transform to conceal individual errors. Registration uses shaft centre (259,381)
and 51.25 pixels per world unit. Control points are inferred and landmark accuracy
is limited by the ink width; this is not a dimensioned engineering drawing.

Guide centres now match image y=180 and y=69, with 67-by-22-pixel brackets,
21-pixel bolt offsets and 309 pixels from the follower point to the rod end.
The guide sleeves and shaft bearing have actual bores. A rear support connects
the bearing and both guides behind the mechanism. Hidden depths and support
construction remain inferred.

The previous follower tip also had its width and height transposed. A full-turn
finite-tip envelope check found 5.27 pixels of interference despite its point-ray
contact test reporting zero gap. The corrected tip has half-width 0.12 and height
0.24 world units, matching the pointed rod's proportions. Working surfaces are
un-beveled and the tip overlaps the cam axially while clearing the carrier.

## Contact simulation and limitations

Only the cam is actuated. A frictionless, vertically constrained follower rests
on it under gravity, with contact against the finite triangular tip. The cam is
split into star-shaped, extruded convex collision cells. The follower can lift
off at sharp corners; no rod trajectory or permanent contact is imposed.

Physical dimensions are absent from the source. The simulation assumes one
engraving pixel corresponds to one millimetre: a 123 mm cam radius and one world
unit equal to 0.05125 m. Gravity is consequently 191.4146341463 in those coordinates.
Mass, guide friction and actuator gains remain reconstruction assumptions.

Four 24-second probes independently refine timestep (0.0005 to 0.00025 seconds)
and tessellation (64 to 128 cells per curve). All finish without resets. Maximum
settled position sensitivity is 0.4441 pixels for timestep, 0.4632 for tessellation
and 0.4405 for both. Maximum MuJoCo penetration in the selected run is 0.0627 pixels.
A separate sampled finite-tip envelope check finds up to 0.795 pixels of lift-off.

The corrected trajectory differs from the animation's ideal point follower by
up to 14.46 pixels at the same cam angle, predominantly because the engraving's
cam shape differs from the animated shape. This discrepancy is retained in the
[physics report](validation/138-physics-review.json), rather than adjusting the
traced profile to match the animation.

## Playback validation

The bake stores 9,301 samples at two-millisecond intervals. Its eight-second loop
starts at 10.6 seconds, with position and velocity seams below 1e-8 engraving
pixels and pixels/second. Interpolated finite-tip clearance, rod engagement with
both guides, framing, restart, source hashes and the loop are checked in tests.
The packaged desktop/mobile test checks play/pause/restart and absence of WASM
requests. Geometry and motion provenance accompany the compressed asset.

```sh
node scripts/review-variable-cam-outline.mjs
node scripts/probe-variable-cam.mjs
SIM_OPTIONS='{"timestep":0.00025}' PROBE_REPORT=/dev/shm/138-time-refined.json node scripts/probe-variable-cam.mjs
SIM_OPTIONS='{"samplesPerArc":128}' PROBE_REPORT=/dev/shm/138-mesh-refined.json node scripts/probe-variable-cam.mjs
SIM_OPTIONS='{"timestep":0.00025,"samplesPerArc":128}' PROBE_REPORT=/dev/shm/138-fine.json node scripts/probe-variable-cam.mjs
node scripts/review-variable-cam.mjs
node scripts/bake-variable-cam.mjs
node --test tests/variable-cam-prototype.test.mjs tests/variable-cam-bake.test.mjs
```

The legacy registry factory remains available for the historical animation/tip
comparison. The browser loader routes directly to the baked replacement.
Continue the review at 139.
