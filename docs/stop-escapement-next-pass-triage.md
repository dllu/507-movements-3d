# Next finite-stop family: 233, 238 and 239

Read-only screen against baseline `5767c6b`, on 2026-09-16. These factories are
unchanged by the parallel 237/240/241 pass. They reuse the same finite working
surfaces, profile envelopes and bored-joint components, with independent
factory ownership for the next batch.

| Movement | Actual-solid defect | Next correction |
| --- | --- | --- |
| 233, lantern-wheel alternatives | Latch enters trundle 11 by 0.01901295 at phase 0.6875; decorative roller rim enters trundle 0 by 0.00918605 at phase 0.171875. | Preserve the useful roller/latch faces, remove expanding presentation geometry from their contact envelopes, and check release plus real pivot passages. |
| 238, seven-tooth escapement | B's finite beam enters the wheel by 0.175 at phase 0.828125; C's enters by 0.145 at phase 0.3125. | Reconstruct compatible finite pallets and their lock/impulse/drop sequence together. Do not erase the active face merely to clear the wheel. |
| 239, opposed spur stops | Both source-shaped stop bodies enter the gear by 0.207; left at phase 0 and right at 0.203125. | Reconstruct the complete stop/gear interface and opposed trapped-clearance limits, retaining a useful resisting face in each direction. |

Run `node scripts/screen-stop-escapement-interfaces.mjs`. This samples actual
vertices, edge midpoints and triangle centers at 65 poses against rendered
mesh triangles, with distance capped at 0.3. It is a reproducible defect screen,
not exhaustive collision, load or contact qualification. Mesh indices identify
depth-first mesh order within the named part. In 233, roller mesh 0 is the disk,
mesh 1 the torus and mesh 2 the white index. The disk's smallest sampled gap is
+0.00013492; that alone does not establish sustained contact or proper normals.

Useful target-local witnesses, in scene units:

- 233 latch/trundle 11: `[0.07802194, 0.31000000, -0.13486192]`, time 5.5.
- 233 rim/trundle 0: `[0.07569745, 0.45081395, -0.14236083]`, time 1.375.
- 238 B/wheel: `[-0.52843043, -0.37165050, 0]`, time 3.3125.
- 238 C/wheel: `[0.31829726, 0.72224741, -0.03000000]`, time 1.25.
- 239 left/gear: `[-0.31999998, 2.31999999, 0.02799999]`, time 0.
- 239 right/gear: `[1.20722185, 1.87767288, 0.02799999]`, time 0.8125.

The [233](https://507movements.com/mm_233.html),
[238](https://507movements.com/mm_238.html) and
[239](https://507movements.com/mm_239.html) HTML pages fetched on this date mark
Animated unavailable; none registers a canvas/model animation. Their captions
respectively identify two alternative lantern stops, a two-pallet escapement,
and opposed spur-gear stops. Preserve the complete wheels although two of the
engravings abbreviate their lower halves. Use the existing contour extractor
for irregular visible outlines, with ideal mechanical faces and independently
inferred occlusions.

Chrome default/source and advanced oblique views were inspected. All three load
without page errors and fit a 17-pose visible-vertex sweep: normalized extents
0.8810, 0.9058 and 0.9233. Their source layouts are recognizable, but 238's
separately raised working bars visibly detach from the outline at C and its
initial view is oblique. These presentation findings do not qualify working
contacts. Bulk evidence remains in `/dev/shm/family41-next-*`.
