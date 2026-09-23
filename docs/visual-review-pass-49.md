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

## Pass 50 batch: 202–223 (excluding 206, 211)

| Movement | Observation |
| --- | --- |
| 202 | Faithful worm and wheel. |
| 203 | Faithful spiral slot cam and lever. |
| 204 | Presented without the undrawn base and posts; faithful hyperboloidal rollers. |
| 205 | Faithful pin wheel and heart cam. |
| 207 | Faithful paired worm wheels on one shaft. |
| 208 | Faithful pin disk and pinion. |
| 209 | Faithful mutilated gears and catch. |
| 210 | Faithful S-cam on the guided rod. |
| 212 | Presented without the undrawn frame and shaft supports; faithful driver A and stop wheel B. |
| 213 | Presented without the undrawn frame; faithful split stop ring and ratchet wheel. |
| 214 | Presented without the undrawn frame and supports. The finger-stop wheels have rounded lobes where Brown draws square teeth. |
| 215 | Presented without the undrawn frame and supports; faithful crescent driver and six-slot wheel. |
| 216 | Presented face-on without the undrawn frame; faithful internal ring and pinions. |
| 217 | Presented face-on without the undrawn frame. The groove does not follow Brown's heart cam C, D, B, e, and 218's notch wheel F is included. |
| 218 | Faithful notch wheel F, catch G and rocker. |
| 219 | Faithful crown wheel and pinion. |
| 220 | Faithful slotted link and crank. |
| 221 | Faithful elliptical driver, pinion B, arm and the elliptical guide g, h from the caption. |
| 222 | Faithful gear train and link; the dashed circle is omitted. |
| 223 | Faithful paired toothed sectors. |

## Pass 50 batch: 224–243

| Movement | Observation |
| --- | --- |
| 224 | Faithful sun-and-planet hoist wheel and arms. |
| 225 | Faithful ratchet wheel, lever and pawl rod. |
| 226 | Faithful reversing bevels, clutch and frame A. |
| 227 | Faithful chain sprocket and chain. |
| 228 | Faithful chain wheel and chain. |
| 229 | Faithful toothed wheel and pitch chain. |
| 230 | Faithful pulleys and link bands. |
| 231 | Faithful triangular linkage and rods. |
| 232 | Faithful stop wheel, catch A and levers B, C. |
| 233 | Wheel, pins, crank and latch faithful. The undrawn frame beams are now removed by source presentation. |
| 234 | Faithful crown wheel and verge; the row keeps its pass-49 review, which followed the user's corrections. |
| 235 | Faithful star wheel and pawl lever. |
| 236 | Faithful ratchet wheel and paired pawls. |
| 237 | Faithful crown ratchet and pawl. |
| 238 | Faithful star wheel and cam plate. |
| 239 | Presented without the undrawn rail and posts. The spur wheel has rounded lobes where Brown draws square teeth. |
| 240 | Faithful ratchet wheel, pawls and catch. |
| 241 | Faithful ratchet wheel, pawl and eccentric. |
| 242 | Presented without the undrawn base and posts; faithful brake wheel, strap and lever. |
| 243 | Faithful belt pulleys and idlers. |

## Pass 50 batch: 244–263

| Movement | Observation |
| --- | --- |
| 244 | Faithful steelyard beam, drum and scale pan. |
| 245 | Faithful bayonet socket A and pin B. |
| 246 | Presented without the undrawn drawing board. The arms stop at A and C, where Brown's run on past them. |
| 247 | Faithful sounding rod, catch and weight. The seabed plate is not drawn but is kept: the caption's probe strikes it and the released weight rests on it. |
| 248 | Faithful sectioned socket joint A, B, C. |
| 249 | Faithful ball-and-socket joint. |
| 250 | Faithful wheels on the A-frame. |
| 251 | Faithful pile-driver frame, nippers and weight W. |
| 252 | Faithful twin rollers, triangular frame and D. |
| 253 | Faithful disk A, levers and band B. |
| 254–259 | Faithful pulley and roller faces (plain, V, round and ribbed). |
| 260 | Faithful gears, shafts and frame. |
| 261 | Faithful pulleys, links and weight W. |
| 262 | Drum B faithful; the frame is simplified. |
| 263 | Faithful cone, bearings and screw. |

