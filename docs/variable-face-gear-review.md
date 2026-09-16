# Variable face gearing and expanding pulley: 219/224/414

Reviewed the primary captions and engravings for [219](https://507movements.com/mm_219.html), [224](https://507movements.com/mm_224.html) and [414](https://507movements.com/mm_414.html). None supplies an official animation. The analytical motion laws remain scripted; expensive mating-profile generation happens offline. The source drawings were compared beside default/front/advanced local views without tracing decorative details.

## Corrections

**219:** the eccentric circular crown retains its forty equal accumulated pitches, eight-tooth pinion and five mean pinion revolutions per crown revolution. Its former rectangular face teeth now have individual cutter-generated working surfaces. The actual 30° involute pinion sweeps across each finite crown-tooth footprint as it rotates and slides axially. The pinion has a real four-keyway bore clearing the shaft's spline ribs; the crown hub and collars are bored. The front index clears the bore. The presentation rotates the entire mechanism 55° about its crown axis and uses a flatter view, preserving the source's horizontal crown and rising radial shaft. Camera bounds are in the final world frame and cover the full circular crown excursion and shaft ends.

**224:** the former front slot plate was backed by a solid gear disk, and its radial-width slots were too narrow normal to the sloping spiral for the finite studs. Both rotating layers now have true normal-offset slots and a center bore. The 32/10 gear pair uses matching 30° involutes with finite flank clearance. The radial guides now surround their moving arms with sidewalls, a rear support and two narrow retaining lips, rather than sitting below the arms. Their ends clear the contracted rim segments. Stud heads sit below the retaining lips. This remains a diameter-adjustment demonstration; a belt and loaded adjustment are not simulated.

**414:** replaced the decorative conical body and tooth blocks with a tapered involute pinion and a mating face scroll generated from that actual cutter. Its 106 working teeth follow equal accumulated rolling pitch, correcting the former 108 teeth spaced along a different curve length. The wide translucent disk and tubular scroll were replaced by one continuous spiral backing strip supporting the working teeth. The input shaft's feather engages actual keyways in the pinion and hub. The output hub/shaft sit behind the input shaft, with three spokes joining the spiral backing; the two solid shafts no longer cross. The source-facing view looks at the working side of the scroll, and a contrasting first tooth shows plate motion.

All three explicitly disable material fog and omit ground. Timing stays analytical with a minimum twelve-second display cycle; 414 keeps the same smooth input ramps, stops and reverse traversal. The models do not allocate or add geometry during updates. Local cold construction measured about 121 ms / 66,592 visible triangles for 219, 109 ms / 27,424 for 224, and 92 ms / 136,168 for 414; these are local measurements, not guarantees. Baked face heights occupy about 391 KB of source text.

## Finite qualification and limits

The saved report at `docs/validation/219-224-414-contact.json` binds the factory, helper, generated data and auditor source hashes. It checks actual vertices, edge midpoints and triangle centers against the opposite mesh's triangle BVH in both directions, over seventeen interleaved poses per full playback cycle. The 224 study also includes every stud against both slotted gear layers and every arm against its guide walls/support/lips. Separate tests check actual shaft and keyway clearances and stable object/geometry identity over updates. All 27 focused tests pass.

| Movement | Surface queries | Penetrations | Maximum working gap |
| --- | ---: | ---: | ---: |
| 219 | 1,110,604 | 0 | 0.002383 |
| 224 | 6,652,236 | 0 | 0.000951 |
| 414 | 3,203,304 | 0 | 0.001207 |

Initial 219 testing located a tiny intersection at a crown-tooth sidewall and the pinion's axial end cap. It was removed by adding 0.0001 clearance on each side of the crown tooth, rather than relaxing the collision test. Its final cutter-height clearance is 0.0025. The 414 cutter clearance is 0.0015. The report records sampled nonpenetration and working-surface proximity; it is not a continuous force-closure or stress analysis.

Axial following in 219 and 414 remains prescribed by the pitch law. The source does not specify the external guide, preload or thrust forces required to keep the sliding pinion in position. Taper and tooth profiles are inferred, and finite clearance permits backlash. The 414 end stops, unloaded reversal and acceleration ramps are presentation assumptions. Neither mechanism is advertised as a loaded dynamics simulation. The 224 constant-normal-width slot profile and captured guides are inferred dimensions preserving the source's adjustment topology.

## Reproduce

Prerequisites: project Node dependencies, Python, NumPy and SciPy. No native physics solver is needed. Bulk exports and audit artifacts stay in RAM.

```sh
node scripts/export-variable-face-gears.mjs
BAKED_OUTPUT=/dev/shm/variable-face-repro.js python3 scripts/generate-variable-face-gears.py
cmp src/simulation/generated-variable-face-gears.js /dev/shm/variable-face-repro.js
node scripts/review-variable-face-contact.mjs
node scripts/save-variable-face-contact-report.mjs
node --test tests/movement-219.test.mjs tests/movement-224.test.mjs tests/movement-414.test.mjs tests/variable-face-gear-solids.test.mjs
```

Generation samples 4,097 input poses, using the actual involute outline, axial face width, taper and scripted rotations/translations. The crown has forty 9×41 grids; the scroll has 106 9×33 grids. Neighbor-conservative resampling prevents triangle interpolation from bridging a cutter-tip concavity. Coordinates are rounded to seven decimals. The complete generation is deterministic and independent of the previously baked heights; regeneration was verified byte-for-byte. Qualification poses lie between the generating poses. The camera-only root rotation of 219 is applied to both mating meshes for the finite audit; generation uses their unrotated common mechanism frame, which preserves all relative geometry.
