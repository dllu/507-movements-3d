# Movement 271: finite alternating hooks

The [official caption and engraving](https://507movements.com/mm_271.html) show a vibrating lever carrying two pawls that alternately advance a ratchet bar. The page has neither `ae.add_model` nor `mm_present`; there is no registered animation oracle. Leftward travel and the depth arrangement are reconstructed from the hooks and tooth faces.

## Defect and correction

The former model reported zero XY contact error while its short and long noses stood **0.247** and **0.527** ahead of the actual tooth surface in Z. The point law also placed the noses directly on the sharp crests. Moving those unchanged solid noses into the rack plane would not establish compatible contact.

Both pawls now have a bored hinge, a rigid raised beam, an integral stepped shoulder and a rounded working hook. The hooks occupy Z −0.08 to +0.12, inside the rack's −0.21 to +0.25 depth, while the separate lever leaves remain clear. The working toe radius is 0.035; its center engages 0.055 below the crest. Full-radius toes and substantial connecting necks remain: no swept-volume subtraction or vanished contact face is used. The sharp asymmetric rack faces are unbeveled to avoid an unaccounted raised tooth envelope.

Each half-stroke now has **0.302** of available pawl travel: **0.05** takes up clearance, then the bar advances exactly one **0.252** pitch. The extra travel allows the returning rigid hook to clear the next crest and drop continuously into its seat. The lever amplitude is about 20.16 degrees; toe locations and the adjusted lower pivot remain within the prior six-pixel source uncertainty. A C2 lift/plateau/drop schedule supplies the return motion. The rack and its finite tooth run have been shortened to the engraved working region instead of extending through the fulcrum post.

The lever plate and fixed fulcrum now have actual bores. Lower guide shoes, rear pedestals and front keepers replace the previous support/rack overlap; the front motion markers are attached shallowly enough to pass those guides. The entire finite model fits through the cycle, uses a five-second minimum display period, and disables ground and material fog.

## Evidence

Run:

```sh
node --test tests/movement-271.test.mjs tests/ratchet-bar-finite-contact.test.mjs
```

All **14 checks** pass: eight updated source/kinematic regressions and six new finite-contact/interface checks.

- An exact planar polygon-intersection audit at **513 poses**, using the extrusion's float32 outline coordinates and accounting for overlapping depth, finds no positive-area hook/tooth or shoulder/tooth intersection on either complete stroke.
- Independent distance queries against the rendered rack triangles at six loaded phases find active gaps no greater than **0.00001005**. This is the rounded toe's small polygonal approximation error, compared with the former 0.247/0.527 axial gaps. Both hooks have **0.20** axial overlap with the teeth.
- The vertical driving face gives a +X reaction on the hook. Its moment about the hinge is positive, rotating the leftward hook down toward its seat; the sampled moment per unit reaction is at least **0.3017**. The equal and opposite leftward force does positive work on the moving rack.
- Actual bored solids clear the 0.085 pawl pins by more than **0.0018**; the moving pawl plates have **0.02** axial clearance from the lever plate. The fixed fulcrum bore clears its shaft by more than **0.0038**.
- Rack/support checks retain **0.12** rear clearance, **0.01** lower-shoe clearance and at least **0.06** end clearance from the fulcrum post. Front markers also clear the keepers.
- Repeated state queries and updates preserve descendant counts and geometry identities. A 65-pose actual-vertex check covers full-cycle framing. Position and rigid-pawl continuity are checked across return transitions and cycle boundaries.

## Explicit limitations

This is a geometrically compatible **prescribed-motion reconstruction**, not a validated passive ratchet simulation. The unloaded bar is held during pickup. At the five-second display period, the two pickup dwells are approximately **0.6684** and **0.6612 seconds**, together 26.6% of the cycle. Loaded pickup starts at about **0.143 model units/second**; the ideal law therefore has a velocity discontinuity, whose impact, compliance and inertial coast are not solved. Gravity and any spring or operator bias that produces the imposed return are also not solved. A loaded-motion study would need those quantities before replacing the finite pickup with continuous output.

The two-pitch display wrap is retained for a finite-length bar; it is a repeating illustration rather than indefinitely accumulating physical travel. The engraving's left-hand cord/load arrangement remains omitted. Browser source/default/oblique inspection is performed centrally by the parent integration pass.
