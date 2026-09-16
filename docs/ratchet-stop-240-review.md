# Movement 240: three alternative ratchet stops

This bounded correction adds real working toes and bored interfaces to the hook, straight gravity stop and spring stop. The alternatives retain the source comparison layout and are selected one at a time. Their free-running lift/drop and selection remain prescribed; this is not an unlimited-load or passive-dynamics validation.

## Source and reconstruction

[Brown's movement 240](https://507movements.com/mm_240.html) is a comparison of ratchet stops. It does not specify an input actuator or timing. The fetched source contains no animation canvas, inline `add_model` registration or `mm_present` assignment. The engraving supplies the hook, straight stop, lower spring arrangement and shared wheel. The existing eighteen-tooth wheel and source pivot locations are retained; tooth dimensions and demonstration timing remain inferred.

Previously every working body was 0.0484 model units in front of the wheel, so the point-contact animation did not create finite engagement. Each alternative now has a rounded stepped toe spanning Z −0.03 through 0.43 against the wheel's −0.16 through 0.16 layer. Its nominal center is offset 0.065 from the actual retaining face, with an actual radius of 0.0645. The seat is midway along the useful face rather than at its ambiguous root corner. A short plate connects the toe to the existing source-shaped backing body. These extensions are inferred finite geometry, not exact engraving contours.

Hook and straight plates have real pivot bores. Their collars, the spring anchor collar and the wheel hub match their finite shafts. The lower spring/pawl connection has a bored eye and an actual attachment pin. The lower stop still uses the original prescribed flexure about its fixed anchor; it is not a solved elastic beam or independently validated passive hinge law.

The continuous free-run/drop paths are baked offline. Each uses 513 samples across one tooth, a 0.002-rad angular grid and a maximum five grid steps per sample, with three intermediate clearance checks per transition. Endpoints seat on the retaining face. Runtime interpolates three tables totaling 8,894 bytes; no search or collision generation runs in the browser. The old thousands-of-intersections construction sweep is replaced by baked maxima. Selection/lowering/parking remain smooth analytic demonstrations. Free-run path position is continuous, but velocity corners remain at table knots.

The default camera faces the source plate, ground and fog are disabled, and a comparison cycle takes at least twelve displayed seconds. Floating diagnostic contact spheres and stop witness bars are hidden. The wheel's shortened white index sits flush within the root disk.

## Finite evidence and limits

The focused suite uses actual visible triangle geometry:

- 135 full-cycle/seat poses, checking both directions of toe/wheel surfaces, all backing bodies and the opposing toes. Maximum sampled seated gap is **0.0005222**. Backing bodies remain 0.07 clear of the wheel.
- Actual face normals at each seated alternative give a clockwise retaining moment arm of at least **1.825545** in magnitude, resisting counterclockwise wheel rollback.
- The same reactions produce **opening moments** about the stops' pivots. Gravity or spring preload is required. These geometries are not claimed to be self-locking, and load capacity is unvalidated.
- 8,193 states across selection, free run and drop have minimum working-circle clearance **0.0005** and maximum per-sample angular change **0.001783 rad**. No branch teleport remains. The prescribed free-run lift can open a gap up to approximately **0.0816**; continuous riding contact or force-following is not claimed.
- Seventeen journal poses give minimum clearances approximately **0.00396–0.00397**, including the spring attachment and wheel hub. Scene geometry and position buffers remain stable.

The one-tooth clockwise steps and six-cycle closure are retained. Legacy tests now distinguish a selected stop from actual close contact and a finite toe center from its surface point. Their derivative checks apply away from table knots. No MuJoCo result, gravity equilibrium, elastic restoring force, impact or friction validation is claimed. Spring stress and rubbing contacts are outside this bounded pass.

## Reproduction

Use Node 18+ with the project's npm dependencies installed:

```sh
node scripts/generate-ratchet-stop-240-paths.mjs --check
node --test tests/ratchet-stop-240-working-parts.test.mjs tests/movement-240.test.mjs
```

Omit `--check` to regenerate. The generator uses the fixed source pivot/face geometry and one clockwise tooth rotation, independently of the runtime follower tables. Regeneration is byte-identical. All **13 tests pass** in 3.87 seconds. RAM logs are `/dev/shm/stops240-tests.log` and `/dev/shm/stops240-bake.log`.

Final visible geometry totals **8,564 triangles**. Root's integrated CPU screen measured 83 ms construction and 1.28 ms P95 update, with no scene or buffer growth. Root performs source/default/oblique and packaged browser checks centrally; those measurements and sampled checks are not exhaustive collision or performance certification.

## Integrated browser check

Final Chrome source/default/oblique views load without page errors. A 17-pose
visible-vertex sweep has maximum normalized extent 0.829, with no camera
clipping. The default scene uses 90 draws and 17,128 triangles including
shadow passes. The final production build passes in 24.51 seconds, and all three
packaged desktop/playback/mobile cases pass in 9.6 seconds. These browser checks
verify presentation and interaction, not passive contact dynamics. Artifacts
remain outside Git under /dev/shm/family41-*.
