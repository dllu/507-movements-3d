# Movements 183–184: finite interfaces, working catch still unresolved

This pass corrects source presentation and several real structural collisions. **Neither movement is a qualified working catch.** It retains the prescribed XY motion and the full retaining pins/bands, including their known interference. The earlier [183 baseline and unqualified native controls](movement-183.md) remain relevant to the unresolved transfer.

## Source and installed changes

The [183 caption](https://507movements.com/mm_183.html) and [184 caption](https://507movements.com/mm_184.html) describe a modification of 181–182 in which two quadrants replace the diagonal catches. Both actual page bodies were checked: neither registers an `ae.add_model` nor an `mm_present` animation. The two engravings are pose references, not a timed animation oracle.

The upper and lower handles now occupy separate finite planes, Z=−0.20 and +0.16. Their formerly crossed curved plates and hubs clear each other. Both working-arm plates, back-weight arms and quadrant spokes have real 0.116-radius bores around the 0.11-radius fixed shafts. Bored sleeves join each handle hub to its quadrant web; their 0.23 outer radius overlaps the radial spokes rather than ending just short of them. New small rear journals and a compact bored support replace the large added guide/frame assembly. The old guide and crossbars are absent from the visible assembly.

The hanging-weight connectors have matching 0.052-radius bores through the 0.045-radius pins' eyes and arm ends. The hanging rods remain vertical; axial pin extensions connect them to the handle eyes. The front quadrant layers are +0.44/+0.76 and remain mechanically connected to the handle layers by the sleeves.

The piston rod is a 0.40-unit-wide broken-end section spanning both drawn working regions. Its material section remains in a fixed viewing window while the attached tappet translates. This follows the source's interrupted rod, rather than inventing finite rod endpoints that sweep out of the mechanism. The rod lies behind the handles; the finite tappet projects across both handle layers. The source supplies no axial dimensions, so this stack is inferred.

Raised outline tubes and floating white indices were removed from the visible assembly. Working plate outlines, the finite retaining pins, complete quadrant bands and their prescribed XY motion were preserved. The rims remain thicker, and the spokes/handle curves simpler, than the engraving; those are explicit source-fit residuals, not a finished silhouette reconstruction. No hidden retaining ledge was added to make the old schedule appear valid.

Default views face the source plane. Full-cycle actual visible vertices determine `sampledMotionBounds`; fog and ground are off. An 18-second authored cycle displays in at least 12 seconds.

## Why the contact shortcut was rejected

The upper retaining pin starts well inside the lower annular band. Thinning the band until its inner circular surface just meets the full pin would remove overlap, but that surface's normalized reaction moment on the upper handle is **−1.49246**, assisting the clockwise gravity torque rather than retaining the handle.

A correctly sided radial terminal would instead produce a useful **+1.12984** moment. However, the current synchronized angular law immediately drives the full pin into that terminal: initial signed-gap derivative is **−3.10694 model units per unit transfer parameter**. Initial constrained motion would have to lift the upper handle counter-clockwise as the piston turns the lower handle clockwise; the existing law rotates both clockwise immediately. The piston also leaves the lower arm before the full lower source-angle transfer. A valid reconstruction therefore needs the falling upper weight to drive the remainder through a real quadrant contact and then hand over retention. Merely changing a radius or cutting out all swept pin volume cannot establish that mechanism.

The next working pass should solve that coupled terminal/handle branch while the lower handle is still supported by the shoe, followed by the reverse transfer. The existing bounded MuJoCo controls already show why deleting either retaining pair fails. This pass runs no new native parameter sweep and installs no physics bake. Production remains prescribed; the existing native module stays an unqualified diagnostic.

## Validation and measured residuals

The 13 focused checks pass: two retained source/kinematic regressions and 11 finite interface/framing checks. Passing the old point-law checks does not qualify the catch.

- Actual shafts versus bored plates, hubs, sleeves, journals and rear support, in both surface directions over 65 poses: minimum sampled clearance **0.00586028** model units.
- Weight connectors versus real eye/arm bores: minimum **0.00693733**.
- Both formerly crossed handle plate/hub sets occupy disjoint finite depth intervals throughout the cycle.
- Sleeve/hub/spoke attachments have finite overlap, and the enlarged sleeves clear the opposite curved working arm over 129 poses.
- The finite rod stays attached to the tappet. Its section bounds, full-cycle framing, mesh count and geometry identities remain stable.

A separate 65-pose diagnostic preserves exact named working defects. Times below are the 183 cycle; 184 is the same prescribed cycle with a phase offset.

| Actual pair | Penetration | Time |
| --- | ---: | ---: |
| Upper retaining pin / lower quadrant band | 0.0869913 | 15.46875 s |
| Lower retaining pin / upper quadrant band | 0.0738000 | 5.34375 s |
| Upper rounded working tip / tappet | 0.163631 | 5.0625 s |
| Lower rounded working tip / tappet | 0.186152 | 12.65625 s |

These are **known intersections**, not sampled-clear status. The revised axial stack changes their finite overlap depths; it does not repair their XY contact law. Other working/body pairs have not received an exhaustive new assembly audit.

Root independently inspected the candidate default and oblique views against both sources: no browser errors or clipping, maximum normalized extent 0.89265. It confirmed the structural improvements and the remaining thick-rim/simplified-contour difference. The subsequent sleeve-radius correction stays inside the existing hub silhouette. Captures are in `/dev/shm/family48-quadrant-source` and are not shipped assets.

Reproduce:

```sh
node --test tests/quadrant-catch-finite-interfaces.test.mjs tests/movement-183.test.mjs tests/movement-184.test.mjs
node scripts/review-quadrant-catch-interface-witnesses.mjs /dev/shm/quadrant-interface-witnesses.json
```

The witness command reports known failures and intentionally does not label them a pass. Bulk artifacts remain outside Git. The source/force limitations also appear in each model's viewer reconstruction note.

Final integration passes the production build (22.88 seconds), scoped CPU screen
and all seven packaged desktop/playback/mobile cases (18.4 seconds). The CPU
screen excludes imports and GPU work. See [review progress](review-progress.md)
for the combined pass record. Final 183/184 views include the corrected sleeves.
