# Movement 237: finite crown-pawl return

The [official caption and engraving](https://507movements.com/mm_237.html) depict a reciprocating top arm, a radially hinged yielding pawl, and an intermittently rotating crown ratchet. The source page has no registered `add_model`/`mm_present` animation; this is an independent reconstruction from the engraving and caption. The existing 20-tooth crown, clockwise one-pitch advance, 26.1-degree arm stroke and source proportions are retained.

## Working correction

The previous law placed the sphere's bottom on an angular height ramp, but the rendered teeth have finite planar triangle faces. It missed both the sphere's normal offset and the crest transition. The prior rendered-solid screen found nose penetration **0.01135582** and body penetration **0.01058852**.

A reproducible offline generator now finds the upper finite-sphere clearance branch against the actual tooth triangles at 2,049 return positions. It follows the ramp with nominal **0.0002** running clearance. After the crest, a short prescribed hold followed by a cubic drop clears the whole sphere. A monotone cubic interpolation provides continuous position and velocity without browser collision solving. The crown teeth and their radial working faces are retained.

The curved pawl shoulder now meets the nose without extending through the ramp. Its radial eye is a real annulus around a separate arm-fixed pin; the arm section fits within the eye opening. The crown disk and lower bearing have actual output-shaft bores. Tooth material alone uses flat shading, leaving the round wheel smooth. Decorative raised crest bars are hidden so they do not become extra obstacles; the actual tooth faces remain visible and intact. The floating pawl index is hidden.

Ground and fog are disabled. Actual visible vertices over a full cycle determine the bounds, the default view is `(5, 3, 12)` to expose the source's vertical output shaft, and the minimum displayed cycle is four seconds.

## Checks

`node --test tests/movement-237.test.mjs tests/crown-pawl-237-contact.test.mjs` passes **13 checks**: eight movement regressions and five finite-contact/interface checks. `node scripts/generate-crown-pawl-237-return.mjs --check` confirms byte-identical regeneration.

| Measured interface | Result |
| --- | --- |
| Enclosing full sphere against actual teeth, 1,025 poses | Minimum −7.63e-9, the float32 drive-seat residual |
| Working ramp gap | Maximum 0.000200054 |
| Rendered nose against actual tooth solids, 65 poses | Minimum +5.66e-8 |
| Curved body against actual tooth solids, 65 poses | Minimum +0.02855656 |
| Actual radial-face clockwise output moment arm | At least 1.551443 |
| Actual ramp-normal moment lifting the radial hinge | At least 0.719691 |
| Hinge eye and crown bore versus shafts | More than 0.0038 clearance |

The checks also cover rigid pawl length, analytical velocities versus finite differences, continuous return/drop, accumulated one-way indexing, source layout, bore alignment, full-cycle visible-vertex framing, fog flags, and stable mesh/geometry identities. The existing long motion checks remain, but obsolete point-height zero-gap assertions now use finite-surface clearance.

## Limits

This is geometric contact reconstruction with prescribed drive, return bias and wheel holding. It is not a gravity, spring, friction or impact simulation. The small running gap does not itself transmit force. The brief crest hold and subsequent drop represent an imposed return schedule; no free-fall claim remains. The source does not depict a holding click, and none has been invented.

The smooth interpolation near ramp pickup changes the gap while the nose is still separated: maximum measured normal relative speed is **0.08751** near return travel 0.195292, at gap about 0.00019964. This is a prescribed clearance transition, not a validated loaded no-penetration velocity constraint. Actual working normals and finite clearances are checked separately. Impact at drive pickup, passive stability, holding torque and load capacity remain unsolved. MuJoCo is unnecessary to reproduce the checked geometry, but would be appropriate for a later force/load study.

## Integrated browser check

Final Chrome source/default/oblique views load without page errors. A 17-pose
visible-vertex sweep has maximum normalized extent 0.721, with no camera
clipping. The default scene uses 76 draws and 21,520 triangles including
shadow passes. The final production build passes in 24.51 seconds, and all three
packaged desktop/playback/mobile cases pass in 9.6 seconds. These browser checks
verify presentation and interaction, not passive contact dynamics. Artifacts
remain outside Git under /dev/shm/family41-*.
