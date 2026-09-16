# Split cams, selectable pin gearing and mixed rolling gearing: 205/208/209

Reviewed the primary engravings/captions for [205](https://507movements.com/mm_205.html), [208](https://507movements.com/mm_208.html) and [209](https://507movements.com/mm_209.html). The official 205 canvas animation was opened and advanced: its two axially separated cams drive the alternating eleven-tooth rows continuously at −1/11 output/input speed. The official 208 and 209 pages have no animation. Default, front and advanced local poses were compared beside the engravings; Chrome reported no errors.

## Mechanical corrections

**205:** retained the existing analytical split 2:22 involute train and its two separate axial tooth planes. Removed bevels that protruded into working flanks, bored both cams/hubs and the wheel/hub for their actual shafts, and applied 0.001 cam flank clearance. A further offline sweep of the mating wheel removes a small tip/root intersection: it retains 99.97% of the clearance-adjusted cam area. The inferred 20° profiles remain a reconstruction of the illustrated cam topology, not dimensions supplied by Brown. The rear and front tooth rows remain staggered by one combined wheel pitch.

**208:** the previous solid decorative blocks occupied the pinion's slots, and its slot roots were too shallow for the actual finite pins. Removed those blocks and cut one common pinion outline from the three sets of actual pin sweeps. The offline cut clips each pin cylinder to the pinion's axial slab before projecting its envelope, so neighboring pins cannot be ignored merely because their centers are off the nominal contact plane. The resulting deeper slots retain 62.98% of the former web/teeth area, with 16 repeated entry openings. Pins now extend into the disk instead of floating above it. The input disk/hub and selector collar have actual shaft bores; interfering pinion face rings were removed. The original stopped, indexed selector sequence and running ratios −11/16, −1 and −21/16 remain unchanged.

**209:** removed the round tube that protruded beyond the intended smooth rolling surface and removed body bevels there. Extended the trapezoid driver-tooth roots into their body; previously their tangential root edges left disconnected tooth fragments. The right wheel is now an offline envelope cut by that actual left wheel under the focus-ellipse motion law. The new connected mate retains 98.06% of the original connected body/tooth area. Both hubs are bored for their shafts. The left teeth are the source-shaped cutter; this is a generated mating pair, not a claim that the left trapezoids are standard involutes.

All three omit invented frames/ground, explicitly disable material fog, favor the source-facing camera and retain readable scripted timing. Expensive cutting happens offline. Local cold factory measurements were about 118 ms / 32,188 visible triangles for 205, 19 ms / 16,508 for 208, and 94 ms / 55,188 for 209. The two baked files total approximately 270 KB of source text. These local measurements are not runtime guarantees.

## Qualification and remaining limits

`docs/validation/205-208-209-contact.json` binds the actual scoped factories and geometry to the saved evidence:

| Movement | Samples | Finite evidence | Largest working gap |
| --- | ---: | --- | ---: |
| 205 | 513 interleaved input poses | Each actual cam versus its complete mating tooth row; zero projected solid overlap | 0.001057 |
| 208 | 99 running + 68 stopped-selector poses | 976,752 actual pin surface queries against the pinion/web triangle BVH; zero sampled penetration | 0.001663 |
| 209 | 513 interleaved input poses | Actual connected wheel body/tooth projections; zero projected solid overlap | 0.000717 |

205 and 209 have parallel planar gear solids, so projections test finite working-profile interference directly. 208 uses the actual finite pin mesh, its vertices, edge midpoints and triangle centers, and the generated finite pinion. Its largest clearance including the deliberately disengaged selector intervals is 0.012155. These are sampled geometric checks, not exhaustive continuous collision or force-closure proofs. Separate tests check the actual shaft bores. Existing analytical state tests continue checking ratios and continuity.

The 208 speed law remains prescribed, and its finite running clearance allows backlash. The demonstration changes rings only while stopped and indexed; loaded shifting and selector forces are not modeled. The 209 ideal smooth-rolling law remains prescribed; finite manufactured clearance is not a contact-force simulation. Its fork is explicitly an illustrative entry guide in a separate front layer, about 0.068 beyond the main driver face at its closest axial extent, rather than a qualified loaded catch. The underlying ellipse dimensions and all clearances are inferred.

A small related correction reverses the hole paths in the prior 221–223 geometry: the baked 221/223 outlines and 222’s eccentric driver bores. Three.js only automatically reverses hole winding when it also reverses the exterior, so clockwise Shapely exteriors need explicit counterclockwise holes. This corrects bore-wall normals without changing the contact outlines. The prior 221–223 report was regenerated; all sampled contacts remain clear, and 23 tests pass including a direct bore-normal check. The new 205/208/209 suites pass 19 tests.

## Reproduce

Prerequisites: installed project Node dependencies and Python with Shapely (reviewed with 2.0.3). The scripts preserve unmodified generation geometry separately from the rendered baked profiles; rebaking does not cut an already-cut profile again. Both generated files were reproduced byte-for-byte. Bulk inputs and comparison artifacts stay under `/dev/shm`.

```sh
node scripts/export-205-209-contact.mjs
BAKED_OUTPUT=/dev/shm/205-209-repro.js python3 scripts/generate-205-209-profiles.py
cmp src/simulation/generated-variable-drive-205-209.js /dev/shm/205-209-repro.js
node scripts/export-208-pin-envelope.mjs
BAKED_OUTPUT=/dev/shm/208-repro.js python3 scripts/generate-208-pin-envelope.py
cmp src/simulation/generated-pin-slot-208.js /dev/shm/208-repro.js
python3 scripts/review-205-209-contact.py
node scripts/review-208-pin-slots.mjs
node scripts/save-205-208-209-contact-report.mjs
node --test tests/movement-205.test.mjs tests/movement-208.test.mjs tests/movement-209.test.mjs tests/variable-drive-205-209-solids.test.mjs
```

205 and 209 use 4,097 generation poses per input revolution and independent interleaved qualification poses. Their additional sweep clearances are 0.0005 and 0.0007 respectively. 208 uses 513 generation poses per pin pitch for each of three rings, clips cylinder triangles to the ±0.055 axial slab, buffers their silhouettes by 0.001, repeats the cut at sixteen slot angles and simplifies by 0.00015. Generated coordinates are rounded to seven decimals. No browser-time envelope construction or live physics allocation is added.
