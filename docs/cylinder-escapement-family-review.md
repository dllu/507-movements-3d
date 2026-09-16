# Cylinder escapements 294–295: passages and supports

Sources: [movement 294](https://507movements.com/mm_294.html), [movement 295](https://507movements.com/mm_295.html), and their local engravings. Both official pages mark the animation unavailable. Brown shows the hollow cylinder in perspective and its alternating outside/inside tooth engagements in a sequence of plan positions. The three plan outlines represent successive states of one cylinder.

This is a **bounded topology/support correction, not a completed finite-contact reconstruction**. The existing prescribed tooth advance and balance motion are retained. Working cylinder material has not been removed to conceal collisions.

The perspective model now has two end pivots and a clear hollow central working band, replacing the solid staff that obstructed the pallet passage. The enlarged section omits its erroneous central staff entirely. The complete tubular ends and working shell remain. Collars, tapered collets, wheel hub, balance hub, frame and bearings have actual shaft bores. Small integral feet attach the raised pallet stems to the wheel rim; they previously floated just beyond its edge. The rear standard now reaches its base. Its support plane is behind the rotating lower collet, with extended journal tails; the old plane intersected that collet by about 0.0725. The added balance hub connects its spokes to the end pivot.

Generated contact-trace tubes and the moving point-contact marker are suppressed because they implied finite contact that their reference-point equations do not establish. The complete visible geometry is fitted over a cycle, fog and ground are disabled, and minimum display duration is six seconds. The wheel is retained in full in both views, including 295's enlarged operating view.

Validation: `node --test tests/movement-294.test.mjs tests/movement-295.test.mjs tests/cylinder-escapement-support-solids.test.mjs` — **21/21 pass**.

- 129 poses check every finite pallet against both tube ends and the two-piece pivot mesh. The previously measured staff collision (penetration about 0.0563) is removed.
- 33 poses check actual collar, collet, hub, standard and bearing bores against their shafts, and the lower collet against the relocated fixed supports.
- Interior witnesses in both adjoining solids establish connected stem feet, wheel rim and base/standard joints.
- Geometry and scene objects are retained during playback. Local warmed Node update cost was about 0.0022 ms; construction measured 25–112 ms.
- Browser source/default/front/entry/inside/exit captures reported no errors; full-cycle maximum normalized screen extents were 0.773 (294) and 0.901 (295). The 294 camera was then switched to the opposite X side to preserve the engraving’s left/right collet order. RAM captures are `/dev/shm/cylinder30-final-{294,295}-*.png`; the final camera-sign correction is covered by the integration capture.
- The legacy analytic checks are explicitly described as prescribed point-law checks, not tests of real working contact.

## Working-contact follow-up

The independent actual-solid scan still finds approximately **0.0813 penetration into the cylinder shell** and **0.0259 into a lip rail**. These are material defects, not numerical contact tolerances. The initial code generates a lip curve from the trajectory of a zero-size tooth reference point while displaying unrelated finite pallet and cylinder surfaces; zero point residual therefore does not prove their contact.

A bounded reconstruction experiment used an asymmetric triangular pallet and closed working faces derived from the nominal trajectory, with both the original and a rephased/reversed balance law. It still produced about 0.078 overlap: the **preceding finite pallet** remains in the exit region when the next nominal entry starts. Those experiments were not put into production. Their RAM files are `/dev/shm/cylinder30-prototype.mjs`, `cylinder30-prototype-helper.mjs`, and `cylinder30-prototype-audit.mjs`; the baseline independent scan is `/dev/shm/cylinder30-audit.mjs`.

The next contact pass must jointly solve finite tooth shape, cylinder lip geometry and the entry/exit timing, including the previous tooth. It must preserve loaded locking and opposite-sense impulses; simply enlarging the cylinder opening is not a qualification. A bounded native contact study is appropriate once that coherent topology is established. No MuJoCo result, passive balance regulation, torque transfer, spring-energy closure, friction or impact solution is claimed here. The prescribed schedule remains continuous and cheap, but the escapement itself remains contact-unqualified.
