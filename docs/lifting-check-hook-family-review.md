# Lifting and arresting hooks: 251 and 253

Primary references: [251, pile-driver releasing hooks](https://507movements.com/mm_251.html) and [253, centrifugal mine-drum check hooks](https://507movements.com/mm_253.html). Both complete HTML pages mark animation unavailable and contain no `add_model`, `mm_present`, or animation-script imports. The engravings and captions are the references; there is no official motion oracle for this pair.

## Corrections

**251.** The previous round hook body entered the solid lifting-head crossbar during squeezing (a centerline point was already inside the bar at 0.12 radians). Its reported zero latch gap compared constructed points rather than working solids. The head now has two sloped retaining shelves joined by a rear crossbar. Finite rounded toes on bored flat hook cheeks bear on those shelves; head height follows the actual toe offset and corner contact until the toes clear the inner edges. Initial shelf reactions point upward and outward, producing a closing moment about each hook pivot. Connected closing stops limit that direction. The upper cheeks were narrowed analytically to clear the existing squeezing guides; their depth now clears the original hammer yoke. Pins span real bores. The original converging guide, symmetric squeezing, gravity fall and explicit external reload remain.

**253.** The old catch normal pointed radially through the drum axis and supplied zero arrest torque. The revised hooked tip and stud placement yield an ideal resisting drum moment arm of **0.22477** and a hook-seating moment arm of **0.19186**, in model units. Deployment stops extend into the rotating flange. The rendered working-face normal is `(0.97194, 0.23523, 0)`, and its reaction also resists drum rotation while pressing the hook toward its stop. Reset now backs the flange off by 0.18 radians before retracting the hooks, avoiding the interference that direct retraction would cause. Hook eyes, flange, drum and backing have real shaft bores. The shaft-face indicator clears the bore.

Both reuse finite plate, capsule, disk and bored ring components. New meshes receive shadows, materials ignore scene fog, the ground is hidden, and the returned source-facing camera directions remain wired to the engine. Minimum display periods are 10 seconds for 251 and 12 for 253. Playback changes transforms and existing cable buffers rather than allocating geometry.

## Focused evidence

Run:

```sh
node --test tests/lifting-check-hook-working-parts.test.mjs tests/movement-251.test.mjs tests/movement-253.test.mjs
```

**23 tests pass**, including 16 existing regressions, in 3.62 seconds. Integration log: `/dev/shm/lifting-check-hook-tests.log` (temporary artifact, not committed).

The finite checks use the actual visible mesh triangles and posed transforms, including shaft sections through bores. The 251 contact sweep combines 33 full-cycle poses with 17 poses each over squeezing, initial release and relatching. The 253 sweep adds targeted approach and backed-off reset poses, plus 2,401 inexpensive analytical hook/stud checks. Tests also check signed reaction directions, contact proximity, position continuity at every handoff, outward new plate winding, stable position buffers, shadow/fog flags and full-cycle camera bounds.

| Interface | Measured result, model units |
| --- | --- |
| 251 toe / complete lifting head | Minimum signed distance −0.0000000386, within Float32 surface precision |
| 251 working toe / shelf | Maximum nearest sampled surface gap 0.00008031 |
| 251 pivot / bored cheek | Minimum clearance 0.00383187 |
| 251 cheek / closing stops and yoke | Minimum two-direction sampled clearance 0.00364961 |
| 253 working hook / stud | Minimum and maximum active nearest sampled gap about 0.00090542 |
| 253 hook / deployment stop | Zero sampled gap at deployment; no penetration |
| 253 hook pivot bore | Minimum clearance 0.00383722 |
| 253 common shaft / journals | Minimum clearance 0.00383729 |

The generic audit uses a 0.1-distance search cap, so reported 0.1 values mean at least that clearance, not exact distance. Reverse surface sampling is used for the small working contacts and stops; a one-direction sample can miss the closest point on a long face.

## Remaining limits

These are **prescribed contact demonstrations**, not passive force-validated mechanisms. For 251 the finite edge normal approaches horizontal at release: finite weight support would require unbounded reaction in the imposed quasistatic path. The current law therefore does not validate the actual loaded release time, squeezing force or acceleration at that edge. Head acceleration is explicitly unreported (`null`); the offset position law remains continuous. Small closing-stop clearance is retained. The hammer's free fall and instantaneous inelastic impact are prescribed, and resetting is external.

For 253 the corrected face has the necessary resisting reaction direction, but deployment, flange impact, holding and reset are still prescribed. The lossless torsional quarter-cycle illustration does not establish a loaded hoist's stopping distance or peak rope force, and the final hold requires an external restraint. The finite hook/stud mesh has about 0.00091 clearance rather than a force-solved loaded closure. No MuJoCo force validation is claimed. These residuals are exposed in model metadata and reconstruction notes; a native contact study should start from the corrected geometry if passive behavior is pursued later.

Root inspected final default and oblique views: no browser errors or clipping; maximum NDC extents were 0.70478 for 251 and 0.83655 for 253. The broad source topology is retained, but 251's upper arms, sloped retaining shelves and closing stops are inferred geometry; its engraved curved tip is simplified, not traced or claimed as an exact source fit.

CPU construction measurements were 92 ms first / 24–32 ms warm for 251 and 24 ms first / 12 ms warm for 253. Visible triangle counts are 8,676 / 20,464, with mean update times of 0.014 / 0.025 ms over 1,000 updates. No engraving tracing or dense offline solve was needed for the bounded geometry changes.
