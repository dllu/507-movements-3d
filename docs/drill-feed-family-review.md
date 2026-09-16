# Drill and feed family: 366, 379, 380

Primary references: [366](https://507movements.com/mm_366.html), [379](https://507movements.com/mm_379.html), [380](https://507movements.com/mm_380.html). Captions and engravings were inspected; none of the three pages contains an official canvas animation. All retain determinate analytic motion: continuous drill rotation combined with a separate, reversible feed demonstration.

## Corrections

366 now uses the existing back-cone involute bevel-tooth helper instead of tapered rectangular blocks, preserving its tooth counts, common apex and 2:1 law. The tooth roots and bodies share the same conical boundaries. Its previously painted keyway is an actual keyed opening through the pinion body; the feather remains engaged throughout axial travel. The horizontal shaft ends before the vertical shaft, removing their intersection. Shaft guide clearance, feather length and indicator placement now allow the spindle to slide and rotate without crossing the fixed bearings. Rear bridges support those guides without filling their bores.

366's small bevel now sits above the large wheel, matching Brown's mounting. The horizontal drive and its bearing are lower, and the pinion axis points upward. The drill spindle therefore uses the same signed angle as the pinion instead of negating it. A keyed rotating neck and two retaining collars support the fixed-height pinion inside its upper bearing; the feather slides through that neck throughout feed. The bearing bridge clears the neck, and the entire translating thrust stack remains above it. The exact feed linkage and constant 2:1 rotation law remain intact.

The two feed rods use shared bored links in a separate layer, with pins spanning the actual eyes. Lever pivot holes, bored hubs and shaft pins replace filled revolute joints. The thrust collar has a real shaft bore and opposed rotating capture rings; its yoke clears the rotating shaft. The visible crank is mounted at a legible initial phase independently of gear-tooth indexing. The drill point faces downward.

379 and 380 use closed square threads and complementary nut threads from the existing screw geometry helper. Both the nuts and overlapping frame arms have real bores. In 379 the upper spindle now reaches its crank hub, and the drill bearing is bored. In 380 the feed sleeve has a closed inner wall, the cross-handle and thrust collar clear the independent inner spindle, and hollow necks connect the sleeve to its handle and collar. Opposed spindle rings provide visible axial capture with running clearance. Both drill points now face downward at the locations specified by their analytic states; 379's reported work clearance uses the top surface of the rest rather than its center. Rotation indicators sit on their moving parts.

All three use sampled full-cycle camera bounds, source-facing views, no fog and no generic ground plane. Continuous rotation and existing feed schedules are unchanged.

## Validation

`node --test tests/movement-366.test.mjs tests/movement-379.test.mjs tests/movement-380.test.mjs tests/drill-feed-solids.test.mjs`

31 tests pass: 23 existing tests and eight finite-interface tests. Checks cover actual screw/nut/frame surfaces over advance and return, 380's inner spindle through the complete sleeve/handle/collar, thrust-ring capture, downward point positions and real work clearance, 366's sliding feather and guide interfaces, and bored feed-link joints. The corrected upper-pinion arrangement also has a 129-pose check for source placement, bearing engagement, keyed-neck clearance, axial retainers and clearance to the complete moving thrust stack.

A bidirectional surface check samples both 366 gear bodies and teeth at 25 phases across one input tooth period. It found no sampled intrusion; the nearest separation remains about 0.0021 units. The cramp thread checks similarly find no intrusion, with minimum sampled nut-flank separation about 0.0027–0.0029 units. These are bounded finite-geometry checks, not loaded contact simulations.

Final Chrome default/front captures were compared with the engravings, with no browser errors. Seventeen sampled full-cycle poses fit the default viewport: maximum absolute projected coordinates were 0.813, 0.857 and 0.850 for 366, 379 and 380. Captures and browser reports remain temporary artifacts outside Git.

366's corrected upper-pinion layout was also reviewed in default, front and full-feed poses; its maximum projected coordinate remains 0.813, with no browser errors.

## Remaining limits

The bevel teeth use the disclosed Tredgold approximation, not generated octoid flanks. Tooth forces, deflection and wear are not modeled.

The feed schedules, screw dimensions, thrust capture details and clearances are engineering reconstructions. There is no cutting-force or workpiece-removal simulation. Tool points and flutes remain schematic. Tests qualify the named joints and surfaces rather than every fastener and support force path. No live or baked MuJoCo simulation was necessary for these analytic laws.
