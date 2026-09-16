# Maintaining-power clocks: 320–321

This bounded pass repairs selected rope, journal, and ratchet interfaces while retaining the existing prescribed operating cycles. It does not validate passive load transfer or clock dynamics.

## Primary references

The official [endless-chain maintaining power, 320](https://507movements.com/mm_320.html) describes one continuous chain passing over two fixed upper pulleys and two weight-carrying lower pulleys. Pulling strand b raises the main weight while the going pulley keeps turning. The official [Harrison going barrel, 321](https://507movements.com/mm_321.html) transfers the weight's drive through a carried click and maintaining spring; a fixed click holds the larger ratchet during winding. Both source pages are static, with no available official animation. Their engravings were inspected alongside the final default/front/advanced views.

## Corrections

**320:** all four pulleys now have actual rounded rope grooves and bored hubs. The previous decorative torus occupied the rope centerline. Weight hangers now pass in front of their pulleys and have real bored pivot eyes and through-axles. The click's source-facing pivot orientation is corrected, its journal is supported, and its asymmetric ratchet has a real arbor bore. The shared `tubePathUpdater` updates the existing closed rope geometry and GPU arrays; the previous path allocated and disposed a full replacement TubeGeometry each frame.

**321:** the two clicks occupy their respective ratchet planes. The small barrel ratchet has the opposite hand to the larger holding ratchet, matching their opposite freewheeling directions. Both clicks have finite bored bodies and supported pivots; the long T click has a bowed shank to clear tooth crests. The common arbor, rear bearing, output wheel/hub, barrel, and drum have real passages, and the larger ratchet has a hub and spokes. A front drum and exposed rope wrap now share the free rope's depth and tangent, instead of placing the rope through the barrel face. The camera includes the weight's lowest position.

Both models use source-facing cameras, hidden ground, and actual fog-disabled materials. Minimum display cycles are 12 seconds for 320 and 20 seconds for 321. The original chain/material travel and spring/output schedules remain unchanged.

## Finite click motion

Each click is a finite planar part with a bored eye and rounded toe. Its pose comes from an analytic geometric follower: circles covering the shank and toe are intersected with offset ratchet edges and vertices, and the outermost admissible angle is selected. Supports are spaced by physical length, avoiding a tooth entering between sparse supports on the long T click. This is a geometric constraint calculation, **not** a contact-force or inertia simulation.

The full click polygon is separately checked against the ratchet outline at 65 poses per complete cycle. There is no positive-area overlap. Exact planar boundary-gap ranges were:

| Click | Minimum gap | Maximum gap |
| --- | ---: | ---: |
| 320 p | .002000 | .003674 |
| 321 R | .002085 | .003992 |
| 321 T | .002000 | .003971 |

This proximity check prevents nonpenetration from being obtained simply by detaching the clicks from the teeth.

To check tooth-drop continuity, the complete tooth period was sampled at 256 and 4096 subdivisions. Maximum adjacent angular changes decrease with refinement:

| Click | 256 intervals | 4096 intervals |
| --- | ---: | ---: |
| 320 p | .030120 rad | .003198 rad |
| 321 R | .007307 rad | .000460 rad |
| 321 T | .000947 rad | .000065 rad |

Periodic seams agree within 1e-12 rad. These tests support a continuous geometric handoff rather than a finite teleport; they do not prove continuous derivatives, physical drop time, rebound, or dynamically correct seating.

## Checks and performance

```sh
node --test tests/maintaining-clock-interfaces.test.mjs tests/movement-320.test.mjs tests/movement-321.test.mjs
```

All **20 tests pass**. The original tests retain source topology, the constant chain-length/no-slip equations, the prescribed advancing output, and the constant-material-length spring's ideal torque/energy bookkeeping.

New tests query actual rendered vertices, edge midpoints, and triangle centroids:

- 320 click/journals: **192,400** queries over 65 poses.
- 321 clicks/arbor/drum/rope: **1,007,760** queries over 65 poses.
- 320 moving rope against all four actual groove solids: **1,044,480** queries over 17 poses. Rope samples are rebuilt from the updated buffer at every pose; they are not cached from the initial shape. The smallest sampled groove clearance is .002579.

All **2,244,640** selected surface queries clear at a .00001 numerical tolerance. The rope test also verifies stable geometry identity, position/normal typed arrays, and index buffer, and checks that the old intersecting groove decorations stay hidden. These selected finite checks are not a global continuous collision proof.

Final serial Chrome default/source comparisons, front views, and advanced poses produced no browser errors. Full-cycle visible-vertex projection maxima were .836 and .892 NDC, without clipping. Rendered triangles including shadows were 64,016 / 36,268, with 143 / 173 draw calls. One Node screen measured approximately 113 / 77 ms construction and 2.17 / 1.06 ms mean update across 200 poses. No native simulation or expensive geometry bake runs in the browser. Bulk captures remain in `/dev/shm/maintaining-clock-final-*`.

## Explicit residuals

**The output continuity is prescribed, not force-validated.** Neither model currently solves gravity, click bias springs, impact, bearing friction, winding force, elastic energy transfer, or escapement load as coupled dynamics. The positive click clearance and geometric follower do not establish that the chosen loaded holding pose will support the assumed torque without backlash. Existing nominal pitch-contact records remain ideal references; 321 marks these as such in render metadata.

320's lifted crossover remains an inferred prescribed spatial route, without a modeled guide or free-string equilibrium. Constant chain length and no-slip material travel are geometrically enforced, but sufficient traction under weight load is not demonstrated.

321's constant-length Bézier spring is an illustrative shape with an independent ideal torsional law, not a constitutive elastic solution. Its full swept self/contact behavior and the depth hardware supporting both displayed spring-anchor markers remain unqualified; the source omits those mounting details. The exposed front rope wrap shows the tangent and working radius, but does not model changing layers or the complete stored rope reservoir. The visible output gear is involute, but no downstream mating gear or escapement is supplied or contact-tested in this source detail. These limits are deliberately deferred rather than represented as a validated passive maintaining-power mechanism.
