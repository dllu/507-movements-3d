# Grooved drives: 364, 397 and 398

## Sources and qualification

Primary references are the captions and engravings at [364](https://507movements.com/mm_364.html), [397](https://507movements.com/mm_397.html), and [398](https://507movements.com/mm_398.html). Pages 364 and 397 have no inline `ae.add_model` / `mm_present` animation model. Page 398 does, and its six circular arcs and kinematic checkpoints remain the motion oracle.

These are prescribed analytical reconstructions, not validated passive rigid-body simulations. Exact historical groove sections, working loads and friction are not supplied by the static engravings. All three now expose that qualification in the viewer's `reconstructionNote`. Display periods are enforced through `minimumDisplayCycleSeconds` (8, 6 and 7 seconds); ground and material fog are disabled.

## 397: restore the open crescent

The old model invented a closed loop and two long dwells; solid tubes also occupied the crank pin's path. The engraving instead shows an open crescent on a pivoted lever. The replacement is one radial-monotone open curve traversed in both directions. Its middle is a circular dwell arc about the input crank center at the reference lever pose. Short rounded continuations at the ends give a finite tangent as the pin reverses along the same opening. These end blends are reconstruction assumptions, not dimensions measured from the engraving.

For crank pin P, lever pivot O and stationary curve Q(rho), closure uses rho=|P−O| and lever angle `arg(P−O)−arg(Q(rho))`. The upper lever pin and finite connecting rod then determine the horizontal shuttle. There is approximately 30.08% dwell per input turn and 4.73065 model units of travel. The old closed-loop/two-dwell regression was replaced with open-profile topology, both traversal branches, analytical derivative/continuity, dwell and rod closure checks.

The working lever now has a genuine open pocket, joined upper/lower arms, a bored pivot and bored rod eyes. The full-radius pin is retained. An offline capsule-union operation constructs the pocket; it is not rebuilt in the browser. At 129 sampled poses, pin/slot minimum separation was +0.000521 and the maximum nearest-wall separation was 0.003298. The crank arm clears the plate by 0.020. At 255 stations, `Q·tangent > 0.20`, so the opposed groove normals retain opposite nonzero moments about the lever pivot. This establishes useful finite working walls rather than merely deleting the whole working region. It does not solve clearance take-up, friction, inertial loads or impact dynamics.

The rod eyes, fixed journals and shuttle guides have actual running clearance and axial overlap. The pivot hub caps and rim stand proud of the lever plate to avoid coincident-face rendering. Both 397 and 398 pass their source-facing camera direction to the viewer explicitly.

## 398: retain the source motion, replace filled channels

The official animation's six arcs, roller radius, guide offset and connecting-rod assembly branch are unchanged. The old visible tube borders and solid front disk intersected the follower. Inner and outer finite cam lands now bound an open recessed channel with a floor behind the roller. The positive arc sweep is retained for the source's arc exceeding a semicircle. The two walls have 0.0006 nominal running clearance from the source-radius roller; the roller is not reduced.

At 129 poses, measured inner-wall clearance was at least +0.000571, outer-wall clearance +0.000594, and floor clearance +0.030. Nearest-wall separation stayed below 0.00111. The crosshead guides engage the actual block depth with 0.005 nominal clearance. Bored rod eyes retain both pins. The original eight source-oracle/motion tests pass. The source's ideal follower law is prescribed across the small manufactured clearance; forces, backlash and contact selection are not dynamically solved.

## 364: finite groove and mouth sampling

The original raised borders were too close together for the 0.25-diameter roller and sat on a solid cylindrical drum. The new drum is a closed, bored solid with eight actual recessed grooves. An offline finite-cylinder sweep uses the existing quintic indexing law and a constant 0.002 cutter allowance; roller dimensions and index timing are unchanged. Roller journals have real bores and longer studs that span the working bodies. Raised rim ornaments that blocked groove mouths were replaced by the profiled body's own end faces. Flush indexing marks no longer enlarge the roller contact radius.

The first uniform radial mesh audit found −0.008637 penetration. At its worst witness, radius 1.436600773, the exact swept-cylinder envelope allowed radius 1.434008650: +0.002592 clearance. Adjacent mesh samples included an outside radius of 1.52, so interpolation across the discontinuous mouth filled part of the opening. This distinguished the larger mesh error from the ideal index law. Duplicated finite mouth edges replaced that interpolation without increasing cutter clearance.

The thirty-fourth pass still measured −0.00315045 penetration at t=0.296875,
roller 0 against the wheel. The thirty-fifth pass traced that witness to the
remaining steep, square-root shoulder of the finite-cylinder envelope. The
witness radius is 1.431396349; the exact swept envelope there is 1.428643969,
leaving +0.002752380 clearance. Uniform angular samples were bridging that
shoulder with a chord that filled part of the opening.

Cosine-distributed samples now concentrate the same 64 interior stations at the
two groove mouths. The cutter allowance remains 0.002; roller dimensions, timing,
65 vertical rows, 385 sweep states and baked vertex count are unchanged. This
corrects the mesh approximation without enlarging the nominal groove or adding
browser work.

The original 65-pose audit now has +0.000277700 minimum clearance. An independent
257-pose shifted-phase sweep has **+0.000043815 minimum clearance**, with engaged
nearest-wall gaps no larger than 0.002026257. A reverse check samples actual wheel
vertices, edge midpoints and triangle centers against conservative full finite
roller cylinders: 429,169 nearby queries over 65 shifted poses give
**+0.000194514 minimum clearance**. The regression now requires positive sampled
clearance, includes the former penetrating witness and the dense sweep's closest
pose, and checks both dwell boundaries. These finite sampled checks supersede
the previously recorded mesh penetration; they are not a continuous collision
proof.

Frictional roller spin, clearance take-up, drive traction and dwell holding
remain prescribed assumptions. Neither a MuJoCo model nor a bake of passive
dynamics is claimed.

## Reproduction

Geometry generators (run offline from the repository root):

```sh
node scripts/generate-open-crescent-shuttle.mjs
node scripts/generate-roller-indexer-grooves.mjs
```

Focused validation:

```sh
node --test tests/movement-364.test.mjs tests/movement-397.test.mjs tests/movement-398.test.mjs tests/groove-drive-working-solids.test.mjs tests/roller-indexer-finite-envelope.test.mjs
```

The tests cover source motion, actual finite surface proximity/penetration, rod/journal interfaces, continuity, readable playback, and stable descendant/geometry identities under repeated state queries and updates. These bounded surface samples are not an exhaustive collision proof. Bulk diagnostic traces and screenshots belong in `/dev/shm`, not Git. Root integration performs the final shared-browser source/default/oblique review and packaged checks.
