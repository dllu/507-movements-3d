# Movement 239: opposed spur-gear stops

The [official caption and engraving](https://507movements.com/mm_239.html) show two independently pivoted stops acting on opposite sides of spur teeth. The page marks Animated unavailable and registers no inline animation. The lower wheel is abbreviated in the engraving; this reconstruction retains its complete eighteen-tooth circumference. The source depicts no actuator, so the alternating applied torque remains an illustrative demonstration.

## Working correction

Both former source-shaped stop bodies penetrated actual gear teeth by about **0.207**. This was more than a bevel defect: their broad noses and nearby portions were incompatible with the gear's permitted angular travel.

The gear now reuses the standard 20-degree involute spur profile, with the same tooth count and root/pitch/outer radii. The source pivot and nose coordinates remain unchanged. The mounting phase and two limits are solved against the actual tessellated involute segments: **4.916675°** of trapped travel, or **0.245834 tooth pitch**, versus 4.885433° previously.

An offline cutter forms pockets in the existing source outlines across 129 positions in that angular interval. A 0.00012 running relief closes the between-sample slivers. Each stop retains an explicit **0.04-long load land** on its exact limiting flank; at least 0.018 of continuous mating face is checked directly against the real gear triangles. At the source nose, the actual wheel reaction moments per unit normal force are **+2.231375** for the left stop and **−2.172350** for the right stop. Thus the left land rejects clockwise overtravel and the right land rejects counterclockwise overtravel. The stop and gear face normals oppose one another; this is not clearance obtained by removing the working faces or separating their depths. The working bodies overlap the gear axially by 0.16.

The left eye is joined to its web with a short inferred connection, replacing the earlier detached cap/solid-hub disguise. Both stop eyes, the complete gear body and its hub now have actual bores. Three rear bored journals connect to posts and the existing support rail. The wheel index is flush with the face and lies inside the root circle. The source-facing view retains the whole wheel, disables ground/fog, and has a six-second minimum demonstration period.

## Validation and regeneration

Run:

```sh
node scripts/generate-opposed-spur-239-outlines.mjs
node --test tests/movement-239.test.mjs tests/opposed-spur-239-contact.test.mjs
```

The generator takes roughly half a second locally and regenerates `src/simulation/baked/opposed-spur-239-outlines.js` byte-for-byte. Expensive profile sweeping is absent from browser construction and playback; updates retain existing buffers.

The **13 tests** include the existing dense free-play and analytic derivative checks plus independent actual-triangle contact normals, nonzero mating face span, rejected overtravel, 65-pose working-surface clearance, finite bores and connected journals, repeated-cycle position/velocity continuity, and complete visible-vertex bounds. The selected working-surface minimum is **−5.72e−8**, within float32 rounding. The former approximately 0.207 intersections are closed.

## Remaining assumptions

The stops remain seated by prescription, and the input test torque is prescribed. Gravity seating, hinge reactions, friction, impact and loaded holding strength are not dynamically solved; loads can tend to lift a freely hinged stop. The viewer states these qualifications. The checks establish finite geometry, resisting directions and a continuous bounded demonstration, not passive load capacity or an exhaustive all-pairs collision certification. No native dynamics claim is made.

## Integrated browser check

Final source/default/oblique Chrome views load without errors or clipping.
The 17-pose visible-vertex sweep has maximum normalized extent .850;
default rendering uses 56 draws and 40320 triangles including shadows.
The production build passes in 23.46 seconds, and both 233/239 packaged
desktop/playback/mobile checks pass in 7.6 seconds. Their construction/update
screens have no flags or geometry growth. These checks qualify presentation
and interaction, not the passive load assumptions above. Bulk evidence is
outside Git under /dev/shm/family42-*.
