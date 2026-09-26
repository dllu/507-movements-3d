# Pass 62 rotated-view audits

Reviewer: Claude Opus 5.5 (read-only audit lanes p62-audit-a and p62-audit-b), 2026-09-26.

Scope: the 171 movements rated reasonable after passes 59 to 61. Each was compared with its plate in the default view, then inspected rotated ±60° about vertical, from the back and top, and at several motion phases including just before the loop seam. Escapements also got 16-phase strips and intersection screens. The loop-seam checker and the bad-face scan ran on audit B's IDs.

## Findings

| ID | Severity | Problem | View |
|---|---|---|---|
| 39 | minor | Flywheel rim is a thin spoked hoop; Brown draws a broad rim (about 1/6 of the radius) divided by four radial joints, so the outer wheel reads much lighter and different from the plate. | default, all phases |
| 86 | minor | Undrawn orange drive pulley on its own grey A-stand at the right (its rim shows at the default view's right edge), plus a pump barrel/hanger cage and rods under the base that peek into the bottom of the default view; Brown draws only the rope ends running off to the right and nothing below the base. | default right/bottom edges; zoomed-out and +60 deg views |
| 90 | minor | Undrawn grey U-shaped guide bracket joining the two rod guides runs behind the yoke (visible whenever the view is turned). | back and top views |
| 91 | minor | Undrawn grey C-shaped guide bracket joining the upper and lower rod collars behind the yoke. | +60/-70 deg and back views |
| 96 | minor | Undrawn flat grey arm from the cam hub to the rod guide collar behind the cam. | back and top views |
| 97 | minor | Undrawn grey L-arm from the disk hub to the rod guide behind the disk; the disk's plain back face also has no quadrant rotation cue. | back and top views |
| 98 | minor | The turning orange crank disk has no quadrant rotation cue: its exposed front rim and plain back face are featureless, so its spin reads only from the crank pin. | default and back view |
| 99 | minor | The guide legs end in undrawn floor feet (Brown runs the two guide lines off the bottom), and an undrawn grey arm links the disk hub to the guide frame at the back; the plain back face of the spiral disk has no rotation cue. | default bottom; back view |
| 100 | minor | Undrawn grey link bar joining the disk axle to the slotted lever's pivot behind the mechanism. | back and top views |
| 101 | minor | Two undrawn grey posts hang the rod guides from the ceiling block; Brown draws the guides free-standing and separate from the hatched ceiling. | default and rotated views |
| 105 | minor | The yellow blank on the anvil is inside the default view (its presentation note says jaw, anvil and blank run off the bottom), and at the bottom of the stroke the ram swallows it: the blank disappears into the ram rather than being struck. | default phase 0 vs phase 0.5 |
| 114 | minor | The yoke's internal rack teeth are pointed sawtooth triangles; Brown draws square, regular rack teeth. | default, zoomed |
| 126 | minor | Undrawn additions appear when the view is turned: a grey bracket with a small guide pulley and a hanging weight on the blue rope, and a toggle on the end of the red rope. Brown draws the ropes running off the plate. | +60/-70 deg and back views |
| 181 | minor | The top view shows undrawn black cylinder weights on the rod ends below the catches. | top |
| 182 | minor | Same undrawn cylinder weights on the rod ends as 181. | top |
| 183 | minor | Undrawn black block weights hang on the valve rods and rise into the middle of the frame (def33/def66). Brown draws plain rods running off the plate. | def33, def66, top |
| 184 | minor | Same undrawn black block weight on the right valve rod, visible mid-frame. | def33, def66 |
| 238 | minor | Pallet B is modelled as a rounded knob with a small stepped/serrated ledge where the plate draws a plain square step. The star point slides over the knob face. | def0/def66 close crop |
| 251 | minor | Brown's continuous top crossbeam is split, and an undrawn rope drum sits on a thin rod axle. The rope end stops short of the eye, leaving a visible gap. | def0 top-centre crop, top |
| 264 | minor | Loop-seam checker: worm position jumps 0.52% at the loop point, with a velocity kink (15.4). | loop seam (check-loop-seams) |
| 272 | flawed | An undrawn grey frame (base bar, three uprights, bracket) carries the cam shaft and the inclined rod. The plate draws only two small rod guides and a bare shaft. | def0, rotp60, back, top |
| 292 | minor | The studs are tiny face nicks, far smaller than the plate's clear triangles. Front pallet c is a small rectangular tab, not Brown's wedge pallets R/c. The intersection screen shows pallet-to-stud touches only. | def0 close crop |
| 293 | minor | The escape wheel stays still for about 94% of the cycle, then advances about 27 degrees in the last ~5%, right at the loop seam. The impulse is therefore a sudden jump at the seam, and the notched roller just touches the wheel (0.0001). | seam phases 0.9-1.0 |
| 297 | minor | Brown dots arm A behind the wheel, but the model puts the arm and blade pallets in front of the lantern. The lantern pins stick out past both discs, so the pallets act on protruding stubs, not between the discs. | def0, rotm60, top |
| 304 | minor | All escape pins share one half-round form. The caption and plate show two forms (A left, B right). The pins also protrude far out of the wheel face. | def0, rotp60, top |
| 313 | minor | The cycle is 0.5 s, so the balance swings about 300 degrees in a quarter-second and the wheel steps twice a second. It reads frantic. The wheel spokes and rim are thinner than Brown's broad cross. | phase strip |
| 354 | flawed | An undrawn grey wire frame (trapezoid side struts, cross bars, back cross with ring) carries the rod guides. The plate draws only the two guide blocks. | def0, back, top |
| 358 | minor | The band end is anchored to an undrawn grey wall bracket and T anchor (off to the side in rotated views). The band is a thin tube, while the plate draws a twisted rope/band. | rotp60, rotm60, top |
| 373 | minor | The belt runs off to an undrawn remote pulley on a thin free-standing post with a base plate. Brown's belts leave the frame. | rotp60 |
| 393 | minor | An undrawn grey L-shaped post and arm rises from the table to hold the upright shaft. The shaft also runs down through the translucent lens to the table (intersection). | rotp60, rotm60, back |
| 400 | minor | The top view shows an undrawn grey guide bar with three blocks above bar A. | top |
| 421 | minor | An undrawn grey upright post rises from the cylinder casing to carry the crankshaft. The plate draws no standard, only the dotted flywheel. | def0, rotp60, rotm60 |
| 490 | minor | An undrawn flat grey deck board stands behind the plan view and fills the back view. The guide-pulley brackets are bolted to it. | rotp60, back, top |
| 492 | minor | The release rope runs to an undrawn post with a pulley and lever, and a floating hand appears at the top of the tackle rope. | rotp60, rotm60, top |

Every finding was handed to a pass-62 fix lane; see docs/p62-mujoco-review.md, docs/p62-followup-review.md, docs/p62-auditfix-a-review.md, docs/p62-auditfix-b-review.md and docs/p62-plate-esc-review.md.

## Clean in every captured view

1, 2, 3, 4, 5, 6, 8, 11, 23, 24, 25, 26, 28, 41, 42, 43, 44, 47, 56, 58, 61, 62, 64, 67, 70, 73, 76, 77, 78, 79, 80, 81, 82, 83, 84, 89, 92, 94, 95, 102, 103, 104, 106, 107, 108, 109, 110, 111, 112, 113, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 127, 150, 153, 154, 158, 165, 168, 169, 172, 173, 178, 186, 187, 189, 192, 193, 194, 196, 197, 201, 209, 226, 234, 244, 250, 252, 254, 256, 263, 273, 279, 281, 282, 289, 290, 294, 300, 301, 302, 306, 315, 320, 323, 328, 331, 334, 335, 336, 337, 338, 346, 347, 348, 352, 361, 362, 389, 394, 401, 411, 413, 415, 428, 433, 436, 445, 446, 461, 464, 469, 471, 473, 481, 493, 494, 495
