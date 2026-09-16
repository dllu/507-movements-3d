# Movement 391: rack and weight handoff correction

The [official caption and engraving](https://507movements.com/mm_391.html) specify weighted racks pivoted on one piston-rod crosshead, alternating engagement through fixed guide grooves, and an elbow/spring assisting the right upper crossover. The page has no available official animation. It specifies neither a stroke length nor one output revolution per piston cycle.

## Published correction

The previous upper crosshead position placed the pivots only .310 below the pinion center. The inactive lowest teeth could not withdraw far enough, and the inboard weight crowded the pinion. A plain lower rack extension now keeps both pivots below −1.399 at the upper dwell. Tooth size, 17 teeth per rack, 20 pinion teeth, and the finite involute working profile are preserved; teeth were not reduced or removed.

An initial 1.10 extension preserved the old ten-pitch stroke but visibly lengthened the source's lower bars. The final reconstruction uses a .60 extension and an eight-pitch stroke. This reduces the added plain bar while retaining the needed upper-pivot clearance and the engraving's two weighted racks and guide topology. The source does not determine these dimensions; this is a mechanical proportion compromise, not a measured historical dimension. The active rack's low-stroke tooth station is unchanged, and the opposite working phase is recomputed from the same pitch.

Output advance is now −.8 turn per piston cycle. The output angle remains unbounded across cycle boundaries, and the marked wheel returns after five piston cycles/four output revolutions. The eight-second minimum applies to one piston cycle. The rack/guide trajectories and output preserve continuous positions and zero-speed handoffs. Elbow deflection uses the same smooth switch parameter so its endpoint speed is also zero.

The crosshead occupies a separate depth from the rack eyes and weights, with pivot pins spanning both. Guide pins span the finite guide castings. The lengthened input rod remains in its bored guide throughout the stroke and passes through a real bed opening. The lowered bed, extended guide standards, and bored output-bearing post meet their respective supported parts.

## Evidence

`tests/weighted-rack-handoff-solids.test.mjs` and the updated `tests/movement-391.test.mjs` pass **16/16** checks. Both directions of actual rendered-surface sampling cover 257 cycle poses for both racks' teeth, bodies, weights and weight arms against the pinion. Minimum measured clearance is **+.000909**, including crossover; active flanks remain within .004 of contact. This closes the previously documented inactive-tooth/pinion residual.

A separate 65-pose sweep checks guide pins, pivot bores, weights/crosshead, input rod/bed/guide and output shaft/bearing. Tests also require axial pin engagement, full guide coverage by the input rod, unchanged tooth dimensions, repeated-cycle continuity, five-cycle marked closure, and unchanged geometry/scene identities during playback. These are selected finite-interface tests, not exhaustive all-pairs collision validation.

## Elbow C: still unresolved

The elbow is **not** a validated load-bearing selector. Its old tube still intersects the outboard guide pin near the upper crossover; the unclamped diagnostic measured penetration of .1123 at t=3.875. A bounded reconstruction attempt distinguished the engraving's separate inboard upper rack lug from the outboard guide pin, added a bored roller, and generated a finite cam envelope. The clear upper face exerted torque opposing the intended branch; a supporting lower-face/release variant collided with the returning lug and guide pin. That experiment is excluded from production rather than being presented as solved contact.

RAM study artifacts are `/dev/shm/rack28-elbow-experiment.js`, `/dev/shm/rack28-elbow-factory-experiment.js`, and the `/dev/shm/rack28-cam-*` diagnostic files. The published elbow's remaining penetration is recorded separately in `/dev/shm/rack28-elbow-depth.txt`. The next contact pass should resolve the actual lug/lever force and release sequence before claiming passive branch selection. It may warrant a native contact study once its finite source topology is settled.

Rack selection during the crosshead dwells, gravity weighting, spring assistance and output holding remain prescribed. The successful clearance and phase tests do not establish that weights and spring forces alone will select the branch or hold the output under load. No MuJoCo dynamics qualification is claimed.

Final browser source/default/front/advanced review reported no errors; all sampled cycle geometry fits the viewport (maximum NDC .901). Captures are `/dev/shm/rack28-final-391-*.png`. A local timing sample measured approximately 488 ms construction and .014 ms/update; the unsuccessful cam-envelope reconstruction is not run by production.
