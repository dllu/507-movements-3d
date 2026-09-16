# Parabolic and gyroscope governors: 274 and 357

Sources checked 2026-09-16: [274](https://507movements.com/mm_274.html) and [357](https://507movements.com/mm_357.html). Both official pages mark animation unavailable and provide no canvas model. The first caption specifies guided anti-friction wheels linked to a sliding sleeve. The second specifies a stationary toothed circle, an orbiting pinion, a divided axle with a universal joint, a hinged gyroscopic wheel and spring-connected valve linkage.

## Corrections

274 now has actual bores through its roller wheels, sliding sleeve and fixed spindle bearing. The previous solid cross-pin passed through the spindle and had the wrong axis for the planar rod eyes. Separate side pins and short sleeve brackets now support finite bored connecting rods. Their depth layers clear the rolling wheels; extended roller axles engage the rod eyes. The existing exact quadratic guide, normal-offset roller path, connecting-rod closure and rolling-distance law remain unchanged. The engraving's arm outline remains an idealized parabola, not a traced ornamental outline. The display foundation is hidden, and the default camera is near the source front view.

357 now uses the shared `bevelToothGeometry`/`bevelBodyGeometry` Tredgold involute approximation for **both** working meshes. The stationary 60-tooth circle and 12-tooth radial pinion share a pitch-cone apex, 5:1 ratio and module 0.085. Their complementary cone angles are `atan(5)` and `atan(1/5)`. The equal lower 18-tooth gears have 45-degree cones, module 0.068889 and one shared apex. Tooth phases are matched to the existing physical rotation laws. The large circle retains an open center. These replace the old block crown teeth and incompatible decorative bevel proportions.

The heavy disk was located through the universal-joint/hinge region; it moves outward on its axle while retaining its prescribed tilt and spin. The input/output shaft ends and yoke necks now stop short of the cross. An open hinge frame, separated trunnions and a bored neck journal provide the tilting support without a solid pin crossing the rotating axle. The radial carrier member moves below the disk sweep. Hinge, valve-rod and outer axle journals are bored. The lower standard has open shaft passages, and two lower struts join previously floating fixed ring legs to the base.

The spring reuses `tubePathUpdater`, retaining GPU buffers and a constant 0.027 wire radius as its endpoints change. The old whole-object axial scale stretched the wire into thick overlapping lobes. Fog and scene ground are disabled. Both models enforce a twelve-second minimum demonstration cycle, preserving all ratios rather than independently slowing selected outputs.

## Evidence

```sh
node --test tests/governor-274-357-solids.test.mjs \
  tests/movement-274.test.mjs tests/movement-357.test.mjs
```

20 tests pass: fifteen existing source/kinematic regressions and five scoped finite/scene-stability tests.

The new finite tests sample actual rendered vertices, edge midpoints and triangle centers at 17 full-cycle poses. Extra axial sections through long cylinders catch narrow joint crossings that ordinary mesh vertices can miss. Selected shaft/journal/rod/guide/rotor/frame interfaces execute 618,732 queries for 274 and 3,229,048 for 357, with minimum capped gaps of 0.00212 and 0.00579 scene units. No sampled penetration exceeds 1e-5.

A further 748,044 queries cover 33 poses across one tooth period of each actual conical gear pair. Minimum distances are 0.004116/0.003338; maximum closest sampled gaps are 0.004128/0.003353. Thus the checks establish close working surfaces as well as nonpenetration. These finite clearances are deliberate visual mesh clearance, not a force-contact solution; Tredgold flanks are an approximation to generated bevel flanks, not exact octoids. Tooth counts and dimensions are inferred from the schematic.

The scene and geometry/position-array identities remain stable over updates. A spring regression measures actual curve endpoints and constant wire radius; the old assertion only measured scale. The legacy mesh-count expectation accounts for the added hinge support and lower frame. No geometry generation or native physics runs in browser playback. Representative 357 cold construction is 162 ms, including 33 poses for camera fitting; mean update over 100 calls is 0.28 ms.

Final Chrome source/default/front/advanced views show both complete mechanisms without errors. Seventeen full-cycle projected-vertex poses have maximum absolute X/Y coordinates 0.778 (274) and 0.833 (357). Default rendering, including shadows, is 118/408 draw calls and 59,040/141,816 triangles. The source arrangement remains recognizable, while 357's lower stationary support is a simplified structural frame and the lower input shaft retains its reconstructed depth direction rather than the engraving's apparent rightward direction. Bulk screenshots and reports remain in `/dev/shm`.

## Remaining limits

274's guide parameter and spindle speed remain prescribed together. The geometric constraints and rolling relation are exact within that construction, but passive governor response, ball/roller force equilibrium, friction and stability under changing engine load are not dynamically validated.

357 retains a quasi-static spring/gyroscopic torque equilibrium and the analytical Cardan velocity modulation. Its changing tilt is imposed from that reduced equilibrium, not integrated from applied loads. The reduced torque law does not account for the changed axle-offset gravity moment or all frame/shaft inertia. Spring constitutive behavior, transient stability and the full governor/engine feedback loop are unvalidated. The selected finite checks cover the corrected interfaces; they do not certify every yoke/fork/lever contact or every spring self-contact continuously. Remaining linkage joint solids outside that scope are still schematic. Fixed material joins deliberately overlap. These limits are documented rather than claiming a passive dynamics solve.
