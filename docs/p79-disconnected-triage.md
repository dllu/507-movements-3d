# Pass 79: triage of the improved disconnected-parts screen

Reviewer: Claude Opus 5.5 (read-only triage lane p79-triage), 2026-09-27.

The improved screen (per-phase deforming meshes, instanced teeth merged, better fluid classification) was re-run over all 507 movements at 46857d6 and flagged 133 movements. Each gap was captured zoomed (default and rotated, extra views where doubtful) and judged.

## Confirmed visible disconnections (31)

| ID | Kind | Problem | File |
|---|---|---|---|
| 162 | minor | Input gear body is not fixed to its shaft (rigid 0.055 bore gap), and both grey shaft bearing rings are bored 0.155 on 0.106 shafts, hanging loose and carried by nothing | src/simulation/baked/water-governor.js (model-loader route; not authored-water-governors.js) |
| 173 | detached | Screw frame (channel rails with upper/lower bearings) that Brown secures on the back of the disk stands 0.09 clear of the disk; a thin gap shows in side views | src/simulation/baked/tappet-silk-traverse.js (model-loader route) |
| 181 | minor | Hanging back-weight rod eyes are much larger than their hinge pins and hang visibly off-centre (0.045); the upper handle's weight rod eye stands 0.36 from any pin (screen also reports the lower rod 1.5 away persistently; check across phases) | src/simulation/baked/diagonal-catch.js (model-loader route, 181/182) |
| 182 | minor | Same as 181: hanging back-weight rod eyes loose/off-centre on hinge pins (0.045), upper handle rod eye 0.36 from its pin | src/simulation/baked/diagonal-catch.js (model-loader route, 181/182) |
| 183 | detached | Upper handle catch boss (z 0.06..0.12) floats 0.12 in front of the quadrant (z -0.14..-0.06), touching nothing | src/simulation/authored-quadrant-catches.js / quadrant-catch-finite-parts.js |
| 184 | detached | Same catch boss floats 0.12 off the upper handle quadrant | src/simulation/authored-quadrant-catches.js / quadrant-catch-finite-parts.js |
| 212 | minor | Fixed torus bearings for shafts A and B are loose on their shafts (0.043/0.046 radial) and carried by nothing, visible in back/rotated views (same class as 145/273/454 rings) | src/simulation/authored-intermittent-core.js |
| 213 | minor | Split-ring friction interface on the fixed stud drum stands 0.029 inside the split rim it should grip; a thin white ring shows in the default view | src/simulation/authored-intermittent-core.js |
| 215 | minor | Fixed crescent-driver and six-slot-wheel torus bearings are loose on their shafts (0.062 radial), carried by nothing | src/simulation/authored-intermittent-core.js |
| 232 | minor | Handle B's bore on the output shaft shows a white crescent (0.025 radial play) | src/simulation/authored-intermittent-core.js |
| 267 | minor | Loose pulley hub bore 0.343 on 0.29 output shaft: 0.05 radial crescent (as 64/66/67 sleeves) | src/simulation/authored-friction-clutches.js |
| 276 | minor | Rear cam-shaft torus bearing hangs loose round the shaft (0.025) and follower roller treads show a crescent on their axles (0.015) | src/simulation/authored-equal-diameter-cams.js |
| 280 | minor | Upper coupler pin sits off-centre in the coupler eye with a visible white crescent (0.024) | src/simulation/authored-friction-windlasses.js |
| 283 | detached | Manual handle, grip and its boss stand 0.26 in front of the pinion face (boss z 0.76 vs pinion z 0.50); the handle visibly does not join the pinion in side views | src/simulation/authored-rack-pumps.js |
| 285 | minor | Lathe centre shank (r 0.18) ends in the open quill mouth (sleeve r 0.33) touching nothing: centre is not seated in the quill | src/simulation/authored-lathe-heads.js |
| 295 | detached | Escape-wheel arbor is a short stub floating ~1.1 in front of the wheel web (arbor z -0.3..0.2, web z -1.52..-1.44); plainly detached in side view | src/simulation/authored-plate-escapements.js |
| 309 | minor | Fixed pendulum suspension stud end floats between the two pallet-arbor eyes, touching neither (0.029), carried by nothing | src/simulation/authored-gravity-escapements.js (+ baked/gravity-escapement-plates.js) |
| 331 | detached | Crossbeam and pediment float 0.14 above the tops of pillar guides D (beam y 1.68, pillar tops 1.536); visible gap | src/simulation/authored-slotted-crosshead-engines.js |
| 339 | minor | Connecting-rod eye on the crosshead pin and radius-bar eye on boss F are loose (0.03-0.035), dark ring visible (as 336/337 before p78) | src/simulation/authored-direct-action-parallel-motions.js |
| 340 | minor | Radius bar E-A eye on common pin A is loose (0.052), dark crescent visible | src/simulation/authored-direct-action-parallel-motions.js |
| 368 | detached | Rack drops fully out of its upper slide guide (rack top 3.81 vs guide 3.875) at part of the cycle, leaving the guide hovering above the rack with nothing joining it | src/simulation/authored-cylinder-spiral-scribers.js |
| 373 | minor | Driving-shaft stub sits off-centre in the pulley hub bore (0.056), visible gap in the hub (known p76 residual) | src/simulation/authored-rolling-friction-experiments.js |
| 397 | detached | Output slide bar is not joined to the link: it floats 0.30 from the link's pin with no lug (side view shows pin and bar apart); link eye also shows a crescent on its pin (0.014) | src/simulation/authored-intermittent-shuttle-drives.js |
| 398 | detached | Crosshead bars stop 0.076 short of the cam follower roller; the roller is not carried by the crosshead | src/simulation/authored-cam-rocking-drives.js |
| 433 | minor | Bucket support ring and scoop floors do not reach the hub fast on the shaft (rigid 0.04-0.06 gap): the wheel is not fastened to its hub | src/simulation/authored-horizontal-overshot-water-wheels.js |
| 442 | detached | All 12 pot-wheel spokes stop 0.0725 short of the pots, and both pot-supporting rims touch neither spokes nor pots' carriers (rear rim 0.18 from spoke 1): the pot ring floats round the spokes | src/simulation/authored-eisach-pot-wheels.js |
| 449 | minor | High-level delivery riser / flap chamber stops 0.031 short of the pump barrel wall; small visible notch where they should join | src/simulation/authored-lift-pumps.js |
| 450 | minor | Delivery pipe elbow stops 0.04 short of the pump cylinder, so the outlet check chamber and delivery pipe hang free; suction pipe 0.025 short of its check seat | src/simulation/authored-force-pumps.js |
| 451 | minor | Pump-to-air-chamber delivery pipe stands 0.06 off the pump cylinder port (visible step), so the whole air-chamber assembly is joined only through water; suction pipe 0.035 short of its seat; dip tube 0.025 off the chamber | src/simulation/authored-force-pumps.js |
| 459 | detached | Central fixed frame post ends in mid-air inside the well (bottom y -0.63) instead of reaching the ground as Brown draws; wind shaft, wheels and worm are carried by nothing (2.2 from well/troughs) | src/simulation/authored-reciprocating-well-lifts.js |
| 477 | minor | Annular seat a-a at inlet A stands 0.08 clear of the sectioned casing; joined only through condensate | src/simulation/authored-diaphragm-steam-traps.js |

