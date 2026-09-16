# Band brake and spatial pulley drive: 242 / 243

Primary references: [242](https://507movements.com/mm_242.html) and [243](https://507movements.com/mm_243.html), checked alongside the local engravings. Both fetched pages explicitly mark Animated unavailable and contain neither an inline `mm_present` definition nor an `add_model` call. Motion timing is reconstructed.

## Working corrections

**242, crane band brake.** The old schedule commanded half braking at phase 0.4 while 0.01305 model units of strap slack remained. Slack take-up now finishes at phase 0.35, before slowdown begins. The lever holds the taut position through the prescribed loading, stopped dwell and unloading interval; it returns only after the load index reaches zero at phase 0.75. The wheel's smooth monotone angle law and one-turn demonstration cycle remain unchanged. The old fabricated normal-force value is replaced by `null`; a separately named dimensionless illustrative load index is retained. This is a prescribed demonstration, not validated friction dynamics.

A new lower pin spans the actual strap and lever layers. Both strap ends have bored eyes; the visible strap terminates inside those eyes without filling their pin passages. The upper anchor occupies a separate axial layer from the moving lever. The fulcrum and upper pins span their complete joint stacks. Drum/hub, lever and anchor eyes, and rear support posts now have actual bores. The lever's coincident face caps are separated. The strap's finite inner faces include a 0.0005 nominal tessellation allowance rather than intruding through the circular drum between sampled stations.

**243, one band driving two vertical shafts.** The old barrels were 0.07 below the belt centreline, leaving a 0.04 gap to the belt's inner surface. Their working radii now lie half the 0.06 belt thickness plus 0.0006 tessellation allowance below the neutral-line radii. The intended shaft ratios remain unchanged. Actual hubs are bored around their shafts; generic raised tread indexes are hidden while face indexes remain visible.

Thin rectangular registration patches replace the oversized marker spheres. Their orientations follow the full spatial belt frame. Bringing the barrels into contact exposed a second defect: the linear quarter-twist rotated belt edges into the pulley near the exit. The twist now has zero slope at both ends, and the ribbon mesh includes every exact segment join. This clears the finite belt edges without reducing the pulley working radius further.

Both old band meshes had inward triangle winding; the scoped index order is corrected. The changing brake band refreshes normals in its existing buffer. Both factories return source-facing camera directions, use explicit fog-free materials, hide generic scene ground and enforce a minimum six-second display cycle. Existing final factory traversal gives the new solids proper shadow flags.

## Validation

```sh
node --test tests/band-drive-working-parts.test.mjs tests/movement-242.test.mjs tests/movement-243.test.mjs
```

**23 tests pass**: 16 legacy analytic/source/binding checks and seven new finite/interface checks. Final log: `/dev/shm/band-drive-tests.log`, 5.52 seconds. Changed legacy assertions follow the revised lever take-up interval, null force, nominal strap tolerance and join-aware ribbon count. Finite-difference tolerances remain below 1e-9 after the faster lever take-up increased truncation/roundoff error.

The new tests check loaded-versus-slack state at 1,001 phases and continuity at each timing boundary. Actual brake-band sample points are regenerated after each update, so the finite audit never reuses the initial slack geometry. Thin journal checks also sample shaft triangle intersections with interior journal planes.

| Actual interface | Result in model units |
| --- | --- |
| 242 live strap / drum, 33 poses | Minimum clearance 0.000147; maximum nearest taut gap 0.000151 |
| 242 strap eyes / drum | Minimum clearance 0.02513 |
| 242 wheel and fulcrum shaft passages, 17 poses | Minimum clearances 0.003928 / 0.003940 |
| 242 upper/lower strap pin passages | Minimum clearance 0.003979 |
| 242 moving lever / separate fixed anchor | Minimum clearance approximately 0.10 |
| 243 belt / actual five pulleys, 33 poses | Minimum clearance 0.0000742; maximum nearest working gap 0.000335 |
| 243 moving registration patches / pulleys | Minimum clearance 0.000450 |
| 243 shafts / hubs and spokes, 17 poses | Minimum clearance 0.001621 |

All visible mesh vertices fit declared bounds across 33 cycle poses. Outward band winding, shadow flags and unchanged scene/geometry/position-buffer counts pass. About 18.6 million selected signed-distance queries complete in the bounded test run; this is sampled regression evidence, not an exhaustive collision proof.

Local visible geometry counts are 14,752 / 23,596 triangles before shadows. Warm factory construction was approximately 10–20 / 5–16 milliseconds; average update cost approximately 0.232 / 0.007 milliseconds. No geometry is allocated during playback. Source outside the two owned builders and additive import is byte-identical to the prior `authored-belts.js`. Final browser/build review is performed centrally.

## Remaining assumptions

242 does not solve band tension, elastic strain, friction coefficient, normal force, driving torque, dissipation or stopping under a specified load. Holding taut geometry while its illustrative load varies is an idealized inextensible-band demonstration. The finite running gap is a rendering tolerance, not force contact evidence.

243 uses belt neutral-line radii for the ideal pitch law. Finite fibre strain, belt stretch, tracking, twist stiffness, traction and transmitted torque are not solved. The reconstructed rear return is inferred from the source projection. Surface proximity and correct shaft ratios alone do not validate loaded power transmission. No live or baked native simulation is claimed for either model.
