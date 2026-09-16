# Movements 190 and 285: screw solids and passages

Reviewed against the [190 screw-clamp](https://507movements.com/mm_190.html) and [285 lathe head](https://507movements.com/mm_285.html) captions and local original engravings on 2026-09-15. Neither page contains an `ae.add_model` or `mm_present` animation definition; no official animated motion oracle was available. The existing timing, handedness and lead laws remain independently reconstructed.

## Concrete corrections

Both mechanisms previously represented the external screw thread as a round coil whose root did not reach the screw core. Their nuts were solid cylinders or hexagons. Movement 285 additionally had a 0.029-unit radial gap between its external and internal coils, so those coils could not transmit axial force.

The rendered threads now reuse `mujoco-screw/thread-geometry.js`: finite square-thread flanks join the screw core, overlap the mating internal thread radially, and terminate at actual bored nut walls. Crest/root running clearance is 0.004 units; the inferred axial running allowance is 0.002 per flank. The square section and clearances are reconstructions, not dimensions specified by Brown. The remaining helix curves in diagnostic metadata describe nominal phase loci, not the new solid boundaries.

For 190 the lower arm is thick enough to retain front/rear material around an actual vertical screw passage. A matching passage through the bench clears the retracted screw. The main support outline, lever, shoe and source working centers are preserved. The hex nut has a finite bore and chamfered faces.

For 285 the transparent cutaway quill is now an actual tube. Fixed end cheeks have bored passages, and two inferred bearing lands maintain quill support across its full travel. The key guide has a real channel; the white quill index also clears it. Casting columns stop below the moving cylinder and meet the base, correcting both interference and the former gap above the base. The default camera views the pointed center from the left. Both models disable fog and ground.

## Verification

Run:

```sh
node --test tests/movement-190.test.mjs tests/movement-285.test.mjs tests/clamp-tailstock-solids.test.mjs tests/clamp-190-thrust-support.test.mjs
```

The new regression samples actual rendered vertices in both directions through 25 cycle positions, testing external/internal threads, screw/core versus nut and passages, plus the lathe quill/key/index versus its guides. This is a bounded finite-surface regression, not a proof of continuous collision freedom for every part. An independent triangle distance query finds mating flank gaps of 0.002060 for 190 and 0.001966 for 285 at radius 0.18; the gap stays bounded throughout the prescribed cycle. The tests also require radial engagement, integral thread roots, true guide bores and casting/base continuity.

Default, front and advanced rear captures were reviewed beside the source plates. The default-camera sweep samples all visible vertices at 65 cycle positions and found zero clipped vertices for both movements, including the final 285 camera. Review artifacts and logs remain under `/dev/shm/screw-review-*` and `/dev/shm/190285-*`, outside Git.

## Remaining limits

These remain prescribed screw-law animations; no passive MuJoCo solve, friction, force balance, backlash take-up or load response is claimed. Analytic motion is sufficient for the determinate screw pair, but the small running clearance is not simulated as dynamic backlash. White contact markers and normal/velocity metadata retain their ideal pitch-constraint meaning.

Movement 190's former thrust-collar fault is resolved by the finite support construction below. Holder release/return is still an imposed operator sequence, and the shoe's gravity alignment is prescribed; no unsupported claim of passive opening is made. The 285 tube, hidden nut, bearing lands and keyway depths are inferred cutaway construction; the source does not specify those sections or the four-turn demonstration stroke.


## Follow-up: finite thrust support in 190

The previous 65-pose diagnostic measured collar/cheek separation between -0.007293 and +0.004552 units: the screw-axis intersection law alternately penetrated and gapped. The correction preserves the 0.29-radius collar and both 0.12-thick cheeks. Their inner faces are at z = ±0.26. The hand-drawn lower bearing edge is normalized by two source pixels into a straight machined land, and this edge is left unbeveled. The white collar index is moved onto the side face so its former over-height box cannot become an accidental bearing.

For the operating holder angles -0.14 ≤ θ ≤ 0, the first two contacts lie at x = screwAxisX + sqrt(0.29² - 0.26²), z = ±0.26. The x offset is 0.128452. The collar top follows the transformed land at this x, giving a 0.252622-unit screw stroke (1.486009 turns). Thread phase, smooth event timing and the fully clamped source pose remain consistent. The force ratio now follows the actual reaction moment, including its horizontal component.

This is a finite-envelope construction: where the collar overlaps either cheek, its positive x extent cannot exceed sqrt(radius² - innerZ²). Because the land slopes downward toward positive x throughout the operating range, its minimum height occurs at the selected edge contact; every other overlapping collar point lies below it. The rendered 512-sided collar is inscribed in that circle. Two equal permissible edge reactions have positive vertical components and opposite depth components; their depth forces cancel and their resultant closes the holder. The shared normal lies in both the collar rim/top normal cone and the cheek bottom/inner-edge normal cone.

`clamp-190-thrust-support.test.mjs` checks actual collar/cheek/index solids in both directions over 65 poses, near-coincident contact points, compatible normals, force ratio and positive closing torque. Restoring the old axis-only travel must produce at least 0.012 units of penetration. The corrected contact point is within 0.000005466 units of the actual collar triangles (the circular-mesh sagitta), with no sampled penetration beyond floating-point tolerance. Minimum closing moment per unit single-contact reaction is 1.760452. This analytical constraint needs no iterative contact physics or baked trajectory. Friction, wear, compliance and passive return remain outside the qualification.

The final default/front/advanced review retained the source layout, and all visible vertices stayed inside the default frustum at 65 poses. Follow-up artifacts are in `/dev/shm/190-thrust-*`; the default/front/rear screenshots reuse `/dev/shm/screw-review-190-*`.
