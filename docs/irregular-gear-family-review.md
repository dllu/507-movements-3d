# Movements 191, 196 and 201: irregular gear family

Primary references: [191](https://507movements.com/mm_191.html), [196](https://507movements.com/mm_196.html), [201](https://507movements.com/mm_201.html), their captions and engravings. All three pages mark their animation unavailable. No animated oracle was available for this pass.

## Corrections

The existing analytical motion laws are retained. 191 accelerates its driven scroll during a uniform driver turn, then resets speed at the stepped seam. 196 rolls an inferred noncircular pitch curve against a uniformly turning fixed pinion, moving its center along the pivoted carrier. 201 continuously turns a carried pinion through an eccentric circular driver; the carrier rocks, the open belt runs relative to that carrier, and the slotted arm reciprocates rod A.

191 now has a mating driven contour cut offline by the actual finite driver geometry swept through that motion. The driver retains its original straight-sided teeth, including bevel corners; these corners are included in the cutter silhouette. The driven gear is a single continuous bored extrusion, with obsolete separate tooth meshes hidden. A finer 8,193-pose sweep, contour simplification and a small inward finishing allowance reduce the contour to 1,969 points while maintaining sampled clearance. This does not remove the physical discontinuity of the once-per-turn speed reset.

196 replaces its circular pinion's trapezoids with 30-degree involutes. The irregular wheel is generated from the swept pinion in wheel coordinates at 2,049 poses. A common 0.85-module addendum and 0.9-module dedendum are used for the circular profiles. The generated wheel retains 88.3% of its addendum blank area and has 3,373 outline points. Its hub has a real shaft bore. Its carrier now has a continuous plate with bored eyes, a real fixed pivot pin, and a rear bearing that clears the moving plate. The supporting standard stops below the pin.

201 uses matching 30-degree 16/8-tooth involutes, including a genuine eccentric bore in the driver. Equal base pitch, sufficient tip reach and active flanks above the mating base circle give a transverse contact ratio above 1.05. The pinion hub is bored for its shaft. The slot follower radius is reduced from 0.165 to 0.125; the rails allow only 0.1275, so the previous follower physically overlapped them. Its front rim is resized accordingly.

Diagnostic pitch curves and contact spheres are hidden. Rotation indices remain. All materials disable fog, ground is hidden, and a complete-cycle bound controls framing. The default view of 196 is closer to the source-facing direction. The camera reserves room for the whole motion, so 196's initial pose leaves extra space above its wheel. No output speed is accelerated independently.

## Evidence

`docs/validation/191-196-201-contact.json` records 513 interleaved poses per complete motion cycle, including closure. The audit unions triangles from the **actual rendered gear bodies and teeth**, projected onto their common working plane, and checks intersection area and nearest separation. For these parallel planar solids, separated XY projections are sufficient for finite-volume nonintersection; projecting the bevels is conservative. It excludes shafts, hubs, belts and supports.

| Movement | Projected triangles | Overlapping poses | Minimum gap | Maximum gap |
| --- | ---: | ---: | ---: | ---: |
| 191 | 8,006 | 0 | 0.001203 | 0.001343 |
| 196 | 9,664 | 0 | 0.000644 | 0.000813 |
| 201 | 5,152 | 0 | 0.001386 | 0.001450 |

The focused tests also check 201's finite roller against both slot rails through its full cycle, 196's actual carrier eyes against both journals and its rear bearing, and 201's base pitch/contact ratio/eccentric bore. The existing dense analytical motion tests remain in place. The old 196 transform test now measures the actual bored carrier endpoints rather than its hidden legacy joint spheres.

`node --test tests/movement-191.test.mjs tests/movement-196.test.mjs tests/movement-201.test.mjs tests/irregular-gear-family.test.mjs` — **21 tests pass**.

Default, front and advanced-phase browser captures showed no browser errors or framing cuts. Final draw counts including shadows: 191, 140 calls/46,960 triangles; 196, 48/52,696; 201, 160/68,208. On the review machine, one factory-construction measurement gave 166 ms, 248 ms and 54 ms respectively, with 23,480/26,348/34,104 visible triangles before shadow passes. These timings are measurements, not a performance guarantee. The combined baked file is 121,369 bytes; expensive cutter generation stays offline. The existing 196 motion table is still constructed at load time.

## Reproduce

Requirements: installed project JavaScript dependencies, Node, Python, and Shapely (validated with Shapely 2.0.3). Run from the repository root. The checked-in baked contours bootstrap the existing factories; all intermediate geometry is written to `/dev/shm`.

```sh
# Export the actual 191 driver triangles, including bevel miter corners.
node scripts/review-irregular-gear-contact.mjs
# Export original blanks, ideal motion transforms and circular cutter profiles.
node scripts/review-irregular-gear-profiles.mjs
python scripts/generate-irregular-gear-profiles.py
# Rebuild the actual rendered profiles, then qualify the baked result.
node scripts/review-irregular-gear-contact.mjs
python scripts/review-irregular-gear-contact.py
```

The generator deliberately reads the actual 191 cutter triangles from the first export; an approximate rounded polygon buffer missed its bevel corners. It keeps a 0.0012 cutter allowance for 191 plus a 0.0002 inward finishing offset, and a 0.0008 cutter allowance for 196. The audit uses distinct intermediate sample times, not just the generation poses. It hashes the relevant production and audit files.

For reproduction without modifying production, set `BAKED_OUTPUT=/dev/shm/irregular-reproduced.js` on the Python generator command and compare that file with `src/simulation/generated-irregular-gear-profiles.js`. This produced a byte-for-byte match in the final review. The offline generation took approximately 38 seconds. Captures and bulk inputs remain outside Git.

## Remaining limits

These remain prescribed kinematic reconstructions, not loaded physics simulations. Sampled planar clearance and small gaps do not establish continuous-time force transmission, efficiency, strength or realistic backlash.

191 has a discontinuous transmission ratio at its seam. Smooth, continuously engaged repeat motion is impossible under that law: disengagement, a speed reset or another unmodeled dynamic process is required. The visible reconstruction note says this explicitly. Its generated mate is not a standard involute scroll pair.

196's harmonic pitch curve is inferred and has a much softer waist than the pronounced two-lobed engraved silhouette. This pass improves working teeth and joints while retaining the validated motion curve; it does not claim to recover Brown's exact irregular outline. No pixel-by-pixel tracing was done. 201 likewise approximates the unspecified irregular driver with an eccentric circular gear; its exact engraved contour is not recovered.

Generic support geometry, pulley grooves and belt thickness were not exhaustively contact-qualified in this pass. The actual gear meshes, selected journals and 201 slot are the finite-contact scope. The historical speeds, dimensions and detailed tooth profiles remain unspecified.