## Pass 50 batch: 264–283

| Movement | Observation |
| --- | --- |
| 264 | Faithful wheels, pinion and rods. |
| 265 | Faithful cone, disk and inclined shaft. |
| 266 | Faithful screw, nut and handle; the bed is a closed frame where Brown draws a bench line. |
| 267 | Faithful spider arms and rim; the direction arrow is larger than Brown's. |
| 268 | Faithful lever, roller and crank disk. |
| 269 | Faithful double rack frame and pinion. |
| 270 | One wheel and band faithful; Brown draws two views. |
| 271 | Faithful rack, pawls and lever. |
| 272 | Presented without the undrawn base, post and backing rail. The cam is a bevelled cylinder where Brown draws a wavy-profiled plate. |
| 273 | Faithful rhombic linkage and guides. |
| 274 | Faithful governor arms and balls K. |
| 275 | Faithful rack and helical cam. |
| 276 | Presented without the undrawn base, posts and bearing arm; faithful cam and rollers. |
| 277 | Faithful drum, pawl and trip lever. |
| 278 | Faithful safety catch frame, springs and pawls d. |
| 279 | Presented without the undrawn base and posts; faithful journal box in its frame. |
| 280 | Faithful ratchet wheel, pawls and lever. |
| 281 | Faithful cam disk and swinging frame. |
| 282 | Faithful frame, lever, sector and weight. |
| 283 | Faithful rack, pinion and pump barrels. |

## Pass 50 batch: 284–315 escapements and governors

The engine now shrinks an authored camera-fit box to the measured motion bounds
when source presentation removes parts, and source presentation carries its
rotation into that box. Every entry with an authored box (142–314 in the table
of `src/data/source-presentation.js`) was recaptured; each now frames what
remains instead of the removed frames.

| Movement | Observation |
| --- | --- |
| 284 | Faithful ratchet, pawls and frame. |
| 285 | Faithful screw and frame; the frame is drawn in the plate. |
| 287 | Faithful governor and brake. |
| 288 | Presented without the undrawn clock plate standard and base; faithful wheel and anchor H, L, K. |
| 289 | Presented without the undrawn plate standard and base; faithful dead-beat wheel and anchor. |
| 290 | Presented without the undrawn standard and base; faithful annular frame and wheel D. |
| 291 | Presented without the undrawn watch plate, standards and base; faithful wheel B, balance and detent. |
| 292 | Presented without the undrawn plate standard and base. Only one gravity arm is modelled where Brown draws arms G and H from F. |
| 293 | Presented without the undrawn plate, bridge and base; faithful duplex wheel and roller. |
| 294 | Reduced to the cylinder Brown draws; the wheel, balance and watch frame belong to 295. Viewed side-on with the half-shell passage cut to raster x 352 and a stepped balance collet. The left end of the cut is square where Brown rounds it. |
| 295 | A full wheel replaces Brown's partial arc; acceptable. |
| 296 | Presented without the undrawn plate, bridge and base; faithful wheel A and lever B, C. |
| 297 | Presented without the undrawn base. The wheel has spokes where Brown draws a plain disc with pin holes. |
| 305 | Presented without the undrawn clock upright and brackets; faithful pallet plate and single-pin disc. |
| 306 | Presented without the undrawn frame bridge and strut; the dashed end straps remain as drawn. |
| 307 | Presented without the undrawn upright and brackets; faithful pallet plate and wheel. |
| 308 | Presented without the undrawn upright and brackets. The face-on pin wheel, long pendulum rod and bob do not reproduce Brown's view of the curved pendulum pieces P, P and the small hooked wheel under a cock; needs reconstruction. |
| 313 | Presented without the undrawn watch frame and standards; faithful wheel, balance V and spring detent D. |
| 314 | Presented without the undrawn frame members and base; faithful wheel, lever A, B and balance roller C with banking pins. |
| 315 | Faithful conical pendulum and seat. |

