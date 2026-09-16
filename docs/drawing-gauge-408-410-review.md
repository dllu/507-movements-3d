# Drawing gauges 408–410: finite guides, real slots and outward setup

Primary references: [408](https://507movements.com/mm_408.html),
[409](https://507movements.com/mm_409.html), and
[410](https://507movements.com/mm_410.html). Their current official pages mark
animation unavailable. Captions and engravings define the mechanisms; exact
sizes, clearances, depth layers and manual timing are reconstructed.

## 408: centrolinead

The ideal concyclic geometry and constant vanishing point are retained. Leg
faces are offset by the finite guide-pin radius, so the cylinders touch rather
than occupy the rules. The usable sweep is limited to ±0.26 radians on the joint
locus; the former ±0.42 setting brought the pins into the head. Both leg eyes
and the head have actual common-axis bores, the legs occupy separate depth
layers, and small clamp stems pass through real curved adjustment slots.
The head's open left side follows the source. Oversized presentation boards and
construction-circle overlays are removed from the mechanism view; the geometric
construction remains in metadata. The finite rule-face offsets are an explicit
regularization of Brown's point-line construction.

## 409: proportional compasses

The solid legs and painted slots are replaced by flat plates with genuine long
openings and circular ends. A narrow bored slider sits in each leg's slot, both
on one small common pivot shaft. Separate leg layers and retaining washers
leave clearance throughout opening. The sharp ends taper into one common
measuring plane. The exact fixed proportion and existing scale calibration are
unchanged; adjustment is locked during the opening demonstration.

The scalloped grip is recovered with the existing classical OpenCV extractor:
`generate-compass-grip-profile.py` selects visible contour 11 and uses a shoulder
and tip to define its axis. Extraction took about 24 milliseconds, retaining 51
contours overall and simplifying 7,899 source vertices to 881. Only the observed
grip contour enters production, with its source SHA. Straight webs, circular
slot ends, sharp tips and occluded connections are ideal mechanical geometry.
The visible grip is reused on the other leg; this is not a pixel-perfect recovery
of separately drawn sides or a claim that CV inferred hidden hardware.

## 410: bisecting gauge

The released cheek now moves outward from the workpiece (1.65 to 1.98), instead
of moving inward to 1.18 and cutting through the wood. Its equal-link midpoint
law remains exact. Both cheeks have a real crossbar passage, the adjustable
cheek has a stem bore, and lower pockets accommodate the two bored centering
links in separate planes. Their common marker pin spans both eyes, and the
actual cone tip touches the wood. Contact trims and feet stop at the workpiece
faces. Manual locking and marking forces remain prescribed, not load simulated.
The initial view presents the plank diagonally as in the engraving; tests apply
the presentation rotation when comparing world-space positions.

## Checks and limits

The 33 focused tests include exact construction/ratio/midpoint laws and rate
checks, plus actual finite interfaces: 65-pose pin/head/leg sweeps for 408,
33-pose compass surfaces and through-slot rays for 409, and 129-pose link,
guide, screw-stem and wood clearances for 410. The grip source hash is checked.
These are selected working interfaces, not exhaustive continuous collision
certificates. No new live physics is needed for these determinate constraints.
All three omit ground and fog and use sampled whole-cycle camera bounds.
Default/oblique source comparisons show no errors or cropping; packaged mobile
checks are part of the integrated pass.

The same review caught 403's pencil cone pointing away from the trace. Its
orientation is corrected, with a regression checking the transformed cone apex
and actual mesh vertices, rather than only its nominal center/height formula.
