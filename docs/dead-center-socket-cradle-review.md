# Dead-center crank, spatial sockets and rocking cradle: 401, 417, 419

Primary references: [401](https://507movements.com/mm_401.html), [417](https://507movements.com/mm_417.html), [419](https://507movements.com/mm_419.html). The captions and engravings were compared with the models. 401 and 417 have no embedded official animation; 419 has a canvas construction, whose linkage proportions, roller/band routing and post elevation were inspected.

## Bounded corrections

401 retains the smooth pressure/advance/return schedule and exact constant-length treadle closure. The slot bevel previously consumed almost all of its nominal pin clearance; the slots now have square walls. Guide pins reach the rotating faceplate, a real stop receives the spring-returned slide, and the spring has visible inner and slide attachments. The pitman uses the shared bored-link component, with both actual pins spanning its separate forward layer. The faceplate, hub, shaft bearings, treadle shank and fulcrum boss have real shaft holes. Moving the pitman forward clears the wrist boss and guide pins. The faceplate now reaches its rim, closing the former unsupported annular gap.

417 retains the spatial square-root closure, including its derivatives and half-turn extreme poses. The lower ball now sits exactly at the analytic rod endpoint rather than 0.08 units above it. The upper ball has a real journal bore, with a concentric spherical seat; the lower socket is a hollow hemispherical seat supported by the slide. Only the rod's exposed shank is rendered between the joint interiors. The bearing and its bushing are bored, and the slide has a supporting rail, lateral guides and top keepers with running clearance. The bearing upright is behind the block's complete swept depth, with a saddle connecting it to the elevated bearing. Previously the upright intersected the sliding block.

419 retains the exact A–B four-bar solution. Its connecting rod now has real eyes on pins long enough to span the joint layers. The bands occupy the drum's tread depth, and their finite radius is included in the tangent radius. The route sampler now handles either sign of the tangent-to-top angle; previously it could produce a negative wrap length and leave the displayed limbs short of the drum. Post tops were lowered to approximately the official canvas's 0.82-drum-radius elevation. The cradle sits behind the wheels, its fixed bearing mast reaches the contact floor, and the rolling radius includes the visible shoe's tube thickness. The source-required contact floor remains; the generic scene ground is hidden.

All three use sampled full-cycle framing without fog or the generic ground plane. The planar cases face the source elevation; 417 retains sufficient perspective to expose its spatial socket motion. 417 and 419 no longer compress their six/four-second cycles into two seconds.

## Validation

`node --test tests/movement-401.test.mjs tests/movement-417.test.mjs tests/movement-419.test.mjs tests/dead-socket-cradle-solids.test.mjs`

35 tests pass: 30 existing kinematic/rendering tests and five finite-interface tests. The new checks sample 129 poses for actual pin sections against 401's slots/bores, 417's socket centers and captured slide, 419's bored rod and actual pin lengths, and the rendered rolling shoe and band tread geometry. A separate triangle-surface sweep checks 417's exposed rod against the rotating wheel/shaft, fixed upright/saddle and guide supports. A negative-wrap regression checks that both displayed 419 limbs really reach their common drum-top point, rather than only checking the model's nominal tangent metadata.

Final Chrome default/front captures were compared with the engravings, with no browser errors. Seventeen sampled full-cycle poses fit the default viewport; maximum absolute projected coordinates were 0.876, 0.819 and 0.869 for 401, 417 and 419. Review images and browser reports remain temporary artifacts outside Git.

## Remaining limits

401 is an event-driven demonstration: spring deflection and treadle pressure are prescribed, not derived from spring forces or inertia. The spring remains a thin visual ribbon. Axial retention and fastener detail are simplified.

417's sockets depict finite spherical seats and a bored journal, while their orientation and joint closure remain analytic. They are not a validated loaded spherical-bearing design; loads, retaining hardware, friction and clearance-driven motion are omitted. The input wheel and support frame are inferred additions to the cropped source mechanism.

419's cradle angle still uses a disclosed effective-radius band relation. Tangent routing and finite tread clearance do **not** prove inextensible closure of both bands. Across 257 sampled poses, their combined displayed length varies from approximately 4.0613 to 4.0696 (0.2%); the band forces, material uptake and elasticity are not solved. The official canvas also prescribes cradle interpolation rather than providing a physical band/contact oracle. A future contact study should address this remaining uncertainty before claiming dynamically validated cradle drive. These tests qualify the named working interfaces, not every support and force path.