## Pass 50 batch: 316–325 and 346–357

| Movement | Observation |
| --- | --- |
| 316 | Presented without the undrawn upper suspension plate; faithful jar, bracket and adjusting screw. |
| 317 | Presented without the undrawn upper suspension plate; faithful compound bar C, weights W and bob M. |
| 318 | Faithful balance, spring and regulator arc. |
| 319 | Faithful balance bar and compensation arcs b, b′. |
| 320 | Presented without the undrawn clock frame; faithful pulleys, weights and endless chain. |
| 321 | Faithful wheels, ratchet, spring T and weight. |
| 322 | Faithful plate and holes A, B. |
| 323 | Faithful shaft and bearings A, A. |
| 324 | Faithful lazy-tongs bars and slotted guides A. |
| 325 | Faithful parallel links c between bars A and B. |
| 346 | Faithful cylinder, guides and crank; the bed is a legged table where Brown draws a solid plinth. |
| 348 | Presented without the undrawn stand, base and external guide; faithful disk A, slides c and bar B. |
| 349 | Faithful toggle links and wedge. |
| 350 | Presented without the undrawn base; faithful slotted link, guides a, a and output bar. |
| 351 | Presented without the undrawn base, anvil and workpiece; faithful rack stamp and mutilated pinion. |
| 352 | Faithful shear-legs, pulleys, windlass and weight. |
| 353 | Faithful tilt hammer, cam wheel and anvil. |
| 354 | Presented without the undrawn support rails and brackets; faithful crosshead, input disk and stem guides. |
| 355 | Faithful gyroscope, ring and stand. |
| 356 | Faithful rings A, A′ and globe B on its stand. |
| 357 | Faithful front elevation of the Anderson governor. |

## Pass 50 batch: 358–379

| Movement | Observation |
| --- | --- |
| 358 | Faithful cone, rope, crank and frame. |
| 359 | Faithful pump-drill spindle, crossbar and flywheel. |
| 360 | Faithful sectors, chains, weight and wheel. |
| 361 | Faithful frame, pulleys and cranks. |
| 362 | Faithful drums, shafts and frame. |
| 363 | Faithful beam, stand and seats. |
| 364 | Presented without the undrawn stand and bed, in Brown's side elevation: pin wheel face-on beside the grooved drum. |
| 365 | Faithful crossed rollers and upright shaft. |
| 366 | Faithful frame, bevel wheels, drill and levers. |
| 367 | Faithful bars, links and spring. |
| 368 | Faithful bevel wheels, rack and sectioned cylinder. |
| 369 | Faithful bracket, cycloidal cheeks and pendulum. |
| 370 | Faithful rails, pendulum arm and crank. |
| 371 | Presented without the undrawn base and bearing post; faithful mangle wheel and shifting pinion. |
| 372 | Front elevation, as Brown draws it. A hanging plumb stands where Brown draws a turned spindle below the wheels. |
| 373 | Faithful wheel, band, car and dial. |
| 374 | Presented without the undrawn base and standards; faithful eccentric pulley, band and treadle. |
| 375 | Front elevation, as Brown draws it; faithful runners, pan and bevel drive. |
| 376 | Faithful treadwheel, cross-bracing and horse. |
| 377 | Faithful treadwheel and steps. |
| 378 | Front elevation, as Brown draws it; faithful saw frame, guides, log and pole. |
| 379 | Faithful clamp frame, screw and drill. |

## Pass 50 batch: 380–401

Movement 130's plate-shears bake was re-recorded and rebaked because its provenance
hashes `primitives.js`; loop points, seam and native comparison are unchanged.

