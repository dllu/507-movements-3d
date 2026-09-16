# Alternating drives 390–391: bounded finite-interface pass

Both movements remain **partial**. This pass fixes pulley journals, band grooves, guide slots and the active rack mesh; it does not certify their remaining pawl/rack handoffs.

## Sources

- [390 original caption and engraving](https://507movements.com/mm_390.html): an open and a crossed anchored band rotate two loose pulley carriers oppositely; their pawls alternately drive ratchets fast on the common flywheel shaft.
- [391 original caption and engraving](https://507movements.com/mm_391.html): weighted pivoting racks follow fixed grooves, alternating engagement on ascent and descent. Elbow C and spring d assist the right pin over its upper corner.

The checked source pages contain neither `ae.add_model` nor `mm_present`; neither supplies an official inline animation. The existing prescribed timing is a reconstruction, not an oracle-derived or force-validated trajectory.

## Changes

390 previously represented each lower band groove by a solid torus centered on the band. A closed bored pulley now has a concave groove around the finite round band, with a separate external flange. Both loose hubs, both fast ratchets and the fixed rear journal have real shaft bores. The anchored-band length and no-slip motion laws are preserved.

391's former solid guide tubes occupied the pin paths. Both castings now contain swept finite openings (pin radius 0.115, opening radius 0.125), including their branch junctions. The dark front lip surrounds the same opening. Lower rack eyes and the piston guide have bores. Shared involute pinion/rack teeth replace the nonconjugate trapezoids; each rack's tooth phase matches its working stroke. Gear addendum is 0.065, leaving finite teeth rather than deleting the mesh.

Both factories disable fog and ground, enforce an actual eight-second minimum display cycle, and fit the full prescribed sweep. 391 now returns its source-facing camera direction to the engine rather than storing it only as unused metadata.

## Evidence

`tests/alternating-drive-solids.test.mjs` adds five checks alongside the 17 existing movement tests:

- actual finite round-band surfaces clear the lower pulley grooves by more than 0.004;
- shaft surfaces clear both loose hubs and the fixed journal by more than 0.0025;
- 391 guide-pin surfaces clear the channel walls by at least 0.00765 across a separate 257-pose audit;
- actual active rack/pinion surfaces clear by 0.0009088 on each working stroke, with near-contact retained;
- repeated state queries and updates retain descendant and geometry identities.

The scoped 22 tests pass. Source/default/front/rear browser review found no errors. Final full-cycle vertex projection stayed within the viewport: maximum absolute NDC 0.88260 (390) and 0.92593 (391), with zero clipped vertices. The final thin guide-lip revision also passed all five finite tests. Review artifacts stay in `/dev/shm/alternating-drive-{390,391}-{default,front,rear}.png`.

## Explicit queued contact residuals

390's original pawl is only 0.0556 long although its hinge pin radius is 0.060. Its prescribed sine lift is unrelated to the finite ratchet flank. The open-carrier pawl body penetrates the fast ratchet by 0.0500 at t=2.375 of the eight-second cycle (129-pose triangle audit). Both pawls still share the same planar mounting phase rather than the opposed placement in the engraving. A later finite pawl/hinge/contact branch correction is required. Upper-sector band support details also remain schematic. The new bores do not validate torque keys, friction or passive clutch action.

391's inactive lowest rack tooth still interferes near the top of travel: right rack −0.05414 at t=2.78125; left rack −0.05647 at t=4.53125. During the upper guide crossover, measured depths are −0.02769 (left) and −0.03431 (right). The pivot is too close to the wheel near the top for the short lower-tooth lever arm to withdraw sufficiently. Changing the pivot/guide/stroke geometry is the appropriate follow-up; further tooth shrinking would remove useful working engagement. The regression places only an upper bound on this residual and allows an improvement.

A separate 65-pose audit also found the right inboard weight intersects the pinion by 0.23996 at t=3.0; the left weight clears by 0.94026. Thus this is not merely a tooth-phasing problem. The lower rack pivots, weight arms and shared crosshead also need a coherent axial joint/contact review. Prescribed guide selection, upper-corner assistance, gear motion and weights are not validated passive dynamics, and no fluid or rigid-body solver is claimed.
