# 212: contacting winding-stop branch

The [official movement 212 page](https://507movements.com/mm_212.html) has a registered inline animation. Its source construction is retained, but its linear 51° indexing interpolation is not a compatible finite contact law throughout the index. The previous unchanged-profile midstroke feasibility study was extended into a continuous branch; no working profile was relieved or removed.

## Geometry and motion

The broad finger first drives an existing radial slot flank. Its circular side then holds the existing mouth corner briefly, before the locking-rim end drives the existing concave pocket into concentric lock. The transitions occur at input angles 0.697614965, 0.806314470, and 0.956043327 radians. Thus complete indexing takes approximately 54.78°, rather than the source animation's 51°. Ordinary indexes advance the wheel by one fifth of a turn clockwise; the convex terminal sector still blocks further winding during the fourth approach.

The branch is solved with short analytic circle/line formulas during playback. There is no live collision search, physics engine, or generated motion table. The ideal source finger arc is tessellated with 128 rather than 30 segments to represent its contacting circular face accurately. Expanding decorative edge tubes are hidden; the complete working solid profiles remain. The two hub bores are corrected to clear their actual shafts.

The original interpolation remains available in `sourceKinematics`, independently of the corrected public state, rendered rotors, contact flags and canonical lock times. This preserves the source oracle without mistaking it for a validated mechanical law.

The final browser review also exposed an index crossing an empty slot. Both
indexes are now shorter and flush on their hub faces; the redundant raised
finger highlight is hidden. The working geometry and contact law are unchanged.
The 10 dedicated/legacy checks pass again after this presentation correction.

## Evidence

`node --test tests/geneva-212-contact.test.mjs tests/movement-212.test.mjs` passes 10 checks. The new tests sample the actual extruded triangle surfaces in both directions during ordinary indexing, dwell, repeated turns and the terminal approach. Minimum sampled signed clearance is −0.000002195; maximum selected working-contact distance is 0.000002594. Both fit the explicit 0.0000031 finite tessellation tolerance. The source profiles remain complete and unbeveled.

Nearest actual side-face normals at nine selected entry, hold and late-drive poses give clockwise output torque, with minimum sampled clockwise moment 0.08018. A 4,097-pose law sweep checks monotonic indexing and repeated turns; boundary checks verify positional continuity and derivative checks verify the analytic law away from impacts. An actual terminal witness contacts both working bodies, and 0.002 radians of attempted input overtravel causes penetration. Rendered and public state agree, canonical completion times report real lock, and playback preserves geometry buffers.

`node --test tests/geneva-stop-working-solids.test.mjs tests/movement-215.test.mjs` passes another 12 regression checks. The combined focused result is 22/22 passing. RAM logs: `/dev/shm/212-final-tests.log` and `/dev/shm/212-shared-final-tests.log`.

## Remaining qualification

This is a finite geometric reconstruction with prescribed input motion. Position is continuous, but handoffs can change velocity abruptly and therefore require idealized impacts. The locking-rim torque tends to zero at dead-center capture; the selected normal checks do not establish a loaded dynamic capture arbitrarily close to that endpoint. Reverse playback follows the same geometry and requires an assisting output bias; the forward working face alone cannot pull the output back. Friction, inertia, preload and impact-force balance have not been simulated. These limitations are disclosed in the viewer rather than inferred from clearance alone.

Final default/source and oblique views show no browser errors or clipping;
maximum sampled normalized extent is 0.79874. The final model renders 25,648
triangles (51,296 including shadows). CPU construction measured 230 ms and
sampled update P95 0.0974 ms, with no screen flags or geometry/object growth.
These CPU timings exclude imports, GPU rendering and browser loading.
