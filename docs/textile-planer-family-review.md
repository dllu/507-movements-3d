# Textile dressing and planer feed: 383 / 388

Reviewed the [383 primary page and animation](https://507movements.com/mm_383.html), [388 primary page and animation](https://507movements.com/mm_388.html), and local engravings. This is a bounded correction of visible working surfaces and shaft interfaces, not a validation of cloth finishing or timber traction.

## Source and changes

**383.** Brown shows two winding rolls and an interposed treatment cylinder. The official animation explicitly calls its directions and ratio conjectural. Its inline model gives the centre half the end-roll rate in the **same** direction; the previous implementation ran the centre oppositely. The correction follows the oracle's relative direction and ratio. The exact tangent web and constant winding radii remain analytical assumptions.

The winding body radius now equals the 0.62 web tangent radius instead of 0.5642. Circular brush-tip sectors replace boxes whose corners overran the 0.93 cloth envelope. The tips stop 0.0002 model units inside the ideal path to accommodate tessellation. End rims sit outside the cloth width. Registration stripes are surface markings rather than bars penetrating the treatment surface. Real bores pass through rolls, bearings and rear crossbars; longer axles span the complete bearings, and a centre crossbar supports the central bearing. Face indexes no longer cover the shaft bores.

**388.** The oracle specifies equal working radii, 20 upper teeth and opposed equal angular rates. These are retained. Concave-sided pointed teeth replace radial boxes; their actual extreme radius agrees with the bite calculation. These are wood-gripping teeth, not an involute gear pair. The smooth lower cylinder remains tangent to the plank. Bored roller bodies, bearing blocks, collars and support arms clear the actual shafts. Previously suspended frame standards now reach the base.

A fixed 10.2-unit observation window replaces the 24-unit moving plank that extended far outside the declared camera fit. Material marks move through that window at the existing feed speed, are clipped at its edges, and repeat at the same material pitch. The view does not represent the ends of a finite workpiece. Both models now use source-facing cameras, explicit fog-free materials, hidden scene ground and full authored minimum display periods (383 approximately 10.82 seconds; 388 6.4 seconds).

## Validation

Run:

```sh
node --test tests/textile-planer-working-parts.test.mjs tests/movement-383.test.mjs tests/movement-388.test.mjs
```

All **23 tests pass**, including six new finite-interface and full-cycle presentation tests. Final local log: `/dev/shm/textile-planer-tests.log` (1.89 seconds). The sole legacy behavioral change is 383's source-oracle centre rotation sign.

The new tests check actual triangle surfaces and transforms. Thin journal passages also sample intersections of shaft triangle edges with interior journal planes, avoiding the false result obtained by inspecting only shaft ends. The combined selected studies perform about 2.30 million signed-distance queries:

| Interface | Evidence in model units |
| --- | --- |
| 383 cloth / brush, 33 full-cycle poses | Minimum clearance 0.000137; maximum nearest working gap 0.000140 |
| 383 cloth / winding rollers | Minimum gap 0.0000906; maximum nearest gap below 0.0003 |
| 383 cloth / edge rims | Minimum clearance 0.04568 |
| 383 actual winding / brush journals, 17 full-cycle poses | Minimum clearances 0.001966 / 0.001961 |
| 388 actual tooth / wood, 65 poses over one tooth period | Intentional bite 0.033626–0.050000; forward-facing immersed flank normal component at least 0.986 |
| 388 smooth support / plank | Tangent within 4.1e-8 floating-point error |
| 388 shafts / bodies, collars, arms and bearing blocks, 17 full-cycle poses | Minimum clearance 0.001955 |
| 388 teeth / fixed bearing and arm solids | No sampled penetration |

Both full-cycle visible-vertex bounds checks pass at 33 poses. Scene counts, geometry objects and position arrays remain stable across updates. No simulation or collision mesh is generated during playback. Measured visible geometry is 15,150 triangles for 383 and 13,944 for 388, excluding shadow passes. Local factory construction took 66 / 38 milliseconds on first call and about 7–17 milliseconds on subsequent calls. Shared final browser review is performed centrally.

## Limits retained explicitly

383's cloth is a zero-thickness sheet with constant winding radii. Bristle deformation, web tension, winding buildup, finishing force and power transmission are not solved. Near contact of the finite brush mesh demonstrates compatible geometry, not loaded bristle contact. Decorative brush and frame details remain simplified.

388 intentionally places the upper points inside the displayed wood. The 0.034–0.050 indentation represents compliant gripping; it is **not** a claim of rigid-body nonpenetration. Mean feed follows the equal working radii, while point velocities differ locally from the translating wood. Timber indentation, local slip, friction, traction force and feed under load remain unvalidated. The reconstruction note exposes this limitation in the viewer. A rigid-body MuJoCo study would not establish those material properties, so no unsupported force solve is claimed.
