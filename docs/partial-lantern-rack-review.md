# Movement 199: partial lantern and opposed mangle racks

This is a bounded finite-flank and journal correction, **not a validated loaded transmission**. The final fifth of each half-stroke still lacks a close positive-driving face under the original animation law. That limitation is visible in the reconstruction note and retained as a regression witness.

## Source and reconstruction

[Brown's movement 199](https://507movements.com/mm_199.html) explicitly calls for larger starting teeth and fewer than half the pinion teeth. The fetched page contains actual inline `ae.add_model("mm_199")` and `window.mm_present=true` definitions. Its oracle has four installed pins on ten virtual pitches, continuous clockwise rotation, and triangular rack translation: source X −15.707963 → 0 → −15.707963 per revolution. Its position is continuous, but its velocity reverses instantaneously. The corrected model retains that law, pin placement, oversized entry teeth, opposed racks and four guide rollers.

The original beveled trapezoids penetrated pin 0 by 0.00963768 model units at cycle phase 0.375. Ten replacement finite profiles are cut offline with the actual source pin circles moving through the prescribed cycle. Expanded blanks preserve useful flanks and the two larger entry teeth; the resulting curves are mechanically inferred, not traced engraving outlines. A 0.00035 circle allowance and 0.000015 outline simplification produce 1,192 outline vertices / 35,043 bytes. No cutter generation runs in the browser.

The lantern hubs, cross spokes, fixed bearing and guide hubs now have shaft bores. Cross spokes reach the lantern rings instead of stopping short. Removing the frame's expanding bevel and raised roller tread indices restores the nominal tangent roller/frame interface. Face indices remain. The default camera is near frontal, fog is disabled and the display cycle has an eight-second minimum.

## Qualification and remaining failure

The focused tests check both directions of actual rendered pin/tooth surfaces at 65 uniformly spaced poses plus two near reversals. Minimum sampled pin/tooth clearance is 0.0003371; reverse tooth/pin clearance is 0.0003421. Six selected early/middle-stroke contacts additionally use actual triangle normals to verify force along frame travel and torque resisting clockwise input. These are geometric contact-direction checks, not solved forces.

At phase 0.99951171875 the nearest surface remains only 0.0003444 away, but its frame-driving component is **−0.930966** and resisting moment **−0.709474**: it retards rather than drives. The nearest candidate with both correct signs is **0.0918035** away. Mere clearance or close proximity therefore does not qualify transfer. The same issue occurs before the opposite reversal. The old nominal pitch-state fields remain solely for source-law compatibility; use `workingParts.finiteContactAtState` / `kinematics.finiteContact` for the rendered surfaces. The viewer no longer displays the ideal pitch point as if it were actual pin contact.

Seventeen journal poses give minimum shaft clearances 0.0039764 (lantern) and 0.0039824 (guide hubs). Roller/frame residual is −1.21e−8, at floating-point tangent tolerance. Position continuity and the source velocity discontinuities are checked explicitly. No MuJoCo result, passive pickup, inertia, impact, friction or loaded reversal is claimed. A future closure needs compatible entry/exit geometry and motion before a unilateral load/contact solve; preserving the oracle is the deliberate limit of this pass.

## Reproduction and cost

Run with Node 18+ and the project's installed npm dependencies:

```sh
node scripts/generate-partial-lantern-rack.mjs --check
node --test tests/partial-lantern-rack-working-parts.test.mjs tests/movement-199.test.mjs
```

Omit `--check` to regenerate. The deterministic cutter sequence is 4,097 samples including both ends of one source cycle, four source pin centers per sample, and 385 height rows per tooth; the script reconstructs from the unchanged source profile metadata. Regeneration is byte identical. Nine tests pass; RAM logs are `/dev/shm/partial-lantern-tests.log` and `/dev/shm/partial-lantern-generation.log`.

The final model has 22,852 visible triangles. An isolated Node sample measured 98 ms first construction, 16–26 ms warm construction and 0.20 ms/update across 1,000 updates. The tests retain GPU position-buffer identity and scene geometry across a cycle. These CPU measurements are illustrative, not a browser performance guarantee. Root's final source/default/oblique views show no errors or clipping (maximum NDC 0.89558); the build and packaged desktop/playback/mobile case pass.
