# Movement 297: finite pallets and native-derived playback

This supersedes the working-contact residual in `lantern-escapement-review.md`; the connected wheel and bored supports from that pass remain. The production trajectory now comes from an offline MuJoCo study followed by a small, explicitly measured geometric projection. It is **not raw MuJoCo playback or a validated self-running clock**.

## Source and reconstruction

[Brown's movement 297](https://507movements.com/mm_297.html) describes a lantern wheel with two pallets B and C carried by arm A. The engraving has eight full round trundles and a counter-clockwise arrow. Its page contains neither an `ae.add_model` registration nor an `mm_present` animation definition. There is no official motion oracle for the lift, drop, stroke, inertia or timing.

The former fitted working faces were only 0.361/0.547 model units long, versus the source's long oblique bars. Their normal reactions assisted rather than restrained the wheel; the bars intersected a trundle by 0.058 and a front ring by 0.14133. The scripted releases happened inside the finite faces, with an abrupt reset to zero wheel velocity.

The replacement uses actual rectangular bars: B length 1.50, C length 1.28, width 0.18, thickness 0.28. The source axes remain +46° and −28°. All eight trundles keep radius 0.347368 and orbit 2.384211. The engraving is not a dimensioned, geometrically exact construction: retaining its centers and the former ±6° swing traps a trundle between the bars. This reconstruction moves B 0.25 model units along its axis (about 16 source-image pixels) and uses ±18° arm travel. C stays at its source center. These are material, disclosed reconstruction choices, not an exact source superposition claim.

Pallets occupy Z=0.92…1.20, ahead of the front ring ending at 0.78. The full trundles extend from −0.81 to +1.20 and still attach to both rings. Thus their working depth overlaps the complete pallet thickness. Arm A and the transverse mounts lie ahead of the pin ends; small axial posts join each mount to its pallet within the bar's own footprint. The arm hub has a real bore and its arbor reaches the rear journal. Source depth is inferred, and orbiting is needed to inspect this separation. Default playback begins at the source-angle arm pose, not at a stroke extreme.

## Native study and qualified bake

`mujoco-lantern-escapement/model.js` uses the shared WASM simulation owner. The wheel has one rotational DOF, inertia 0.2, constant drive torque 1 and damping 0.01; these are uncalibrated model units. The arm angle and velocity are imposed analytically, with a large arm inertia to suppress within-step reaction changes. Gravity and contact friction are zero. Planar spheres represent the visible cylinders' exact XY support; neither body can move axially. Finite box pallets retain their sides and end corners.

Earlier full-bar candidates jammed, and coarse timesteps did not reproduce a stable branch. The final 12-second controls use 0.125 and 0.0625 ms steps. After settling, both advance one 45° pitch per four-second cycle. These are the acceptance controls, not the failed coarse trials:

| Quantity | Measured result |
| --- | --- |
| Two successive settled cycle advances | 0.785398163397 rad each |
| Maximum whole-cycle fine/coarse angle difference after settling | 0.006531008062 rad (0.374°) |
| Fine raw soft-contact minimum gap | −0.002644565360 |
| Contact-disabled contact count | 0 |
| Contact-disabled 12-second advance | 297.62533022504 rad |
| Maximum offline angular projection | 0.001151361128 rad (0.066°) |

The disabled wheel runs away rather than escaping one pitch per cycle. Fine/coarse phase agreement is bounded, **not precision convergence of impact forces**. Bearing losses, spring regulation, compliance and real impact loads remain unvalidated.

The bake takes the settled 8…12-second trajectory. An offline Newton projection removes the solver's small soft-contact overlap against the actual two finite bars, retaining 0.00012 model-unit clearance. It does not cut away either pallet or reduce a trundle. Shape-preserving cubic interpolation avoids impact overshoot; the cycle endpoints differ by exactly one pitch and have equal slopes. This changes impact details and must remain described as **native-derived plus geometric projection**. Runtime only interpolates 4,001 samples and evaluates 16 inexpensive finite contact queries; it neither runs MuJoCo nor generates collision meshes.

The wheel leaves the finite end corners with nonzero inherited speed. Around B release, playback speed rises from 0.5255 at t=2.56 to 0.5753 rad/s at t=2.57; around C release, 0.4310 at t=3.80 to 0.5305 at t=3.82. Native landing rebound is retained. The active-contact display threshold is a proximity classification, not a measured contact-force trace.

## Finite validation

`tests/lantern-pallet-contact.test.mjs` checks:

- Full radius circles against both complete finite rectangles at 16,001 times, including between bake samples: minimum gap **0.0000500480**.
- Actual rendered triangle samples in both directions, across 141 poses including the old witnesses, both new drops and landing events: minimum gap **0.0001200402**.
- Ring/spoke separation, real axial pin/pallet overlap, forward-arm clearance and attached finite mount posts.
- Actual planar triangle normals at representative loaded poses. Across the full proximity scan, normalized reaction moments are B **−2.38421…−0.92018**, C **−2.38421…−1.89902**; both oppose counter-clockwise drive.
- Finite-end contact before release, nonzero free-drop speed, shrinking loop-seam probes, one-pitch periodicity, control bounds and explicit projection metadata.

The retained structural tests check actual journals, shaft bores, spoke/ring/hub attachment, all trundle attachments, visible full-cycle bounds and geometry identity stability. Sampled joint clearance is 0.00580009. No exhaustive all-body collision certification or physical load claim is made.

Reproduce:

```sh
node --test tests/lantern-pallet-contact.test.mjs tests/lantern-working-solids.test.mjs tests/movement-297.test.mjs
node scripts/generate-lantern-escapement-motion.mjs --check
```

The generator reruns both timestep controls and the disabled-contact control, then checks byte-identical output. Root integration supplies the independent source/render inspection; this document does not count screenshot generation by the implementing agent as an independent visual review.

## Primary-agent source review

GPT-6 Astra independently inspected the final default and oblique renders against
the engraving on 2026-09-16. The eight full trundles, common arm and opposed bars
are readable; the shifted B position, enlarged stroke and inferred axial mounting
remain the source-fit limits described above. The sampled full-cycle screen extent
is 0.88094 NDC with no browser errors; 68 draw calls render 23,712 triangles
including shadows. The 15 focused checks pass, and the bake regenerates identically.

Final integration: the production build, CPU screen and packaged desktop/playback/
mobile checks pass. See the forty-seventh pass in [review progress](review-progress.md)
for the combined validation record.
