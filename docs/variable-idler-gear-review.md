# Variable gearing: 221–223

Reviewed the [221 engraving and caption](https://507movements.com/mm_221.html), [222](https://507movements.com/mm_222.html), and [223](https://507movements.com/mm_223.html). The official 222 and 223 canvas animations were opened and advanced; 221 has no supplied animation. The eccentric circular drive in 222 and the four output intervals in 223 agree with the existing analytical motion. The official 223 page explicitly warns that its transition teeth need modification and its animation jams at changeovers.

## Corrections

- **221:** the focus-mounted elliptical driver now uses an offline envelope cut by the actual 15-tooth carried pinion. Its circular pairs use matching 25° involutes with correct tooth phase. The compound spindle, carrier eyes and roller are bored; the roller clears its parallel offset groove by 0.003 model units and the spindle clears the groove floor. A continuous bored driver hub connects the front wheel to its rear guide plate. The output shaft ends before that rotating plate.
- **222:** the 24/18/24 circular train uses matching 25° involutes. The eccentric driver has separate actual bores for its geometric-center link pivot and eccentric drive shaft. Both connecting links have bored eyes, and the center pivot reaches the driver body. Redundant solid collars were removed; the drive shaft ends before the moving link layer.
- **223:** four axially separated sector pairs retain the source speed ratios −1/3, −2/3, −7/3 and −2/3. Their 20° involute teeth have finite flank clearance. Offline swept relief removes the output-sector transition intersections; the sector hubs have actual shaft bores. Indicators clear the bores. The four prescribed velocity intervals remain discontinuous at handoff: **continuous loaded engagement is not modeled**. Relief is not proof that this could transmit torque smoothly through the speed jumps.

All three retain their analytical motion and use a minimum 12-second display cycle, explicit fog-free materials and no ground. Cameras favor the engraving view while preserving enough obliquity to distinguish the axial layers. Default/front/advanced poses were compared beside the original engravings. No manual contour tracing or live contact solver is needed.

## Evidence and limits

`docs/validation/221-222-223-contact.json` records intersections of actual rendered gear triangle projections. All paired solids have parallel axes and matching axial layers, so their planar intersections test finite tooth interference directly. There are 513 full-cycle poses each for 221 and 222, and 538 for 223, including samples immediately before/at/after every handoff. All sampled pair overlaps are zero. Maximum working-pair gaps are approximately 0.001013 for 221 and 0.000975 for 222. The 223 handoff gap is explicitly bounded by the saved report and test at less than 0.007; this is larger than its ordinary flank clearance and is consistent with its limited prescribed-handoff model.

`tests/variable-idler-solids.test.mjs` also checks actual finite surfaces at 17 input poses: 221 roller/spindle/shaft versus the groove and carrier; 222 eccentric bore, link eyes, shafts and link separation; and 223 shaft bores. This is selected interference evidence, not an exhaustive collision proof for every accessory or a force/durability study. The original continuous analytical laws and gear ratios remain covered by the movement-specific suites. The 221 ellipse dimensions, groove width and pressure angles are inferred reconstruction choices; the engraving does not specify manufacturing data.

The baked outlines total about 202 KB of source text. A cold Node construction measurement was approximately 291 ms / 69,684 visible triangles for 221, 68 ms / 31,288 for 222, and 38 ms / 37,236 for 223. These are local measurements, not timing guarantees. Full-cycle expensive profile cutting occurs offline; runtime only extrudes the baked outlines. Chrome review produced no page errors.

## Reproduce

Prerequisites: project Node dependencies and Python with Shapely (reviewed with 2.0.3). Bulk triangle exports and comparison files stay in RAM. The exporter retains the original untrimmed 223 sector web and hidden original teeth specifically so regeneration does not repeatedly trim the already-baked result.

```sh
node scripts/export-variable-idler-contact.mjs
BAKED_OUTPUT=/dev/shm/ellipse-repro.js python3 scripts/generate-elliptical-idler-profile.py
BAKED_OUTPUT=/dev/shm/sector-repro.js python3 scripts/generate-stepped-sector-relief.py
cmp src/simulation/generated-elliptical-idler-profile.js /dev/shm/ellipse-repro.js
cmp src/simulation/generated-stepped-sector-relief.js /dev/shm/sector-repro.js
python3 scripts/review-variable-idler-contact.py
node --test tests/movement-221.test.mjs tests/movement-222.test.mjs tests/movement-223.test.mjs tests/variable-idler-solids.test.mjs
```

The ellipse cutter follows 4,097 poses of the actual carried pinion over one input period, using 0.001 clearance and 0.00005 outline simplification. Each 223 output sector is cut by its actual mating driver swept through 4,097 poses, using 0.0008 clearance and 0.00002 simplification. Only the connected main output body is retained. Coordinates are rounded to seven decimals. The independent qualification poses are interleaved between the generation poses; source hashes bind the report to geometry and motion code.
