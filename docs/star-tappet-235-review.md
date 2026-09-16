# Movement 235: spring-held tappet and six-point star

The correction closes the axial working gap, reverses the erroneous driving-face reaction, and replaces jumping holding/return branches with continuous, offline prescribed paths. It does **not** validate passive spring forces, loaded handoff, friction or impact.

## Source and mechanical corrections

[Brown's movement 235](https://507movements.com/mm_235.html) describes an oscillating arm, a separately hinged tappet held by its small spring during the rising drive, and yielding return over the star teeth. Its engraving also shows the upper holding click. The fetched HTML has no inline `add_model`, `mm_present` program or animation canvas; availability was checked beyond the initial tab CSS. The source pin centers, six-point star, hinged tappet, under-arm leaf spring and holding-click topology are retained. Dimensions, stroke and return timing remain inferred.

Both old noses ended at Z 0.18 while the wheel ended at 0.15, leaving a 0.03 gap. They now have finite stepped depth intersecting the star's working layer while the backing tappet remains in front. A 0.0005 radial construction clearance separates each actual nose from its nominal follower circle.

The former nominal drive selected the falling flank and generated clockwise compressive torque while prescribing counterclockwise rotation. The revised closure uses the rising flank (25° root-to-tip angular span; the complementary falling flank spans 35°). Its mount phase and required arm swing are recomputed to advance exactly one tooth. Arbitrary upward overtravel after the drive was incompatible with that working face, so the arm now dwells at the drive endpoint before returning. This dwell and the smaller stroke are reconstruction choices, not an unavailable animation's timing.

The old holding solver also jumped by about 0.117 rad in one 1/2048-cycle interval. The replacement return/drop paths are computed offline in bounded configuration space: 1,001 cycle samples, 0.006-rad angular grid, at most three grid steps per cycle sample, and three intermediate clearance checks per transition. Endpoint seating and the rigid drive are constraints. Runtime uses linear interpolation of two small tables (7,485 bytes); the paths are position-continuous but their angular velocities have corners. The nominal input/drive law remains analytic. This is prescribed clearance motion, not a spring or unilateral-contact simulation.

The tappet has a smooth quadratic hooked silhouette and the carrier a narrow round-ended strip, preserving the solved hinge and tip rather than tracing ornament. The white wheel index is seated on its central hub face. Carrier and tappet plates now have real bored pivots, an actual hinge pin connects them, and the holding click is a closed bored plate. Bearing rings match the finite shaft radii. The output hub bore now meets its shaft instead of leaving a broad unsupported annular gap. The leaf spring and clamp are moved into the arm/tappet layers and connected by a small clamp bridge. The camera faces the source plate, fog and ground are disabled, and the displayed cycle is at least six seconds.

## Focused evidence and limits

Actual rendered surfaces are checked in both directions over 129 poses, including backing plates, the opposing noses, nearby hardware and journal passages. The maximum sampled driving gap is 0.0005355; the maximum seated holding gap is 0.0005188. Actual triangle normals at selected drive and holding phases give positive counterclockwise moment arms of at least 0.50702. Seventeen journal poses give approximately 0.00397 clearance. The separated carrier/tappet layers clear by 0.025.

An independent 8,193-pose circle/profile check gives minimum working-circle clearance 0.0004391 and maximum per-sample angular change 0.002497 rad, including the old holding-branch jump. The holding click returns to its seat before wheel dwell; drive advances one sixth-turn and six cycles close. These checks establish sampled geometry, continuity and useful reaction direction, **not force balance or passive selection of the prescribed paths**. Small construction backlash remains, and the bias needed for anticipatory lift/drop and transfer is imposed. No MuJoCo result is claimed. Spring rubbing and elastic stress are not qualified.

## Reproduction

With Node 18+ and installed project dependencies:

```sh
node scripts/generate-star-tappet-paths.mjs --check
node --test tests/star-tappet-working-parts.test.mjs tests/movement-235.test.mjs
```

Omit `--check` to rebake; the generator consumes the exposed nominal analytic state, rather than recursively consuming its own baked output. Regeneration is byte-identical; all 13 focused and legacy checks pass in 3.91 seconds. Logs are `/dev/shm/star235-tests.log` and `/dev/shm/star235-bake.log`; root performs the final shared source/default/oblique and packaged browser review.

The model has 12,088 visible triangles. One isolated Node measurement gave 105 ms first construction, 16–24 ms warm construction, and 0.25 ms per update over 1,000 updates. Tests preserve position-buffer identity, including the existing in-place leaf-spring updater. These measurements are illustrative CPU costs, not browser guarantees.

Root's final source/default/oblique views confirm the curved hook, narrow carrier and flush hub index, with no browser errors or clipping (NDC 0.83665). The final build and packaged desktop/playback/mobile case pass.
