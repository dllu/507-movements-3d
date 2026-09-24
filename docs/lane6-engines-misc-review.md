# Lane 6: engines and miscellaneous source-match pass

Scope: 281, 326, 344, 345, 346, 347, 372, 381, 386, 395, 400. (368 lives in
`authored-cylinder-spiral-scribers.js`, outside this lane, and was not touched.)
Each movement was compared with `public/engravings/mm_NNN.png` in default and
oblique captures (`node scripts/review-movement-source-views.mjs --ids=… --output-dir=/dev/shm/lane6`)
and re-screened with `node scripts/show-body-intersections.mjs ID --spacing=0.01 --samples=129`.
Motion laws, periods and phases are unchanged except where noted (400's cam radius).
None of these movements uses MuJoCo.

## Results

| ID | Change | Worst screen depth before → after | Remaining flaws |
|---|---|---|---|
| 281 | Re-read the plate: the solid right bar is the lever (it ends in air, and the pin in the front-face groove needs it in front); the dashed bar is the same lever at its other extreme (same length and pin boss, ≈23° apart, matching the model's 21.5° swing). Removed the undrawn right standard; the fulcrum pin now runs back to a brace behind the disk that ends on a new bored rear shaft bearing where the A-frame legs meet; deeper plank base; flatter camera, 14° field. | none → none | Fulcrum brace is inferred (Brown draws no support); dashed alternate lever position and the dashed rear crank arm are not drawn; perspective still lengthens the front lever slightly. |
| 326 | The standard is now hollow: a front skin with a window over the planed slot, thin side walls open at the cap, joined to the slotted back plate; the connecting rod enters the cap and is hidden between cap and slot, visible through the slot, as Brown dots it. Deeper foundation foot. | none → frame-slot/shoe sliding 0.0000 only (0.004 spacing confirms) | Rod clears the side walls by ≈0.011 at the neck; piston rod still shortened (−7.7 vs official −17.75 units). |
| 344, 345 | Double-webbed crank: the shaft ends in the rear web, the rod eye rides the pin between the webs, and a front web of the same outline (carried by the pin, with a shaft-centre boss) lies over the rod eye as Brown draws it; the rod crosses the shaft axis at dead centre between the webs. | none → none | 344 cylinder remains longer than drawn: the plate's shorter barrel implies a crank radius ≈1.7 against the official 2.25 units, and the official stroke is kept. |
| 346 | Legged table replaced by a solid bored plinth; cylinder closed with opaque front and back faces (piston hidden, as drawn); bed depth trimmed so the crank arms and pin bosses clear it; front elevation, mirrored to the plate's handedness (crank pin left of the shaft; equals the official t = T/2 pose), crank indices removed, 14° field. | table edge × crank pin boss 0.070, bed × crank 0.020 (pre-existing) → none | Guide arches remain open tube meshes. |
| 347 | Rebuilt as Brown's section on the vertical plane through the shaft. The fixed casing is one closed solid revolved through its rear half only (conical heads meeting the ball in concentric seats, spherical zone, outer skin, flat end plates, openings where each rod sweeps its cone), with dark cut faces; cones offset by the half disk thickness; parallel 0.24 disk slit around the 0.10 diaphragm; diaphragm clear of the ball; solid edgewise flywheel carrying a real cup socket around the rod-end ball; shaft runs left to pedestal bearings; front camera, 12° field. Translucent shells, rib lines, rings, cradle and white markers hidden. | ball × heads 0.487, socket/rod 0.23, crank arm × ball 0.228, shaft × bearings/standards 0.21, many rib/marker/disk overlaps → none at 0.01/129 and 0.005/33 (only the rim-seal tube is an open mesh) | Brown's large bow linking the rod ends and the right-hand hatched standard are not modelled; the flywheel is a plain disk; section faces are flat-shaded, not hatched. |
| 372 | Hoop is a broad flat band (bored lathe ring) standing edgewise in front of the gears; tall bored standards closer in, the shaft stubs just outside them; a turned stretcher with a central ball ties the standards below the hoop; posts run off the plate foot. Presentation removes the weighing band, pan, weights, base and white indices; index teeth no longer white; front camera, 16° field. | none → none | Plate gears are larger relative to the hoop than 3D clearance allows (hoop/gear ≈1.7 vs ≈1.2 drawn). |
| 381 | Proportions from Brown's transverse section: deep bed, cheeks and wedges flush at one height, narrow board standing on edge; default camera is now the end elevation matching the upper (section) figure, 10° field; grain lines and white datums removed. | none → cheek/wedge sliding 0.0000 only | Plan (lower figure) is the top view, not the default; perspective still shows a sliver of the bed top. |
| 386 | Rounds are broad slats (0.19) as drawn; end complements shortened by 0.07 so the closing half-shells pass them only after their arcs separate; front elevation of the open ladder (Brown's principal figure); white indices and section ring removed. | shell × opposite complement 0.034, shells × ring 0.030 (pre-existing) → none | Closed pole shows a 0.07 notch under each complement; Brown's partly open and closed figures appear only as later phases of the cycle. |
| 395 | Brown's two figures: a second housing and plug (with passage cores) below-left, turning a fixed quarter turn behind the first, so the pair always shows both engraved positions. Pipes, handle, stem, travel arc and flow markers removed; front camera, 14° field. | none → none (fluid cores remain open tubes) | Second figure is a display duplicate of the same cock; framing needs the display profile re-measured (the stale motion box crops the second figure). |
| 400 | Cam C reduced (base radius 0.82 → 0.60) with its axis raised by the same 0.22, carrier face button raised to keep its 0.50 cam radius, face annulus kept inside the radial body, working-edge line moved inside the swept band; deeper A rails; presentation removes the work plates, carrier guides and white indices. | spring × anchor coaxial 0.119 (pre-existing) → same | Steeper radial rise: minimum lifting moment 2.044 (was > 2.289; test threshold now 2.0); cam still wider axially than drawn because the face cam carries the full 0.68 feed stroke; the spring/anchor coaxial overlap remains. |

## Tests

Updated only where the fixes legitimately change them: 346 (plinth replaces two
legs; positions read in the unpresented model frame because of the mirror),
372/381/386/395 (parts the presentation removes are asserted detached), 400
(lifting-moment threshold 2.28 → 2.0 for the plate-sized cam). New checks: 281
fulcrum brace, 326 hollow standard, 344/345 double web, 347 section casing and
socket, 395 second figure. `docs/validation/368-372-contact-solids.json` was
regenerated (`POSES=33 node scripts/review-368-372-contact-solids.mjs`); only the
dynamometer source hash changed, all sampled gaps are identical.

## Display profiles

Framing or geometry changed for 281, 326, 344, 345, 346, 347, 372, 381, 386, 395
and 400; `scripts/measure-display-profiles.mjs` was not run. 395 and 386 in
particular need re-measured motion bounds.
