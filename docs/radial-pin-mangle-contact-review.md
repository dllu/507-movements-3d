# 194: finite radial-pin mangle contact

This follows the [192–194 guide pass](reversing-mangle-guides-review.md). Only movement 194 changes; 192/193 tooth cavities, geometry and laws remain untouched. The [primary caption and engraving](https://507movements.com/mm_194.html) specify a single circle of isolated radial pins, equal opposite main-run rates, a guided pinion shaft and a universal drive. The page has neither `ae.add_model` nor `mm_present` definitions. No 2D animation is available.

## Corrected finite geometry

The previous involute pinion penetrated radial pin 6 by 0.064059 at cycle phase 0.90625. A new fixed pinion is cut offline against every full-sized radial pin seat over all four existing motion branches. The source's 25 isolated pins are retained: seats have radius 0.052 and straight length 0.13, while upper pins have radius 0.039 and straight length 0.125. The seats' conservative capsule projections enclose the upper pins too.

The cutter starts with the existing 0.472 outer-radius blank, samples 4,096 full-cycle states, and computes exact ray intersections with each finite capsule. A 0.00045 cutter allowance is applied. The resulting connected pinion has root radius 0.28255, full outer radius 0.472 and the original total axial extent of 0.37, including the former bevel limits. Its shaft aperture is real. Pinion hub, shaft, collar and guide dimensions are not included in the tooth cutter or changed to conceal collisions.

Ten identical teeth are unnecessarily restrictive for this bilateral pin-row geometry. Enforcing that extra symmetry raised the working gap to 0.02587. The implemented fixed profile instead uses **five repeated tooth pairs**. The authored mechanical cycle advances exactly 58 tooth pitches, which is 29 pair periods, so the complete visible profile closes exactly with the existing motion. Both tooth shapes and all pins remain finite solids; this is not a per-frame deformation or floating contact marker.

The 4,000-point profile is baked as a source module. Only the final extrusion is constructed in the browser; no cutter or collision solve runs during playback.

## Finite checks and remaining engagement gap

Independent tests use the rendered profile coordinates (rounded to its actual float32 positions), exact segment-to-capsule distances, and point-in-polygon checks that reject any pin center enclosed by the gear. Positive projected clearance is conservative for all axial slices of the rendered capsule meshes. At 513 full-cycle poses:

| Branch | Minimum clearance | Maximum nearest working gap |
| --- | ---: | ---: |
| Outer run | 0.00038343 | 0.00820852 |
| Right terminal reversal | 0.00010193 | 0.00262851 |
| Inner run | 0.00044990 | 0.00669152 |
| Left terminal reversal | 0.00010193 | 0.00262851 |

The closest witness is pin 0 at phase **0.751953125**, during the left reversal. The largest remaining working separation is pin 5 at phase **0.8671875**, on the outer run. The original pin-6 collision witness is independently rechecked and clear.

This is a **partial mechanical correction**, not proof of continuous loaded engagement. The full finite profile clears the pin row, but the unchanged ideal rolling law still has a sampled gap up to **0.00821**. The regression bounds it at 0.0091 to detect worsening without requiring the residual to persist. Retained radial dimensions and full axial overlap prevent passing merely by shrinking or moving the gear away from the pins.

## Rejected seating law and next work

A bounded diagnostic rotates the candidate pinion forward at each guide pose until a loaded flank approaches a pin. It uses a 0.00005 proximity threshold. The initial 1,025-pose scan found a terminal handoff; refining its interval to 257 poses did not produce continuous pickup. With the final periodic profile:

- Nominal input travel **7.7957958252**: first contact is pin **23**, added pinion phase **0.1101371918**, sampled normal moment **−0.01203146** about the pinion center.
- Nominal input travel **7.7959348422**: first contact switches to pin **24**, added phase **0.1322477264**, sampled normal moment **−0.13934207**.
- The nominal step is only **0.0001390170 rad**, but the seating correction jumps **0.0221105347 rad**. The departing pin has little moment before the switch.

This diagnostic uses profile vertices and edge midpoints to locate a candidate loaded branch; it is not a force simulation or a certified continuous contact solve. Its discontinuous result is **not baked into playback**. It establishes that simply snapping this profile to its next loaded flank is unsuitable, not that every possible pinion/terminal reconstruction is impossible.

The next correction must determine terminal pin placement/shape, adjacent working flanks and the guide/phase transition together. It should preserve the isolated radial-pin topology, finite drive moment, same-sense pinion rotation and the source's equal opposite main-run rates. It must check continuous release and pickup; passive contact/inertia validation may then be useful. No MuJoCo result is claimed here.

## Reproduction and validation

```sh
node scripts/generate-radial-pin-mangle-pinion.mjs
node scripts/study-radial-pin-mangle-seating.mjs
node --test tests/movement-192.test.mjs tests/movement-193.test.mjs tests/movement-194.test.mjs tests/radial-pin-mangle-contact.test.mjs
node --test --test-name-pattern=194 tests/reversing-mangle-finite-guides.test.mjs
```

The first test command passes **19 checks**: all 15 retained source/motion regressions for 192–194 plus four new 194 finite-profile, original-witness, pin-dimension and periodicity checks. The second command passes the **three retained 194 guide/interface/framing cases** (approximately 43 seconds), for **22 passing scoped checks**. Root inspected source/default/oblique browser views with no errors or clipping; maximum normalized extent was 0.70438, with 156 draw calls and 134,112 shadow triangles. This lane did not launch Chrome.

A second generation is byte-identical. SHA-256 of `src/simulation/baked/radial-pin-mangle-pinion.js`: `360a61a8feb2374e00bb6add6a8c5777e3f59b9ec07bfbba5b4428ad618d6dce`.

The viewer explicitly reports the working gap and rejected pickup law. The prior blind guide, accessible front-side universal input, source-facing camera, full-cycle vertex fit, readable timing, fog/ground policy and stable geometry ownership are retained. All sampling checks remain bounded evidence, not an exhaustive load-capacity or dynamic proof.
