# Folding ladders and flexible pipe joints: 386, 387, 468

This bounded family pass retains the analytical motion and replaces obstructed working interfaces with finite bored parts. No physics is run during playback.

## Sources and motion

Primary pages: [386](https://507movements.com/mm_386.html), [387](https://507movements.com/mm_387.html), [468](https://507movements.com/mm_468.html). Both ladder animations were opened and viewed on the official site. The folding ladder preserves parallel rounds and translating side pieces; the tide ladder preserves level treads, equal parallel rails, and constant suspension-rod length. Their existing terminal offsets, event proportions and smooth prescribed timing remain unchanged. Movement 468 has no official canvas animation; its deployment remains a prescribed demonstration of the caption's hinged frames following a river bed.

The official 386 schematic shows five rounds; this reconstruction continues to use the engraving's four. Its rail-end proportions now include enough material beyond the outermost round for a full complementary end shell to clear the folding round. Absolute dimensions, operating force, construction details and animation duration are not specified by Brown.

## Corrections

- **386:** Four constant-length bored rounds replace solid decorative pivot eyes. Smaller pins run through internal bored clevis cheeks, inside the hollow pole cavity. The complementary end shells previously blocked the first/last round during folding. Longer rail ends now accommodate a full fold-offset beyond the outermost pivot, preserving a complete round pole at closure. Unnecessary shell bevels were removed so the closed halves meet without overlap. The white rail index is attached to the actual outside surface.
- **387:** Bored stringers, handrails and suspension rods replace solid eyes. Intermediate tread/rod stations have real bores and pins. Suspension rods occupy a separate axial layer beyond the rear axle tips; extended front axles reach those rods. Tread boards fit between the stringers, fixed end posts sit behind the pivot layer, and the wharf edge clears the first tread. The source's level-tread and constant-length constraints remain exact.
- **468:** Closed hollow spherical joints replace solid balls. Finite sockets transition to bored pipe barrels; their meridians use the hollow-chamber construction already established for 249. Two outboard stub pins replace the transverse shaft that crossed the water passage. Separate bored hinge barrels and trimmed arm ends provide an axle passage without overlapping hinge layers. The nominal 15/18-inch bore ratio and existing frame/chain law remain unchanged; straight barrel ends now meet their finite neck/ball transitions.

All three hide the generic ground and disable fog. Camera bounds cover the prescribed full stroke, with views oriented toward the source's working plane. Existing 387 water-level and 468 river-bed context are retained.

## Validation

`node --test tests/movement-386.test.mjs tests/movement-387.test.mjs tests/movement-468.test.mjs tests/folding-pipe-solids.test.mjs`

**32/32 focused tests pass.** The existing 28 tests check source metadata, rigid-link constraints, prescribed timing, continuity and joint-center alignment. Four additional tests inspect rendered triangle surfaces: 386 rounds/pins against shells and clevises through 65 poses plus the closed shell seam; 387 actual axles against bored rails/rods through 33 poses; 468 balls and upstream necks against sockets through 65 poses; and outboard pins against journals/trimmed arms through 33 poses. The pipe test also checks an empty spherical center and that stub pins remain outside the passage.

Final browser review captured source/default/front/advanced views without errors or clipping; 17-pose maximum projected extents were 0.912, 0.884 and 0.912 for 386, 387 and 468. The cheap 49-update CPU screen reported no scene growth or new playback geometry, with update P95 of 0.018, 0.073 and 0.074 ms respectively (machine-specific, excludes GPU and imports). Final screenshots and CPU screening are temporary review artifacts under `/dev/shm`, not repository dependencies.

## Limits

These are kinematic reconstructions, not structural or load-bearing qualifications. No ladder latch, hand force, buoyancy, pin friction or joint wear is solved. The 468 installation path and prepared bed are prescribed; hauling forces and seabed contact are not simulated. Its spherical seats include geometric clearance without a modeled gasket, pressure seal or fluid solver. Articulation changes the overlapping port area; nominal bore diameter must not be read as a validated full-area flow guarantee at every bend. Finite tests qualify the named interfaces and sampled poses, not every possible object pair or arbitrary out-of-range manipulation.