| Movement | Observation |
| --- | --- |
| 380 | Faithful clamp frame, screw and drill. |
| 381 | Plan view, as Brown's lower figure; faithful bed, cheeks and wedges. The transverse section is not reproduced. |
| 382 | Faithful mirror frame and stand. |
| 383 | Faithful frame and three rollers. |
| 384 | Side view without the undrawn paper; faithful point, screw arm and wheel. |
| 385 | Presented without the undrawn door, frame and brackets; faithful pins, toggle links and weight. |
| 386 | One ladder where Brown draws three views. |
| 387 | Faithful bridge, links and pier. |
| 388 | Presented without the undrawn bearing frame; faithful rollers and board. |
| 389 | Faithful rack, pawl and base. |
| 390 | Presented without the undrawn bearing frame; faithful piece A, flywheel B and bands C, D. |
| 391 | Presented without the undrawn frame; faithful guides b, racks A, A1, wheel and lever C. |
| 392 | Presented without the undrawn bed; faithful saw, guides, table, crank wheel and spring. |
| 393 | Faithful bracket, bell and hammer. |
| 394 | Presented without the undrawn bed and standards; faithful rack, pinion and rod guide. |
| 395 | One cock with its four pipes where Brown draws two sectional positions of the plug. |
| 396 | Presented without the undrawn base; faithful wheel A, balance B, lever C and banking pins. |
| 397 | Faithful bar, curved lever and fulcrum. |
| 398 | Presented without the undrawn base and supports; faithful cam C, crosshead guide and output wheel. |
| 399 | Faithful links and pins. |
| 400 | Side elevation without the undrawn base and supports. Cam C is much larger than Brown's. |
| 401 | Presented without the undrawn floor and standards; faithful faceplate, slide A, B, pitman and treadle. |

## Pass 50 batch: 403–424

| Movement | Observation |
| --- | --- |
| 403 | Faithful crossed rafters, tie and arc. |
| 404 | Faithful bow, screw and beam. |
| 405 | Faithful hyperbolas, ruler and thread. |
| 406 | Presented without the undrawn drawing board; faithful straightedge, square, thread and pencil. |
| 407 | Presented without the undrawn drawing board and mirrored half-arch; faithful slotted bar, elastic bar and cord. |
| 408 | Faithful centrolinead arms and blade. |
| 409 | Faithful proportional compasses. |
| 410 | Faithful plank, clamp and screws. |
| 411 | Faithful carriage, rollers and handle. |
| 412 | Faithful planet train and annulus. The outside band and its two levers are not modelled. |
| 413 | Presented without the undrawn frame; faithful wheels A and B on their shafts. |
| 414 | Faithful spiral face wheel and pinion B. |
| 415 | Presented without the undrawn frame; faithful wheel D, lever A, pawls and rod. |
| 416 | Presented without the undrawn frame; faithful flywheel, crank B, spring A, pitman and treadle. |
| 417 | Faithful frame, arm A, rod B and base. |
| 418 | Presented without the undrawn outside standards. The casing is an open trapezoid frame where Brown sections a conical casing. |
| 419 | Faithful frame, wheels A, B, cords and rocker E. |
| 420 | Faithful bell, hammer and trip on the board. |
| 421 | Presented without the undrawn foundation and crank supports; faithful sectioned cylinder, trunk and pitman. |
| 422 | Faithful scale frame, pointer B and pivot C. |
| 423 | Faithful frame, arms B and cam D. |
| 424 | Faithful frames A, B and crank plate C. |

## Pass 50 batch: 425–446

| Movement | Observation |
| --- | --- |
| 425 | Front elevation, as Brown draws it; faithful casing, piston C and abutment. |
| 426 | Front elevation; faithful casing, drum B and abutments A. |
| 427 | Front elevation; faithful casing, drum B and pistons a. |
| 428 | Front elevation; faithful casing, arms B and rollers A. |
| 429 | Front elevation; faithful two-lobed casing and toothed pistons. |
| 430 | Side elevation; faithful overshot wheel and flume. |
| 431 | Side elevation; faithful undershot wheel, sluice and race. |
| 432 | Side elevation; faithful breast wheel, sluice and race. |
| 433 | Side elevation; faithful tub wheel, shaft and spout. |
| 434 | Plan, as Brown draws it; faithful wheel A inside guide ring B. |
| 435 | Plan; faithful guides b and outer wheel a. |
| 436 | Sectional elevation; faithful case b, wheel a and step c. |
| 437 | Plan without the undrawn foundation and upper bearing bridge; faithful scroll case, guides a and floats c. The inlet enters diagonally at the left where Brown's runs in horizontally at the top. |
| 438 | Elevation; faithful arms, hollow shaft and funnel. The floor plate is not drawn by Brown. |
| 439 | Presented without the undrawn gallows frame and ground; faithful pulley, rope, bucket and counterweight. |
| 440 | Faithful trough, trestle and spout. |
| 441 | Front elevation without the undrawn base, standards, trip-pin post and trough; faithful curved arms, buckets and stream. |
| 442 | Faithful wheel, trestle and race. |
| 443 | Faithful inclined screw, floats and trough. |
| 444 | Sectional elevation; faithful supply, air vessel, jet and valve. |
| 445 | Faithful sectional supply, chamber and valve. |
| 446 | Faithful sectional supply, chamber and valve. |

