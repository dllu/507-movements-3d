# Pass 71 — valve gears, reversing gears and engines (lane p71-e2)

IDs: 167, 171, 175, 179, 181–189, 383, 418, 424, 425, 427, 429, 470, 474, 484.

Every ID was checked in fresh captures beside the plate. The engines and
valve gears were also checked for function: valve timing against the crank,
reversing, linkage closure and steam paths. Eight IDs needed work. Four
engines were rebuilt as working sections with translucent steam, using
`src/simulation/steam-section-kit.js` as in p69: 424, 425, 427 and 429.
Two reversing gears now reverse the engine and loop seamlessly: 171 and 185.
171 also gained Brown's rock-shaft arm. 418 now has a real slide valve with
ports. 470 now has Brown's low anvil.

Captures are outside Git:

- before: `/dev/shm/p71-e2/before/ID-tile.png` (phases 0, ¼, ½, ¾; ±60°,
  top, back; with the plate) and `/dev/shm/p71-e2/before-src/ID-default.png`;
- after: `/dev/shm/p71-e2/after/ID-tile.png` and
  `/dev/shm/p71-e2/after-src/ID-{default,oblique}.png`.

The phase captures used extra phases where needed: 179 at 0–0.95; 185 at 0,
0.25, 0.45, 0.7; 427 at 0–0.3; 429 at the pocket release; 470 at 0, 0.3,
0.45, 0.6.

Intersections were checked with `show-body-intersections` logic at 129
samples. As in p69, a scratch copy skipped the per-frame steam volumes.
Spacing was 0.01, except 424 at 0.045 and 427 at 0.02; those models are
built in large source units and scaled down, so both spacings are about
0.01 in world units. Loop seams were checked with `check-loop-seams`.

## 424 Root's square piston engine (rebuilt)

**How it works.** A is the oblong cylinder, drawn in section with its front
cover removed.
- Frame piston B slides horizontally between A's end walls.
- Piston C slides vertically inside B.
- Wrist a is fast in C. B therefore takes the wrist's x and C takes both
  its x and y. The two pistons are the Cartesian components of the crank
  circle, so they never reach a dead point together.
- Brown's black ports are the admissions: B's ports are in A's end walls,
  and C's are at the top and bottom.

**What was wrong.**
- C's ports were slots through B's walls that led nowhere. A's walls had no
  opening above them, so C could never take steam.
- Shaft b ran on an undrawn front arm and standoff.
- No steam was shown.
- Brown's pose was not matched: C sat at mid-height, but Brown shows it low.
- The wrist was a small white pin.

**What changed.** Rebuilt in Brown's proportions, measured at 26.5 px per
unit on the doubled plate.
- A is one sectioned casting.
  - Its four ports are passages in the walls: the side ports serve B, and
    the top and bottom ports serve C.
  - Each passage turns back through the back cover into a short blind pipe
    to the valve, which Brown does not draw.
- B's top and bottom walls are slotted over A's ports, but only in the back
  1.8 of their depth. From the front B is still a closed frame, and C's
  spaces reach their ports through the slots.
- Crank b lies behind C, where Brown dots it.
  - The crank arm works in a round pocket in the back of C, closed by the
    back cover. The pocket leaves a 0.4 sealing land.
  - Shaft b runs out through a bearing boss in the back cover.
  - The front arm, the standoff and the steam markers are gone.
