# Vibrating-rod and direct-action parallel motions: 337–341

Primary references: [337](https://507movements.com/mm_337.html), [338](https://507movements.com/mm_338.html), [339](https://507movements.com/mm_339.html), [340](https://507movements.com/mm_340.html), [341](https://507movements.com/mm_341.html). All five provide official canvas animations. The captions, engravings and inline animation constructions were reviewed together.

## Motion and source decisions

The existing analytic laws are retained. 337 places its piston on the vibrating rod's midpoint; 338 places the radius bar above the beam and its piston below the beam joint. Their slightly curved piston paths are the intended approximate parallel motions. 339 uses the exact midpoint of a rigid bar joining perpendicular sliders, so its midpoint radius is exactly half the bar length.

340 already corrects the canvas's short radius bar from 4.742772 to 4.789956 source units to close the real linkage at reversal. Its prior discrepancy metadata remains intact. 341 retains the official animation's deliberate relocation of the radius joint to the beam center; the source site explicitly explains why Brown's engraved location does not produce the intended parallel motion. Its simultaneous rigid-link solution also retains the previous sub-0.000442-source-unit correction to the rounded canvas construction. No new physics simulation is needed for these determined linkages.

## Shared corrections

The two family modules now reuse `bored-link-rod.js` instead of duplicating solid shanks, solid bosses and decorative torus eyes. The replacement rods have actual pin holes through their full thickness, including the intermediate stations of 337, 338 and 339. Existing anchor positions and motion laws remain unchanged.

337/338 fixed radius axles now reach their moving eyes. The previously short pillar pins in 340/341 span the full moving-rod depth. The fixed radius bearings in 339–341 sit behind their rotating bars instead of occupying the same axial layer; their shafts bridge the resulting separation.

339's sliding block previously sat wholly in front of its guide. It now occupies the depth between the guide rails, has a real pin bore, and connects to the forward bar through an extended pin. A rear support joins the slot to the engine frame while clearing the sliding shoe. The piston pin also now reaches the rear crosshead layer.

All five use the shared piston-family full-stroke camera fit, a view close to the source elevation, and no fog or ground plane. The existing four-second cycles are retained.

## Validation

`node --test tests/movement-337.test.mjs tests/movement-338.test.mjs tests/movement-339.test.mjs tests/movement-340.test.mjs tests/movement-341.test.mjs tests/vibrating-direct-action-solids.test.mjs`

49 tests pass: 40 existing kinematic/rendering tests and nine finite-part checks. The new tests raycast each actual moving-pin cross-section through the rod holes at 33 poses, check full axial engagement of fixed and moving pins, verify 339's slider containment and support clearances at 65 poses, and verify rear-bearing separation in 339–341. The obsolete 339 pin-depth and overall-depth expectations were updated for the corrected axial assembly.

Default/front browser captures and 17-pose projected-mesh checks reported no page errors. Maximum absolute screen coordinates for 337–341 were 0.885, 0.861, 0.879, 0.852 and 0.832, all inside the viewport. A final 339 default/advanced recapture after the static slot-support addition also passes, with a 17-pose maximum coordinate of 0.880 and no page errors.

## Remaining limits

This is a bounded rod/slider/axial-assembly pass, not a complete collision qualification. Legacy beam plates, crossheads, crank disks and their bosses still contain solid-joint approximations; the new tests qualify the shared rods and selected slot/bearing interfaces, not every solid pair. The frames and long explanatory piston extensions in 337–340 remain more elaborate than the engraving. In particular, 339's retained canvas-length piston extends far below the drawn frame, and the source slot's curved casting is represented by a simple rear bridge. 340's hidden drive and 341's center-radius relocation remain documented reconstruction choices. No irregular silhouette tracing was needed to establish these constraints.
