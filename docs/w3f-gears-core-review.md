# Pass-51 wave-3 lane w3f-gears-core review

Scope: 3, 12, 31, 191, 192, 196, 201, 202, 205, 208, 216, 219, 220, 227
and 228. I checked every change in `scripts/review-movement-source-views.mjs`
captures beside the engraving. Intersections come from
`scripts/show-body-intersections.mjs ID --spacing=0.01 --samples=129`.

## Per movement

- 3: Brown's drum is about as tall as it is wide, and about 0.92 of the
  wheel's diameter. It went from radius 0.74 and width 1.55 to radius 0.81
  and width 1.62. The drum slides 0.09 of its width along its own axis, so
  the rope winds on right of centre, as drawn. The belt path does not change.
  The screen still reports a belt/pulley-rim torus pair at 0.13 "coaxial".
  It was there before (0.129), and the ledger's sampled-clear claim is stale
  for this screen.
- 12: `hideGround`. Brown draws no ground. The rope end tied into the bag
  neck (0.004) is the intended joint.
- 31: the worm is now thin ribs (`thin-rib-worm-geometry.js`). The loaded
  flank stays on the Type-I straight flank that cut the baked wheel. The idle
  flank is pulled in, nearly radial, to a 0.34-module land. The loaded-flank
  torque/power test still passes. The screw-section and engagement tests now
  check the loaded flank against the hob and the idle flank against the
  thin-rib section. Intersections: clear → clear.
- 191: the fixed bearing rings sit just behind the bosses rather than inside
  them. Hub/bearing 0.0246 → clear.
- 192: the pinion journal ends at the moving yoke. The telescopic shaft runs
  between the surfaces of the two joints, and its own end balls are hidden.
  The fixed universal joint is a single joint centre, and the rear input
  shaft starts at its surface. Shaft/yoke 0.083 and the box/sphere/shaft pairs
  → clear. The input pinion and its drive, which the plate omits, remain
  because they are the working drive.
- 196: I fitted a stronger two-lobed pitch curve with third harmonics (width
  to height 1.32 → 1.63), with ≥0.6 concave radius and the A–B spacing kept.
  It changed the carrier law, though: the reversal order moved and the swing
  fell to 0.375, and the major/minor stroke ratio broke the tests that encode
  the vibration. So I reverted it. Residual.
- 201: Brown draws a short oval eye at the end of a solid tapered arm. The
  slot is now a short eye (half-ring caps, closed solids) where the roller
  travels 2.40–2.48, and two mirrored halves form one tapered arm into the
  pivot collar. The large pulley is bored (0.115) on the stationary pivot
  shaft. The belt rides one belt radius outside each tread. The carrier plate
  sits behind the pinion. The driver hub ring stands proud of the gear face.
  Rod A, its guide ring and bracket stand in front of the eye. Pivot
  shaft/pulley 0.2246, slot/roller 0.1247 and the other listed pairs → clear.
- 202: no change. A true hourglass worm of this length flares by
  R(1 − cos 0.6) at each end. Brown's short worm flares less and has a fatter
  core, and no single globoid matches both. The special-worm cut and
  generator are shared with 264, so the flare stays a residual.
- 205: the teeth are thinner, as Brown's bars are. The driven (upper) flank
  keeps its exact involute. The idle flank is the same involute rotated 0.07
  rad towards it, and the front face bars follow the thinner tooth. The mesh
  probe shows the cam still 0.001 from the driven flank at every sampled
  pose (planar report maximum closest gap 0.0011). Intersections are
  unchanged: only zero-depth touches.
- 208: the pins no longer cast streak shadows. I hid the shaft detents,
  which Brown does not draw; this also clears the 0.028 and 0.010
  detent/collar/web pairs. Pin/web 0.0535 is unchanged: off the centre line,
  the thin pinion's rim dips into the pin field of the neighbouring ring
  (middle-ring pins while the inner ring is selected). Clearing it needs pin
  tips at about z 0.43, which the selected ring's engagement cannot spare.
  The pinion is still a thin slotted web, not a lantern strip, because a
  wider lantern would collide with the pins as it slides between rings.
- 216: the shafts fill the 0.3 bores and stop at the boss faces, so they read
  as Brown's hatched sections. The camera is face-on (0.02, 0.015, 1), and
  `hideGround` is set. The undrawn compound bearing is removed like the
  pinion's. It is still 22 internal teeth over 165°: 24 over 180° leaves no
  hand-off gap for the mutilated sectors.
- 219: the long pinion is now a lantern. Eight slender staves (radius 0.058)
  are inscribed in the teeth of the spur cutter that shaped the crown teeth.
  They carry the same pitch timing and clear the crown wherever the spur did.
  Each end is a light eight-arm star with a bored boss, standing 0.022 clear
  of the crown-tooth corners. Clear → clear.
- 220: the fit keeps the raised arm, the upper sweep and the shafts rather
  than the arm's whole revolution. The subject is about 1.5× larger, and
  maxNdc 0.64 → 0.91, so nothing leaves the frame.
- 227: the sprocket follows Brown: a round body with six concave-flanked
  teeth standing out through the edge-on links. The flat links rest on the
  arcs between the teeth. The tooth phase moves one node step, so teeth
  centre on perpendicular links (the engagements are now the odd links). The
  offline sweep carves each flank to the neighbouring flat links' end loops,
  which the tooth drives (maximum driving gap 0.0012).
  `generate-chain-drive-profiles.mjs` now centres 227's wedge on a tooth, so
  the six copies union into one solid. The 228 and 229 profiles are
  byte-identical.
- 228: the disc is thinner (depth 0.34 → 0.18) and larger (1.82 → 1.9), and
  the wedges are shallower (0.7 → 0.5). Each wedge's idle flank is trimmed to
  a taper, while the driving flank keeps its generated rung clearance
  (maximum driving gap 0.0008).

## Reports regenerated

`docs/validation/191-196-201-contact.json`, `200-226-bevel-solids.json`,
`205-208-209-contact.json` and `219-224-414-contact.json` were rerun with
their generators, and they all pass. `141-review.json` is a historical report
pinned to a commit and was left as committed.
