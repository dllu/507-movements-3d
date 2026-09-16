# Gyroscope family: 355–356

Primary references: [355](https://507movements.com/mm_355.html) and [356](https://507movements.com/mm_356.html), checked 2026-09-16. Both official pages mark the animation unavailable and contain no canvas model. The engravings and captions establish the single supported precessing disk and the nested, perpendicular-pivot rings around a spherical rotor. No decorative tracing was needed.

## Corrections

- Replaced thick torus frames with finite annular frames, following the engraving's bands. The old 355 ring intersected the disk rim; the old 356 outer and middle rings were thicker than their radial separation.
- Bored every working spindle/pivot bearing and the frame portions traversed by those shafts. The 356 lower trunnion is itself bored for the coaxial middle-ring pivot, and its pedestal journal clears the trunnion. Fixed hubs remain rigidly joined to their own shafts.
- Shortened 355's left spindle to terminate inside its bearing, removing its collision with the curved neck and pintle area. Removed the now unnecessary left cap. Its analytical endpoint metadata follows the actual asymmetric shaft.
- Shortened 356 rotor shaft ends; sized middle/inner pivot housings to clear their child rings while retaining actual solid attachment to their parent rings. Tests check these attachments, not merely coaxial centerlines.
- Corrected 356's initial inner-ring tilt to match the descending diagonal in the engraving. Flat floating rotor markers became surface-following curved marks; off-axis dots remain readable.
- Preserved the motion ratios: twelve disk turns per 355 precession and eighteen ball turns per 356 handling cycle. A twelve-second minimum display cycle keeps both readable without independently accelerating the output. Ground and material fog are disabled.
- 355 uses a view-fit proxy checked against the complete visible precession sweep; the full world bounding box's empty corners otherwise forced an unnecessarily distant view. 356 uses a near-front source-facing view.

## Validation

```sh
node --test tests/gyroscope-working-interfaces.test.mjs \
  tests/movement-355.test.mjs tests/movement-356.test.mjs
```

19 tests pass (14 existing and five new). Actual rendered vertices, edge midpoints and triangle centers are checked against selected working solids at 17 full-cycle poses: 2,682,260 queries for 355 and 6,562,476 for 356. Minimum capped gaps are 0.00589 and 0.00470 scene units. No sampled penetration exceeds 1e-5. The checks cover rotor/frame and rotor/bearing interfaces, the three ring pairs, pivot pins crossing parent rings, and the lower trunnion/pedestal journal. Fixed bearing-to-frame attachment is checked separately. These are selected finite samples, not continuous all-pairs collision certification. Rigidly joined parts and decorative indexes may overlap their own supporting bodies.

The corrected models preserve the existing axis, precession-law and cycle regressions. Scene/geometry/GPU buffer identities remain stable during updates. Cold construction measured 37/28 ms; mean update over 1,000 calls was 0.0063/0.0059 ms. No browser CSG or per-frame geometry generation is used.

Chrome source/default/front/advanced captures show both arrangements without errors. Seventeen full-cycle poses remain inside the default camera frame: maximum absolute projected X/Y is 0.832 for 355 and 0.787 for 356. A separate 65-pose CPU framing check for 355 reaches 0.835. Default rendering uses 56/64 draw calls and 42,264/51,168 triangles including shadow passes. The complete 355 precession sweep necessarily reserves room on both sides of the pedestal, although its initial source pose lies on one side.

## Offline ring bake

Run `scripts/generate-gyroscope-rings.py` with Python and `manifold3d==3.5.3` (plus its numpy dependency) in an external virtual environment. The script uses exact annuli and cylindrical bore cutters; no extracted decorative outlines are involved. Four meshes total 6,176 triangles and 155,770 bytes. Two successive runs produced identical SHA256 `318c458f2bfb4c150be2c3467cc8647248e0fbdd5a98d3abf9fb3a75ce883f04` for `src/simulation/generated/gyroscope-rings.js`. Bulk captures/logs remain in `/dev/shm`.

## Physical limits

355 retains an ideal prescribed horizontal steady-precession solution and its spin-angular-momentum torque balance. Inferred masses are not recomputed from the visible material volumes. Release transients, nutation, support friction, changing spin speed and stability under disturbances are unvalidated. The ring does not emerge from a simulated release.

356 retains prescribed cancellation of the handled outer-ring yaw by the middle gimbal. That constructs a fixed rotor-axis direction in this demonstration; it does not validate passive response to arbitrary three-dimensional handling or the caption's resistance to applied pressure. Pivot friction, bearing loads and elastic response are not solved. Both notes are visible in the model's reconstruction description. No native dynamics claim is made.
