# Bearings 250 and 270

Both movements retain their analytical pure-rolling laws. This pass corrects
visible working interfaces and source proportions without live physics.

The [250 source](https://507movements.com/mm_250.html) places the shaft on two
large support wheels. Its animation supplies journal/support radii 0.6/5 and
the −0.12 speed ratio. Inspection of the actual animation construction confirms
four diagonal spokes per support wheel: the previous model mistook their eight
outline edges for eight spokes. Its pedestal was also much too short, behind
the wheels, and intersecting their hubs and lower rims.

250 now has four connected spokes, flat wheel rims, bored support hubs, fixed
axles and a front pedestal extending below the wheel bottoms. Smooth casting
curves and the three openings follow the source proportions; this is an idealized
casting, not a traced mesh. Markers sit at visible faces and the journal/support
contacts retain their original exact ideal tangencies.

The [270 source](https://507movements.com/mm_270.html) explicitly leaves Brown's
intended bearing style uncertain. The model retains the site's six-roller
interpretation and combines the assembled/cutaway drawings. Evaluating its
animation setup gives outer/cage/roller rates `76/56`, `1`, `19/9`; normalizing
to the outer race gives the existing `14/19` cage and `14/9` roller ratios.
The first roller starts at the top, matching the engraving's exposed view.

270's formerly painted roller holes now have finite bores and cage-mounted pins.
The rear retainer clears the roller ends. Working races and belt omit bevels
that previously intruded into contacting parts; finely sampled circumscribed
inner outlines avoid polygonal penetration. The unsupported invented stand is
removed. Belt markers fade at the open drawing's ends, and the pulley index
remains on its actual annular face. Ground/fog are disabled for both models.

## Validation and limits

The 16 existing movement tests retain rolling ratios, contact velocities, marked
closure and production timing checks. Only the erroneous spoke-count assertions
change. Five additional checks inspect actual bores, geometric contact proximity,
retained geometry and selected finite moving/fixed pairs at 25 off-grid poses
over each marked assembly closure. Both directions of each pair are sampled;
the test does not claim exhaustive continuous collision detection.

All 21 focused checks pass. Final source/default/oblique browser captures show
no errors or clipping over 17 cycle poses (maximum projected coordinates 0.768
and 0.817). Review artifacts are kept in `/dev/shm/bearing26-*`, outside Git.

Minimum display periods are one input turn in approximately 6.28 and 6 seconds.
Pure rolling, equal cage spacing and constant driving rates remain prescribed.
Bearing forces, slip, lubrication and elastic deformation are unsolved. Axial
depths, axle fastenings and the 270 retainer pins are inferred constructions;
the cutaway omits the machine supporting its fixed inner journal.
