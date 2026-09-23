# Pass 49 visual reviews

Reviewer: Claude Opus 5.5 — primary agent, 2026-09-23. Each movement's default
production-route capture (`scripts/review-movement-source-views.mjs`, which
also checks full-cycle framing) was inspected beside Brown's engraving. A
visual check records what was seen; it corrects nothing by itself and does not
change a row's intersection status or physics qualification.

| Movement | Observation |
| --- | --- |
| 007 | Faithful bevel reversing gear, fast/loose pulleys and belt; vertical shaft C has no visible support. |
| 012 | Faithful single sheave, rope and weight; Brown's hand is replaced by a schematic grip. |
| 025 | Faithful mitre bevel pair and shafts. |
| 090 | Eccentric and yoke read correctly, but the yoke's outer outline is lumpy (hand-drawn irregularity) where an ideal oval is intended. |
| 091 | Faithful triangular eccentric in its yoke; guide frame added. |
| 095 | Faithful inclined disk, roller follower and wall bracket. |
| 096 | Faithful heart cam; the follower carries a return spring not drawn by Brown. |
| 137 | Faithful cam, roller yoke and lower lever; the right-hand eye and hanging rod are reduced to a pivot disk. |
| 138 | Faithful three-lobed cam and guided rod. |
| 206 | Faithful ratchet wheel and pawl lever; wheel teeth slightly blunter than the plate's saw teeth. |
| 211 | Faithful mutilated wheel, pinion and stop finger. |
| 215 | Faithful stop wheel and driver. |
| 216 | Faithful internal ring and two pinions; internal teeth only on the working arc. |
| 255–259 | Faithful flat, plain, concave, V and notched-V pulley forms on shafts with bosses. |
| 281 | Faithful heart groove disk and A-frame; the lever passes in front of the disk where Brown dashes it behind. |
| 286 | Faithful wedge lever on the rod and lower toe arm on its shaft. |
| 445 | Channel, chamber and valve read as a tank above a cone chamber rather than Brown's section layout; translucent fluid envelopes. |
| 446 | As 445 with the rising jet; layout differs from Brown's section. |
| 496 | Rollers A/B, flyer and bobbin follow the plate; rollers are fluted and the flyer is larger than drawn. |

## Pass 50 batch: 47–62

| Movement | Observation |
| --- | --- |
| 047 | Faithful sectioned friction clutch, shaft and lever. |
| 048 | Jaw clutch, shaft and lever faithful; the end gear is wider and carries a mating pinion larger than drawn. |
| 049 | Faithful double-bevel reversing gear and pedestals. |
| 050 | Faithful Hooke joint forks and cross from Brown's oblique view. |
| 051 | Faithful joint rings and shafts. |
| 052 | Faithful stud clutch, sleeve and lever. |
| 053 | Faithful bevel reverser with jaw clutch and lever. |
| 054 | Faithful face-toothed wheel with pinions A and B. |
| 055 | Internal gear C with A and B read correctly, but an undrawn grey backing disk fills the ring. |
| 056 | Faithful lathe gear engagement, lever and bed. |
| 057 | Faithful crossed band, internal ring and inner gears. |
| 058 | Faithful stepped gear pairs, drums and belt. |
| 059 | Faithful selector gearing, drums and belt. |
| 060 | Faithful two belt pairs. |
| 061 | Faithful belt drive with sectioned bevel box and lever. |
| 062 | Faithful stepped pulleys with sectioned bevel box. |

## Pass 50 batch: 64–81 (excluding 71, 73)

| Movement | Observation |
| --- | --- |
| 064 | Faithful heart cam, worm wheel, lever and spring. |
| 065 | Disks C and D and the lever read correctly; D's pin holes render as long dark streaks rather than round holes. |
| 066 | Faithful worm wheel and weighted arm D. |
| 067 | Faithful worm wheel and cam E. |
| 068 | Faithful mutilated wheel A and notched wheel C. |
| 069 | Faithful ratchet A and single-tooth driver B. |
| 070 | Pin disk A and disk C read correctly; C is opaque where Brown draws it as an overlapping outline. |
| 072 | Faithful tumbler, lever and blocks. |
| 074 | Faithful bevels A, B and face wheel C. |
| 075 | Faithful ratchet wheel, lever and pawls. |
| 076 | Ratchet A and pawl faithful; the large wheel is drawn complete with spokes where Brown shows only its rim segment D. |
| 077 | Faithful pin wheel and lever links. |
| 078 | Faithful A-frame, ratchet and pawl levers. |
| 079 | Faithful internal ratchet, pawls and toggle links. |
| 080 | Faithful slotted rack and crossed catches. |
| 081 | Faithful spring rack and eccentric. |