Fixed by lanes p80-1, p80-2 and p80-3.

## Dismissed (102)

- 5: tightening pulley released from the belt by design (intermittent)
- 37: roller/cone running contact 0.013
- 47: 0.007 pin clearance, reads joined
- 48: rod eye concentric on collar pin, 0.03 hidden
- 63: drop pins intermittent by design
- 72: wiper shaft has no drawn bearing (no-undrawn-supports); cam tooth clears bed by design
- 74: bevel mesh running clearance 0.01
- 81: rack/gear running clearance
- 84: end rod guides stand on their own feet (legs are undrawn but not detached); cam/rack clearance intermittent
- 88: stop/cam contact intermittent
- 127: rods run in barrels; barrels undrawn-support columns, clearance 0.02
- 129: bearing clearance 0.019 hidden
- 131: rack guide clearance 0.02
- 132: ground block and bed are separate scenery; overhead collar clearance 0.02
- 171: fixed trunnion shown without drawn support
- 177: uncoupled crank is detached by design (wrist passes through slot)
- 179: eccentric rod lifted off spindle = intended release
- 196: 0.011 bearing clearance
- 208: 0.015 collar clearance
- 210: guide running clearance 0.025, undrawn guide supports
- 211: tooth running clearance
- 214: gear mesh clearance
- 216: internal gear running clearance
- 217: stud roller running in groove 0.03
- 218: 0.015 clearance
- 220: wrist roller in slot 0.019
- 233: stops withdrawn by design
- 235: tappet/click intermittent
- 238: star/anchor intermittent
- 240: stops lifted by design
- 241: single-tooth driver intermittent
- 244: stop standard stands on its own foot; pan rests clear of stop at balance
- 245: bayonet plug withdrawn by design
- 246: tracing point part-geometry artefact, reads joined
- 247: sounding weight released and falls away by design
- 251: pile and frame are separate objects on unseen ground
- 271: pawl lifts off rack on return stroke
- 273: known guide running clearance (p76 residual)
- 278: pawl guide clearance 0.044-0.06, not resolvable in views
- 281: hairline 0.012 clearances
- 282: rack guide running clearance
- 286: lifter rides off toe; valve seat below crop
- 291: judged in p77
- 296: detached lever/roller intermittent
- 297: lantern pallets intermittent
- 301: intermittent
- 303: deadbeat running clearance
- 304: pin/pallet intermittent
- 306: intermittent
- 308: detached escapement by design; Q stud drawn without frame
- 310: judged in p77
- 314: banking pins drawn without frame (no-undrawn-supports)
- 324: pin 0.021 radial clearance under washers; figures read joined
- 325: same as 324
- 335: piston rod into cylinder below crop, cylinder has no drawn support
- 338: same as 335
- 342: bolts in slot 0.018; cylinder undrawn support
- 350: slot pin clearances 0.016; front index cap reads seated
- 351: mutilated pinion intermittent
- 353: anvil/cam post separate on ground; helve fulcrum drawn without support
- 357: toothed circle running clearance
- 366: 0.015 clearance
- 370: guide pin clearance 0.03
- 375: 0.015 clearance
- 376: hoof on tread intermittent (walking)
- 377: figure; known ledger entry
- 378: log separate from raised saw by design
- 382: 0.016 clearance
- 389: rack/frame running clearance
- 391: elbow lever acts only at the upper corner by design; pivot drawn without support
- 392: work table undrawn support
- 396: banking/fork/roller intermittent chronometer contacts
- 405: opposite hyperbola branch (traced curve)
- 420: bell drawn without hanger (no-undrawn-supports)
- 430: flume/race undrawn supports
- 431: wheel/sluice separate fixed structures
- 435: plan-view foundation
- 436: flume undrawn support
- 437: volute plate running clearance
- 438: flume undrawn support
- 439: flume undrawn support; bucket valve intermittent
- 440: flume undrawn support
- 441: stream bed separate scenery
- 444: trough undrawn support; check/waste valves intermittent
- 454: water column misclassified as solid; delivery branch 0.023 known residual
- 462: receiving flume undrawn support
- 463: leaf/bed clearance
- 465: check disks intermittent; foundation blocks adjacent
- 467: 0.015 check clearance
- 469: single spoke hidden inside wheel; rim/hood running clearance
- 475: cutaway steam pipe inside chamber, hidden
- 479: gasholder floats in tank by design
- 480: sleeve on tube reads joined
- 481: judged p74 (intended compartment gaps)
- 482: 0.014 clearance
- 486: arm roots read seated in hub in rotated views
- 491: handspike socket clearance 0.02
- 492: judged p77 (intended release)
- 494: stone lifted off bed by design; jaw contact 0.026
- 498: scale marks (tags)
- 499: dial marks
- 500: judged p77 residuals