- Crank radius is 4.2 (Brown's is about 5). This is what lets the pocket fit
  inside C.
- Pose: the wrist is at −43.6°, as Brown shows it (B to the right, C low).
- Steam: each of the four spaces, with its port, is live while it grows and
  exhausting while it shrinks, softened over ±8°. The torque is positive
  everywhere, anticlockwise.

**Checks.**
- Intersections: before, sampled-clear. After, 0 pairs at spacing 0.045.
  The back cover is flagged "open", which affects the inside test only.
- Loop seam: none.
- Bad faces: only degenerate caps on lathe axes, and the moving B and C
  facing the section plane (as in p69).

**Proposed ledger.**
- assessment: reasonable
- visibleFlaws: (none)
- limits: Brown draws no valve or crank bearing; the port passages, the
  blind pipes to the valve, the slots in the back of B's walls and the crank
  pocket in C are engineered. The crank radius is 4.2 against Brown's ≈5, so
  the pocket keeps a sealing land in C. Admission is the ideal law, live
  while each space grows, with no cut-off or flow solution.

## 425 Eccentric rotary engine with sliding abutment (rebuilt)

**How it works.**
- Shaft B runs through the centre of cylinder A. Piston C is an eccentric
  fast on B and touches the bore along one line. Brown's hatched square is
  the packing strip on that line.
- Abutment D slides in the guide between the necks and rides on C.
- Steam enters by the right neck (Brown's down arrow) and drives C clockwise
  (Brown's arrow). The space ahead of the contact line is swept out of the
  left neck.

**What was wrong.**
- The necks were capped, with pipe stubs in them, so there was no open
  steam path. A thin undrawn channel ran round inside the casing wall.
- No steam was shown.
- D's nose was a separate part, with a hidden "seal shoe".

**What changed.** Rebuilt in official-trace units (bore 7, eccentricity 2)
against Brown's plate.
- The casing is one sectioned pear-shaped casting on its foot.
  - The two neck channels open into the bore on either side of D and are
    open at the flanged tops, as Brown draws them.
  - D's guide slot rises into the tower.
- C carries the dark packing strip on the contact line.
- D, with its round nose, rides on C and stays inside its guide.
- Steam volumes are the actual pieces of the crescent:
  - The space from D round to the contact line fills as the contact line
    passes the inlet mouth. It is live, and blows down as the contact line
    passes the eduction mouth.
  - The space ahead of the contact line is faint.
  - The inlet neck is live and the eduction neck faint.
  - While the contact line crosses between the two mouths, the live space is
    open to both. This is the engine's inherent dead point.

**Checks.**
- Intersections: before, 0.0275 on C against D. After, 0 solid pairs; the
  only row is the shaft coaxial in its bore.
- Loop seam: none. The checker reports a 9.5% visibility "pop" at phase
  ½, where the released live space becomes the swept space. The union is
  the same region at the same (exhaust) pressure, so nothing visible
  changes.

**Proposed ledger.**
- assessment: reasonable
- visibleFlaws: (none)
- limits: The load that keeps D on C and steam leakage are not modelled.
  Pressures come from port connectivity; this is not a flow solution. The
  inlet-to-eduction blow-through while the contact line passes the top is
  inherent to Brown's port layout. The neck tops are open flanges; no pipes
  are drawn.

## 427 Rotary engine with eccentric shaft and radial pistons (rebuilt)

**How it works.**
- Hub C is concentric with shaft B, whose bearings are eccentric to the
  cylinder, so C touches the bore at the top.
- Pistons A are fast on rings that turn on a hub centred on the cylinder
  (Brown's dotted ring). They are therefore always radial to the cylinder,
  reach the bore, and slide through rolling packings a in C's rim. The
  packings rock by up to ±12°.
- Steam enters by the right neck, just past the contact line. It drives the
  piston that has passed the inlet, and C turns clockwise.
- The steam cut off between the pistons expands until the leading piston
  uncovers the left neck (Brown's up arrow).

**What was wrong.**
- The necks were solid posts, so there was no steam path.
- C was a flat disc, and the pistons did not follow Brown's arrangement.
- No steam was shown.

**What changed.** Rebuilt from Brown's plate at 47 px per unit.
- The casing is a sectioned ring with a flat top between the necks, on the
  shared cast foot. The neck channels open into the bore at ±34° from the
  top.
- C is a rim with packing sockets and notches, carried by a front web on
  shaft B. The web uses the shared see-through style, because Brown dots the
  rings behind it.
- The pistons carry wedge heads on two rings. The rings turn on a fixed hub
  on the back head, which also bears shaft B.
- Steam:
  - behind the piston past the inlet: live;
  - between the pistons: live before cut-off, then isothermal expansion
    (pressure = cut-off area / area), then released as the leading piston
    uncovers the eduction mouth;
  - ahead of the leading piston: faint.

**Checks.**
- Intersections: before, sampled-clear. After, 0 pairs at spacing 0.02.
- Loop seam: none. The checker reports a 32% "reshape" at phase 0.158, when
  the pistons swap roles at the contact line. The union is continuous and
  the pressures agree at the swap, so it is only a relabelling.
- Bad faces: degenerate caps on the shaft lathe; C's rim faces the section
  plane.

**Proposed ledger.**
- assessment: reasonable
- visibleFlaws: (none)
- limits: The packings are set diametrically opposite in C, so Brown's lower
  piston (about 28° from diametral in the plate) is not matched exactly. The
  pistons stop short of the front cover by the thickness of C's front web
  (0.14); that clearance and all piston leakage are not modelled. Both rings
  turn on one hub on the back head. Expansion is isothermal by area; this is
  not a flow solution.

## 429 Holly's double-elliptical rotary engine

**How it works.** The two conjugate toothed pistons turn in opposite
directions. Steam entering at the top between them presses their lobes
apart. Each lobe carries a pocket of steam round against the bore and
releases it into the bottom eduction throat.

**What was wrong.**
- The pistons were only 0.58 deep in a bore 1.22 deep. They sealed neither
  the back cover nor the section plane, so steam could pass behind them.
- The necks were whole round pipes standing behind the section plane, so
  Brown's open channels were not visible.
- No steam was shown.

**What changed.**
- The casing is one sectioned plate cut on the front plane, with both bores
  and the two straight port channels running into the throats between the
  bores. A solid back cover closes it.
- The pistons now fill the bores' whole depth, and the shafts stop at the
  section plane.
- Steam:
  - the space open to the top throat is live;
  - the pockets carried against the bore stay at inlet pressure;
  - the bottom space is faint. When a pocket opens into it, the space takes
    the mixed pressure (pocket area over total, about 0.59) and blows down
    over 12°. Releases fall every quarter turn.
- The profiles are unchanged, and the mating-contact report was
  regenerated: 1,025 poses, 0 overlap, largest gap 0.0134.

**Checks.**
- Intersections: before, sampled-clear. After, 0 pairs at spacing 0.01.
- Loop seam: none. A 38% "reshape" is reported when a pocket joins the
  exhaust space; this is the physical release, shown as mixing.

**Proposed ledger.**
- assessment: reasonable
- visibleFlaws: (none)
- limits: Pocket release is shown as isothermal mixing followed by a 12°
  blowdown; this is not a flow solution. The relieved mate gap reaches
  0.0134. The profiles and pose are the official trace's, not re-fitted to
  Brown's diagonal pose.

## 171 Oscillating-engine Stephenson reversing gear

**How it works.**
- Two opposite eccentrics drive the slotted link.
- The die on the vertical rod drives the curved slide, which is guided on
  the two columns.
- The slot in the slide is an arc about the trunnion. The rock-shaft arm's
  pin rides in it, so the cylinder's rocking does not move the valve.
- Throwing the link over reverses the valve timing, and so the engine.

**What was wrong.**
- Brown's rock-shaft arm, entering from the left over the guide block to
  the pin at the top of the slot, was missing. A white pin floated on an
  invisible rotor.
- The shaft kept turning the same way while the link was reversed, so the
  gear did not reverse the engine.
- The loop was declared as one 6 s crank turn, but the motion repeats only
  every 18 s (period mismatch 5.8%).
- An eccentric-rod pin reached into the output rod's layer: 0.068 overlap
  in full astern gear.

**What changed.**
- The rock shaft now lies to the left, off the plate. A curved flat arm runs
  from it over the left block, along the outside of the slide and in behind
  it to a dark pin in the slot. The slide's eye pin was shortened to its
  front, so the arm passes behind it.
- The selector dwells in full gear, and the shaft speed follows it
  (−ω·selector):
  - ahead one way, astern the other;
  - stopped in mid gear while the reach rod is thrown over;
  - the shaft angle returns to its start after 18 s, and the loop is
    declared as 18 s.
- The eccentric-rod pins now span only the link and the rod eye.
- The `docs/validation/171-*.json` reports were regenerated. The whole
  assembly (580 pairs × 129 poses) is clear, and closure error is 1.3e-14.

**Checks.**
- Intersections: before, 0.0281 (and 0.0684 in the new schedule). After, 0
  pairs.
- Loop seam: none. The period mismatch is 0.
- Bad faces: tiny same-look coplanar edges on the slide rails, as before.

**Proposed ledger.**
- assessment: reasonable
- visibleFlaws: (none)
- limits: Operator reversing selection prescribed. The shaft speed is taken
  proportional to the gear (stopped in mid gear), which stands for the
  engine's response. The rock shaft, the valve output linkage and the
  cylinder are not drawn by Brown; the rock-shaft pivot off the plate and
  the arm's path are inferred. Hidden crank and rocker dimensions are
  inferred.

## 185 Locomotive Stephenson link motion

**What was wrong.**
- The lever moved the link through forward, mid and backward gear, but the
  shaft kept turning forward at constant speed, so the gear never reversed
  the engine.
- The loop was declared as one 3 s shaft turn, but the motion repeats only
  every 24 s (mismatch 5.3%).

**What changed.**
- The shaft now runs forward in forward gear, backward in backward gear and
  stops in mid gear. Its speed follows tanh(−selector / 0.1), so Brown's
  partial forward setting runs at nearly full speed.
- The loop nets exactly one forward turn and is declared as 24 s.
- The test now checks direction by gear and samples the bounds over the
  whole loop.

**Checks.**
- Intersections: these are pre-existing joint-layering overlaps where
  coplanar links meet at shared pins, each no deeper than half a link
  thickness:
  - rocker arm against valve link: 0.060;
  - valve link against stem: 0.055;
  - lifting lug against suspension rod: 0.053;
  - handle against suspension rod: 0.028.

  The ledger had one, 0.094, as unclassified.
- Loop seam: none. The mismatch is fixed.

**Proposed ledger.**
- assessment: minor
- visibleFlaws: The expansion link is about 1.5× the pin spacing, where
  Brown draws about 1.26×. The die over-travels the rod pins in full gear.
- limits: Operator reversing prescribed; the shaft speed follows the gear.
  Coplanar links interpenetrate by up to 0.06 at their shared pins; this is
  a layering residual. Guide offsets are engineered. Roller spin is
  illustrative.

## 418 Buchanan & Righter's slide-valve motion

**What was wrong.**
- The seat had one plain hole, and valve A had no hollow, so there was no
  working valve.
- The valve travel of ±0.95 exceeded half of A (0.9). No port layout could
  serve it.

**What changed.**
- Travel is now ±0.45: a port width plus lap each way.
- A is a D slide valve, with a hollow underneath closed front and back.
- The seat carries Brown's three ports. They run down into a sectioned
  cylinder casting (Brown's hatched ground):
  - the middle exhaust port under an arch;
  - the outer steam passages bending out to the cylinder ends.

  The passages are cut in half by the section, with their back halves in
  the casting.
- The undrawn foundation slab and its `remove` entry are gone.
- Steam:
  - the chest is live;
  - a port uncovered by A is live;
  - a port joined to the exhaust through A's hollow is faint.

**Checks.**
- Intersections: before, sampled-clear. After, 0 pairs. The seat is flagged
  "open" after its cutaway, which affects the inside test only.
- Loop seam: none.
- Bad faces: the chest-wall coplanar and back-to-back flags pre-date this
  pass. A's front face meets the section plane.

**Proposed ledger.**
- assessment: reasonable
- visibleFlaws: (none)
- limits: Steam fills only the lower chest; the connected space in the bell
  round guide D is not tinted. The chest end walls stand inside the view
  where Brown's flange runs off the plate. The valve input is prescribed.
  The roller's loaded-wall convention is prescribed.

## 470 Single-acting steam hammer

**What changed.** Brown draws a low, broad anvil block between the feet.
- It replaces the tall brass cone and black face.
- The anvil face is 0.16 above the floor, and the piston rod is lengthened
  to suit. The piston's travel in the cylinder is unchanged.

**Checks.**
- Intersections: only the seated hammer-face/anvil contact, 0.0000, and the
  steam chamber (fluid).
- Loop seam: the known 7.1% steam-chamber visibility pop, which is hidden
  inside the closed barrel.

**Proposed ledger.**
- assessment: reasonable
- visibleFlaws: (none)
- limits: The loop starts with the hammer at rest on the anvil, while Brown
  shows it raised. The spool stroke is ±0.058. The standard's depth is
  inferred.

## Reviewed, no change

For each of these the function was confirmed in phase captures. Earlier
evidence and intersections stand, and loop seams are clean.

- **167 Endless-groove drum.**
  - Function: the stud on the rod runs in the opposite-hand grooves, and
    the drum turns one way throughout.
  - Ledger: assessment reasonable; visibleFlaws none; limits unchanged.
- **175 Crank turning once per stroke.**
  - Function: the branch transfer is continuous.
  - Ledger unchanged.
- **179 Loose-eccentric reversing gear.**
  - Function, over 11 phases: the rod is lifted, the lever works the valve
    by hand, the loose eccentric turns half a turn against its stop, and the
    rod drops; the valve then runs with the opposite phase.
  - Ledger unchanged.
- **181–184 Blowing-engine catch gears.**
  - Function: the tappet strikes each handle in turn, and the catches latch
    as the caption describes.
  - Ledger unchanged.
- **186–189 Gab disengaging gears.**
  - Function: the gab drops on and lifts off the pin as captioned.
  - Ledger unchanged.
- **383, 474, 484.**
  - These are not steam-path sections (Brown draws exteriors), and the
    captures match the plates.
  - Ledger unchanged.

## Tests run (all pass)

- `tests/movement-424.test.mjs` (rewritten)
- `tests/movement-425.test.mjs` (rewritten)
- `tests/movement-427.test.mjs` (rewritten)
- `tests/movement-429.test.mjs` (roles updated, steam test added)
- `tests/movement-418.test.mjs` (steam test added)
- `tests/movement-470.test.mjs`
- `tests/movement-185.test.mjs` (reversal replaces the fixed turn count;
  bounds sampled over the loop)
- `tests/models.test.mjs` 171 block (round-off tolerances scaled to the
  longer arm; reversal asserts added)
- `tests/piston-engine-solids.test.mjs` (424/425 branches rewritten)
- `tests/rotary-engine-427-429-solids.test.mjs` (427 branch rewritten)
- `tests/holly-mating-profile.test.mjs` (report regenerated)
- `tests/valve-family-solids.test.mjs`
- `tests/hammer-working-interfaces.test.mjs`
- `tests/source-presentation.test.mjs`
- `tests/rotation-indicator.test.mjs`
- `tests/steam-engine-working-solids.test.mjs`
- `tests/thermal-steam-469-474-solids.test.mjs`
- `tests/authored-loader.test.mjs`

## Notes for integration

- Display profiles and motion bounds (`src/data/display-profiles.js`) are
  stale for 171, 185, 418, 424, 425, 427, 429 and 470. Periods, geometry and
  scales changed. The four rebuilt engines now set `cameraFitBounds`.
- `docs/validation/171-unit.json` and `171-browser.json` still fingerprint
  the old `authored-marine-valve-gears.js`. Their generators were not rerun.
