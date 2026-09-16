# Edge runners and treadwheels 375–377

Primary references: [375](https://507movements.com/mm_375.html), [376](https://507movements.com/mm_376.html), [377](https://507movements.com/mm_377.html), and their local engravings. All three official pages mark the animation unavailable. This bounded pass corrects mechanical support topology and presentation; it does not claim a passive gait or grinding simulation.

## Finite corrections

375 now has real axle bores through both stones and their hubs, and real bores through the input and lower shaft bearings. The formerly floating lower shaft reaches its bearing; that bearing reaches the foundation. A standard connects the upper input bearing to the frame. The open, zero-thickness pan is replaced with a closed annular trough retaining the original working floor and sloping lips, with an underside that reaches the foundation. The two rotating stones clear this actual finite pan over the full orbit.

376 previously had both solid bearing cylinders and solid overhung arms intersecting the rotating axle. Both layers now contain journal passages. Spokes reach the side rings, and finite radial brackets attach each formerly floating tread board to those rings. The horse torso previously enclosed the axle; its body is lowered beneath the shaft, with shorter inferred legs, consistent with the source's position. The actual body/shaft pair now clears.

377's axle bearing is bored, the spokes connect to the drum rings, and both handrail posts reach the foundation. The foundation extends under those standards. The person previously stood beyond the axial width of all boards; its station is now above the descending side and inside the tread field. The camera approaches from the source-facing side so the near end wheel lies left of the person and tread field.

The carrier and wheel laws retain their original ratios and cycle continuity. Display periods are at least six seconds for 375 and twelve seconds for 376/377, making the seven/eight gait cycles readable. Ground and fog are disabled; cycle bounds cover visible geometry. Playback retains all scene objects and geometry buffers.

## Qualification and residuals

375's analytical no-slip identity applies at the center of each runner's contact line. A finite-width cylindrical runner following a circular track necessarily scrubs away from that centerline; full-width no-slip is not physically possible. Grinding forces and friction remain unqualified. The bevel velocity ratio remains an analytical pitch constraint. The former eight-corner, flat-ended teeth are replaced with the shared back-cone involute approximation: conical heel/toe surfaces, correct end normals, bored matching bodies and a compatible tooth phase. This is the Tredgold approximation, not a generated octoid or a loaded contact simulation.

376 retains explanatory sinusoidal leg animation and a prescribed steady wheel speed; its hoof contacts remain unqualified. The initial pass measured **0.0525** foot/board penetration in 377. The [subsequent finite gait correction](treadmill-377-contact-review.md) replaces 377's sinusoidal gait with tread-indexed stance and swing, radial boards and two-link legs: finite feet and legs now clear the boards. Passive human balance, reaction forces and the separate horse gait remain unqualified. No native force result is claimed.

## Validation

`node --test tests/movement-375.test.mjs tests/movement-376.test.mjs tests/movement-377.test.mjs tests/treadwheel-working-solids.test.mjs` — **33 checks pass** with `tests/edge-runner-bevel.test.mjs` included (24 existing checks, seven finite support checks, and two bevel geometry/contact checks).

New checks exercise 65 poses of actual runner/pan and axle/journal solids, finite interior witnesses for pan/frame/tread/spoke connections, body/axle clearance, tread-field axial alignment, retained geometry buffers and the separate gait residual. The corrected person's station changes the old below-axis assertion to the source-facing above-axis arrangement while retaining the descending right-side velocity and weight-torque laws.

Source/default/front and three advanced views were captured at `/dev/shm/tread32-final-*.png`. The final integrated 17-pose browser framing checks have no errors or clipping, with maximum normalized screen extents 0.926/0.729/0.833 and 54,512/18,976/13,136 rendered triangles respectively. These include the corrected 375 bevels and final 377 camera direction; final captures are `/dev/shm/family32-final-{375,376,377}-{default,oblique}.png`. RAM audit/capture scripts are `/dev/shm/tread32-audit.mjs` and `/dev/shm/tread32-final-browser.mjs`; no bulk artifacts are checked in.

The bevel follow-up checks conical-end invariants and their normals, then makes 468,074 bidirectional actual-surface queries over 65 poses spanning one repeated tooth pitch. Minimum pair clearance is 0.0012404; nearest engagement remains below 0.0012456 at every pose. The common apex, 36:12 ratio and existing carrier/runner laws are retained.
