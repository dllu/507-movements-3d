# Water mechanisms 439, 440 and 444: bounded solid review

Primary references: [439](https://507movements.com/mm_439.html), [440](https://507movements.com/mm_440.html), [444](https://507movements.com/mm_444.html), and the corresponding local engravings. The fetched pages have neither an `ae.add_model` nor an `mm_present` mechanism script. Their animation controls are unavailable; no official motion oracle was available for these three.

## Corrections

**439 — bucket reciprocator.** The bucket now has a tapered finite wall and a real bottom valve opening. The disk seats on the upper floor face; its stem has the length used by the analytical model. Valve lift is the nonnegative displacement needed to keep the actual stem tip against the fixed anvil. Consequently it opens during the final descent, stays in contact at the low position, and closes on return instead of opening from an unrelated phase schedule. The narrow anvil fits through the drain opening. A bored hanger supports the shaft, and a finite grooved pulley replaces the solid disk/ornamental torus intersection. The flume slopes toward the bucket and clears the pulley and rope. The incoming stream now ends inside the bucket instead of passing through its closed floor. The shaft indicator clears the shaft.

**440 — tipping meter.** The trough floor clears the axle, the underframe has an axle relief, and both bearing supports have finite bores. The two travel stops are oriented to the engaged floor and contact outside the underframe sweep. Water is clipped to each rotating compartment beneath a horizontal surface, using one reusable fixed vertex buffer; it no longer cuts through the tilted floor or central divider. The rotation indicator clears the front bearing.

**444 — hydraulic ram.** Supply, delivery branch and output riser have finite hollow walls. The supply reservoir floor has an opening, and the output riser intake extends into the chamber. Both check disks seat against flat annular faces. The weighted waste disk drops to open and rises to close; its stem and weight move together vertically. The former offset lever had no working connection to the stem. The waste body has a side supply port and an open discharge rim; the closed elbow intersecting the vertical stem was an unsupported reconstruction. The delivery branch is aligned with its disk. The default framing includes the full base and jet.

All three use explicit readable cycle durations (8, 6 and 4.8 seconds), disable material fog, and hide the viewer ground. Structural base/support meshes remain visible.

## Validation

`node --test tests/water-mechanism-439-440-444-solids.test.mjs tests/movement-439.test.mjs tests/movement-440.test.mjs tests/movement-444.test.mjs`

The focused test checks actual moving mesh surface samples against stationary solid interiors over 65 poses, checks the rendered 439 stem/anvil constraint and inlet termination, and checks 440 water vertices against compartment boundaries. Repeated state queries and updates preserve all scene object and geometry identities. The finite test is a sampled clearance regression, not an exhaustive intersection proof. Connections intentionally belonging to one rigid assembly are not tested as separate obstacles.

Chrome default/source, front and reverse-oblique views were inspected. All three default cameras have zero out-of-frustum visible vertices over 65 sampled poses. Bulk captures and logs remain in `/dev/shm`, outside Git.

## Physical assumptions and remaining work

* 439's bucket travel, fill/drain, counterweight return and pulley motion remain prescribed. Only the valve opening is derived from the finite stem/anvil constraint. The inlet and bucket water volumes are illustrations, not a solved mass balance. Rope tension, impact, tipping and fluid drainage have not been solved.
* 440's tipping threshold, timing and water-load schedule remain prescribed. Clipping establishes a horizontal visible surface inside the trough, not volume-conserving slosh, free discharge or passive load-triggered tipping. The analytical load centers still approximate compartment loading.
* 444 retains scheduled check-valve timing and the existing illustrative pressure/mass-balance relation. The transparent spherical chamber is a sectional shell; its cylindrical water graphic and air bubble are schematic and can overlap its spherical boundary and riser. The delivery tee is not a fully boolean-open sealed junction, and the reservoir connection/sealing details have not been pressure-qualified. Water markers and the waste efflux curve are schematic; the latter is not a ballistic jet. These are explicit residuals, not a claim of a validated fluid network.

MuJoCo was not introduced: none of these changes requires estimating an unknown rigid-body trajectory, and a rigid contact solver would not validate the missing fluid dynamics. A later coupled fluid/contact study would be necessary to replace the operating schedules with passive dynamics.


## Viewer timing follow-up

The subsequent family pass adds `minimumDisplayCycleSeconds` for all three
models. The registry overwrites the factory's target timing, so a target alone
did not enforce the reviewed duration in the actual viewer. The 8/6/4.8-second
cycles now survive that integration path; `tests/reviewed-cycle-timing.test.mjs`
applies the production timing function and checks the resulting duration.
