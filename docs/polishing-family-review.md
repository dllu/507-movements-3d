# Polishing interfaces: 370 and 393

Primary references: [370](https://507movements.com/mm_370.html) and [393](https://507movements.com/mm_393.html), captions and local engravings. Neither page supplies an official animated oracle. Dimensions, depth layers and absolute timing are reconstruction assumptions.

370 retains the analytic guided-bar motion and prescribed one-tooth mirror advance. The upper eye, crankshaft support, rail, mirror axle and carrier now have real bores. The lower rail clears the bar throughout its travel. The asymmetric ratchet and its finite bored click share a working plane; the shared maintaining-clock follower supplies a continuous geometric lift/drop. The eccentric follower now has overlapping hollow/solid telescoping sections. The camera covers the entire long-bar cycle; playback has a 10-second minimum cycle.

393 retains the concentric shaft, bent carrier, eccentric cup and spherical work. A small captured ball and bored spherical socket fit through an annular opening in the closed cup, with a slender stem clearing the opening. A drilled bearing bridge connects the upright shaft support. The work has a closed bottom and support to the table; flat surface indexes no longer protrude into the cup. Camera direction is returned to the engine; playback has a 12-second minimum cycle. Both models disable material fog and the ground plane.

## Evidence

Run:

```sh
node --test tests/polishing-interfaces.test.mjs tests/movement-370.test.mjs tests/movement-393.test.mjs tests/maintaining-clock-interfaces.test.mjs
```

25 tests pass, including the shared clock-follower regression. Across 33 poses spanning each complete input cycle, selected repaired interfaces pass approximately 1.46 million rendered-surface queries (penetration tolerance 1e-5). The click/ratchet planar intersection area remains zero. Its sampled working-surface separation is 0.00200–0.00917 model units (wheel radius 0.72); this is a clearance illustration, not a loaded contact-force result. Maximum click steps converge from 0.005335 to 0.000345 radians when tooth-period sampling increases from 256 to 4096; the seam error is below 1e-15. Closed cup/socket signed volumes are positive. Updates preserve geometry identities.

Serialized Chrome source/default/front/advanced review reported no errors. Full-cycle maximum absolute screen coordinates were 0.885 for 370 and 0.765 for 393, within the viewport. Rendered geometry including shadow passes: 16,856 triangles / 58 calls and 86,072 triangles / 60 calls. Local CPU observations were 77/32 ms construction and 0.041/0.007 ms per update, respectively; these are measurements, not portable performance guarantees. Bulk captures remain in `/dev/shm/polishing-final-*`.

## Remaining limits

370's output advance and harmonic carrier motion remain imposed schedules. The telescoping eccentric follower illustrates the transmission rather than closing a rigid linkage. The finite click avoids geometric penetration and teleportation, but its driving face, preload, return bias and resistance under polishing load have not been dynamically qualified. This pass does not establish a passive ratchet simulation.

393's independent cup rotation is prescribed by zero-twist transport. It is not a validated consequence of friction, contact pressure or inertia. The polishing radius retains a 0.028 display gap from the work; neither abrasive pressure nor material removal is simulated. The annular socket opening and depth details are inferred. Legacy catalog naming still contains “passive”; the model's reconstruction note and DOF description explicitly qualify the prescribed spin.

Finite checks cover the named repaired pairs, not every possible self-collision, force path or seal. No native dynamics bake is claimed for either prescribed illustration. Further dynamics should be a separate bounded task rather than delaying these interface corrections.