## Pass 50 batch: 447–468

| Movement | Observation |
| --- | --- |
| 447 | Faithful boat, rope and anchor in the stream. |
| 448 | Faithful sectioned lift pump, bucket and handle. |
| 449 | Faithful sectioned force pump and air vessel. |
| 450 | Faithful sectioned pump and handle. |
| 451 | Faithful sectioned pump, air vessel and handle. |
| 452 | Sectional elevation without the undrawn foundation; faithful cylinder and passages. |
| 453 | Elevation without the undrawn foundation; faithful bellows, valve chest and beam. |
| 454 | Sectional elevation without the undrawn foundation; faithful diaphragm chamber, valves and lever. |
| 455 | Sectional elevation without the undrawn foundation; faithful casing, folding valves and apertures. |
| 456 | Sectional elevation without the undrawn foundation; faithful cylinder, heart cam a, sliders and pipes. |
| 457 | Faithful sweep, bucket and well. |
| 458 | Faithful well house, pulley and buckets. |
| 459 | Faithful frame, wheels, buckets and trough. |
| 460 | Faithful scoop, lever and banks. |
| 461 | Faithful zigzag troughs and water. |
| 462 | Presented without the undrawn frame; faithful chain wheels, disks, pipe and spout. |
| 463 | Faithful gates and water. |
| 464 | Faithful frame, bowl and jet. |
| 465 | Faithful frame, lever and pumps. |
| 466 | Faithful press, pump and lever. |
| 467 | Sectional elevation without the undrawn ground plate; faithful jack, ram, pump and lever. |
| 468 | Faithful pipes and joints; Brown draws a section and a plan. |

## Pass 50 batch: 469–490

| Movement | Observation |
| --- | --- |
| 469 | Sectional elevation, as Brown draws it; faithful tanks, wheel and pipe. |
| 470 | Faithful steam hammer, frame and valve gear. |
| 471 | Faithful hammer frame and cylinder. |
| 472 | Faithful frame, cylinders and gear. |
| 473 | Faithful press frame, tub and levers. |
| 474 | Presented without the undrawn hearth, fire and foundation; faithful boiler, risers and globe. The legs are straight where Brown curves them. |
| 475 | Presented without the undrawn bilge well; faithful chamber D, pipes B, C and jet A. |
| 476 | Presented without the undrawn basin; faithful fork B, pipe C and jet A. |
| 477 | Faithful sectioned casing and valves. |
| 478 | Faithful pipe A, sphere C and lever D on the base. |
| 479 | Faithful gasholder A, pulleys and weights C in tank B. |
| 480 | Faithful gasholder, pipes and tank. |
| 481 | Faithful drum, float chambers and dial. |
| 482 | Faithful sectioned meter case and float. |
| 483 | Faithful bellows A, valves and dials. |
| 484 | Faithful helical wheel on its stands. |
| 485 | Faithful windmill, sails and tail. |
| 486 | Faithful horizontal windmill arms and vanes. |
| 487 | Presented without the undrawn trestles, base and water; faithful wheel and paddles. |
| 488 | Presented without the undrawn pedestals, base and water; faithful screw propeller. |
| 489 | Front elevation without the undrawn stand, base and water; faithful eccentric e, ring d, cranks c and buckets a. |
| 490 | Faithful band, pulleys and lever. |