## Pass 50 batch: 82–101 (excluding 90, 91, 95, 96)

Captures come from the production routes; MuJoCo movements load their live
physics models. Earlier batch sheets in this pass halved image height, which
distorted the model and engraving alike, so the side-by-side comparisons
still hold. These checks used true-aspect sheets.

The source-presentation layer now also presents MuJoCo and baked models,
which previously bypassed it. Removal patterns fall back to object names
when a part has no role.

| Movement | Observation |
| --- | --- |
| 082 | Faithful treadle ratchet wheel, pawl links and pump rods. |
| 083 | Faithful spring sector C on rack D with arm A. |
| 084 | Faithful double internal racks and pinion. |
| 085 | Faithful bracket, spindle and cam A. |
| 086 | Presented without the undrawn belt drive, remote pulley and rear pulley. Wheel A, catch B, cam C and the stop now match. The rope descends to a guided pump rod at the left; the plate shows only hatched rope runs. |
| 087 | Faithful bevel reversing gear and lever. |
| 088 | Faithful disk-wheel B, stops C, D and cam A. |
| 089 | Presented without the undrawn crosshead, guides, bed and shaft support. The strap, bolts and rod flange match; the rod ends in its bored eye where Brown breaks it off. |
| 092 | Faithful spoked crank wheel and slide. |
| 093 | The production MuJoCo model is presented without its undrawn frame, crossbars, posts and stem guides. The synchronous registry model keeps its reconstructed frame for offline checks. |
| 094 | Faithful slotted disk and spiral groove. |
| 097 | Faithful grooved heart cam and follower. |
| 098 | Faithful endless groove and rod. |
| 099 | Faithful spiral groove and guided follower. |
| 100 | Faithful quick-return slotted lever. |
| 101 | Faithful slotted bar and guide blocks. |

## Pass 50 batch: 102–121

Captures come from the production MuJoCo routes, on true-aspect sheets.

| Movement | Observation |
| --- | --- |
| 102 | Faithful bolt and nut. |
| 103 | Faithful bracket, leadscrew and slide; the bed is a closed box where Brown breaks it off. |
| 104 | Faithful worm, wheel and saddle. |
| 105 | Faithful screw press and handle. |
| 106 | Faithful barrel cam groove and forked follower. |
| 107 | Faithful serpentine groove and follower. |
| 108 | Faithful crossed right- and left-hand grooves, frame and follower. |
| 109 | Faithful paired screws, nut bar and base gears. |
| 110 | Faithful thread-cutting screws, frame and handle. |
| 111 | Faithful differential screw pair. |
| 112 | Faithful Persian drill with its nut. |
| 113 | Faithful rack on rollers and pinion. |
| 114 | Faithful mutilated pinion in the double-rack frame. |
| 115 | Faithful paired pinions in the equal-rack frame. |
| 116 | Faithful pinions and double rack, the two racks in different planes. |
| 117 | Faithful roller yoke, cam and guides. |
| 118 | Faithful stroke-doubling racks and pinion. |
| 119 | Faithful oblong endless rack, pinion and slotted guide. |
| 120 | Faithful segment clamp jaws, sector and pinion. |
| 121 | Faithful reversible click wheel, pawl and lever. |

## Pass 50 batch: 122–141

| Movement | Observation |
| --- | --- |
| 122 | Faithful gear pair, links and crank. |
| 123 | Faithful double rack and toothed sectors. |
| 124 | Faithful bow drill. |
| 125 | Faithful cascaded beams and three wheels. |
| 126 | Faithful rope pulley and bell cranks. |
| 127 | Faithful pinion between opposed racks and rod. |
| 128 | Faithful three-arm pin wheel in its slotted yoke. |
| 129 | Faithful differential windlass, pulley and hook. |
| 130 | Faithful shears and eccentric. |
| 131 | Faithful slotted lever, sector and rack. |
| 132 | Faithful toggle-bar press; the frame is simplified. |
| 133 | Faithful press frame, sector and pinion. |
| 134 | Presented without the undrawn rear pedestal, foot and bearing: the spoked drum and separator plates stand on the rope run as in the plate. |
| 135 | Faithful yoke, triangular cam and disk. |
| 136 | Faithful serrated wheel, spring rod and bracket. |
| 137 | Faithful cam, rollers and yoke. |
| 138 | Faithful three-lobed cam and guided rod. |
| 139 | Faithful rack frame, pinion, links and carriage. |
| 140 | Faithful toggle press links and lever. |
| 141 | Faithful band saw frame, pulleys and table. |

## Pass 50 batch: 142–161

The presentation test now builds each entry's production route (live
MuJoCo, baked bundle or special factory) as well as the registry model.
Several production factories name their parts differently from the
registry.

| Movement | Observation |
| --- | --- |
| 142 | Presented without the undrawn base, rear post and slider guide: the carrier disk, fixed pinion, planet wheel, crank and slider stem match. The traversing bar is longer than Brown's stub. |
| 143 | Faithful sliding worm, wheel and bed. |
| 144 | Faithful lazy-tongs. |
| 145 | Faithful wheel, beam and treadle links. |
| 146 | Faithful framed yoke and eccentric. |
| 147 | Faithful fan governor, vanes and hand lever. |
| 148 | Faithful geared crank and oval cam frame. |
| 149 | Faithful twin cams and levers. |
| 150 | Presented without the undrawn base, posts and valve-rod guide. Sliding cam series, lever and rod match, though an invisible stroke envelope keeps the framing loose. |
| 151 | Presented without the undrawn base, posts, upright and nut guides. The opposite-hand screw, end bearings, nuts, worm and wheel match. |
| 152 | Faithful trammel ellipsograph. |
| 153 | Disk, elbow lever and bar faithful. The baked fixed body still carries an undrawn base rail and posts. |
| 154 | Faithful weighted bell crank, cord and weight. |
| 155 | Ratchet wheel, elbow lever and pawl faithful. The baked fixed body still carries an undrawn base and posts. |
| 156 | Presented without the undrawn base, posts and output guide; disk, slotted bell crank, link and rod match. |
| 157 | Presented without the undrawn base, posts and output guide; disk, rod, bell crank, link and output rod match. |
| 158 | Faithful treadle, crank and pedestal. |
| 159 | Faithful cord treadle and pulleys. |
| 160 | Faithful spring pole, pulley and treadle. |
| 161 | Faithful governor balls, links and collar. |

## Pass 50 batch: 162–181

| Movement | Observation |
| --- | --- |
| 162 | Faithful governor, sleeve and reversing bevels. |
| 163 | Faithful governor, lever and belt-shifting frame. |
| 164 | Faithful toggle lever and weight. |
| 165 | Faithful wave cam and follower links. |
| 166 | Slotted rod and crank disk faithful. The rod's guided slide stands in for the caption's mold and is not drawn. |
| 167 | Faithful diagonal-groove drum and rod. |
| 168 | Faithful linked variable crank. |
| 169 | Faithful linked variable crank, reversed arrangement. |
| 170 | Faithful crossed governor and bevels. |
| 171 | Faithful marine governor and trunnion. |
| 172 | Faithful oval cam lever. |
| 173 | Faithful tappet silk traverse. |
| 174 | Faithful bench clamp. |
| 175 | Faithful slotted frame and link; the dotted wheel is omitted. |
| 176 | Faithful rod end and gib. |
| 177 | Faithful rod end and gib, second form. |
| 178 | Slotted crank and eccentric circular slot faithful. The tool slide at the left follows the caption; Brown draws only the rod. |
| 179 | Faithful lever, trip and coupling. |
| 180 | Faithful single clamp. |
| 181 | Faithful diagonal catches and weights. |

## Pass 50 batch: 182–201

| Movement | Observation |
| --- | --- |
| 182 | Faithful diagonal catch pair, links and weights. |
| 183 | Faithful sector catches, links and weight. |
| 184 | Faithful sector catches, second form. |
| 185 | Linkage and graduated arc faithful; a wide side elevation. |
| 186 | Presented without the undrawn rockshaft frame, in near side elevation. The spring loop handle hangs lower than Brown's a. |
| 187 | Presented without the undrawn frame, in near side elevation; faithful. |
| 188 | Presented without the undrawn frame and guide, in near side elevation. The loop handle rises at a different angle from Brown's. |
| 189 | Presented without the undrawn frame, in near side elevation; faithful. |
| 190 | Faithful clamp lever on its wooden bed. |
| 191 | Presented without the undrawn standard and foot; faithful notched wheels. |
| 192 | Presented without the undrawn standard and foot; faithful mangle wheel. |
| 193 | Presented without the undrawn standard and foot; faithful concentric mangle wheel. |
| 194 | Presented without the undrawn standard and foot; faithful pin mangle wheel. |
| 195 | Faithful face wheel, pinion and rolling rod. |
| 196 | Faithful gears, arm and pedestal. |
| 197 | Faithful slotted pin rack and pinion. |
| 198 | Faithful endless rack frame, pinion and guide wheels. |
| 199 | Faithful toothed yoke, mutilated wheel and guide wheels. |
| 200 | Faithful bevel reversing pair. |
| 201 | Presented without the undrawn base, post and bearing bridges; faithful eccentric gears, belt and rod A. |
