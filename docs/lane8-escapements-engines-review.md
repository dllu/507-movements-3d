# Lane 8: escapements, parallel motions, instruments — source-match pass

Scope: 246, 247, 294, 295, 296, 309, 310, 311, 312, 332, 335, 340, 342, 343 and 411.
Each was compared with `public/engravings/mm_NNN.png` in its default and oblique
review captures. Changes follow the AGENTS.md rule to match the plate, but only
where the linkage still closes and works. Where the plate and the official
animation conflict, the plate wins under the same condition. Every movement stays
scripted/analytic; none uses MuJoCo.

## Method

**Captures.**
- Standard: `node scripts/review-movement-source-views.mjs --ids=… --output-dir=/dev/shm/lane8`.
- The display profiles (`motionBounds`) are now stale for every ID here. The
  engine intersects them with the authored crop, so standard captures can be
  off-centre until the profiles are re-measured.
- Framing was judged with a scratch copy of the script that replaces
  `sampledMotionBounds` with the model's own swept box, which is what
  re-measuring produces. Scratch output is in `/dev/shm/lane8/final`.

**Intersections.**
- Command: `node scripts/show-body-intersections.mjs ID --spacing=0.01 --samples=129`.
- Where the ledger's "before" came from a narrower scoped check, the baseline
  was re-run on the HEAD file.

**Tests.** The focused tests listed at the end.

## Results

Depths are the worst solid or coaxial overlap in the generic screen. "0.0000"
pairs are intended seated or rolling contact.

| ID | Change | Worst before → after |
|---|---|---|
| 246 | Both long arms now run on past pencil A (0.65) and fixed point C (0.55), as drawn. | none → none |
| 247 | See the 247 section below. | 0.1664 solid → 0.0121 solid (seated-roller graze at reload) |
| 294 | See the 294 section below. | none → none (only one body presented) |
| 295 | See the 295 section below. | 0.1194 coaxial (spokes through the fixed arbor) → none |
| 296 | Tooth roots filled out to broad curved thorns; the baked leading face, tip and back edge are unchanged. Straight spokes replaced by a broad rim and web with three lens windows between curved spokes. | none → none |
| 309 | See the gravity-escapement section below. | none → none |
| 310 | See the gravity-escapement section below. | none → none |
| 311 | See the gravity-escapement section below. | 0.0001 → 0.0001 (the same lifting-pin graze) |
| 312 | See the gravity-escapement section below. | none → none |
| 332 | See the 332 section below. | none → none |
| 335 | See the 335 section below. | none → none |
| 340 | Joggling pillar F-B lengthened from 10 to 12 (F lowered 2). Plate F-B/D-C is 307/421 px = 0.73; the official ratio is 0.62. B swings only ±0.2 sideways, so C's straightness improves slightly (0.00069 → 0.00062). | none → none |
| 342 | Model time 0 is now Brown's pose: beam up about 12°, segment head down, piston low. This also brings the plate's crossed stays into view. `sourceStateAtTime` keeps the official clock. | 0.0000 seat → 0.0000 seat |
| 343 | The two thin rails with a gap become Brown's deep solid cross-beam: planks −1.71 to −2.69, beam to −4.86, capital plates below, columns up to them. | none → none |
| 411 | See the 411 section below. | 0.0513 coaxial / 0.046 solid (arch through tires, rims, spokes and index; stylus through the pendulum rod) → none |

### 247

- **View:** the camera is now near-frontal, as in Brown's section, with a 10° lens.
- **Removed:** the seabed reference rings (presentation).
- **Housing:** the housing and lower sleeve are shown as the back half (a 206°
  front opening), as in a section. The bell crank, pad and nose swing outside
  the rod radius and now pass through that opening.
- **Guide block:** raised 0.18, clear of the probe foot at full rise.
- **Probe foot:** moved 0.20 toward the axis. It now passes up through the
  dropped weight's bore.
- **Probe stem and bridge:** moved in front of the bell-crank plane.
- **Back wall:** narrowed so its corners stay inside the weight bore.
- **Detent spring:** now one smooth, capped tube rewritten in place (a deforming
  part), not straight segments overlapping at each bend.

### 294

- **Cut orientation:**
  - The passage cut had its wall on the opposite side from the working-band
    shell. It now continues the band opening on the same side.
  - It is cut deeper (152° of wall left), giving Brown's step at raster 280.
  - Presentation rotates the cylinder (2.77 rad about its axis) so the opening
    faces up toward the viewer.
  - With the camera moved toward the balance end, the window's left end shows
    as the rounded curl.
- **Pivot end:** the cone and broad flange are replaced by Brown's plug, rounded
  bell and thin ring.
- **Removed:** the undrawn black window rims (presentation).

### 295

- The broad wheel rim is now a thin rim line.
- Each straight stem foot is now a curved arm, swept back from under its pallet
  to the rim, as drawn.
- The spokes now start at the hub, so they clear the fixed arbor.
- A 12° lens is used, so the raised pallets no longer loom over the rim.

### Gravity escapements 309–312

**All four:**
- Near-frontal camera (0.6, 0.35, ~14) and a 12° lens.
- Crops end just below the fork or beat pins, as the plates do, which puts the
  bob below the frame for 309–311.

**309:**
- Spokes form Brown's X in the opening pose.
- The pallet arms are broad flat bars (about 0.42 wide) and the fork rods 0.17.
- Rebaked; only the arm plates changed.

**312:**
- The round rim is now Brown's straight-chord nine-sided rim.
- Removed by presentation: the bob (Brown dashes the pendulum), the undrawn
  reinforcement wires and the pitch-circle ring.
- Rebaked. The pallet-face plates keep slightly more area (0.0151 → 0.0159 and
  0.0189 → 0.0196) because the sample phase moved with the current display
  timing.

### 332

- Re-proportioned to the plate, taken with the 8-unit lever as the scale:
  - links 9.84 with C at 7.6;
  - radius bar 7.35 from F (11.35, 7.6);
  - E = 2Cr/(r+4) stays the straight-line point.
- The cylinder now matches the drawn one: lid 5.08–5.63, bottom 1.55.
- A 1.7-unit timing crank (official 2.75) gives a 3.4-unit stroke that fits the
  drawn cylinder. Lateral deviation improves from 0.0054 to 0.0008.
- The crosshead behind the links matches the plate, where the E pin is drawn
  over the block.

### 335

- Brown's Watt motion replaces the official short radius bar pivoted under A:
  - a long radius rod (10.9) runs left to F near the plate edge;
  - both drops are 4.
- B sits at 7.22, where |O-B|² = |F-Q|(|O-A|−|O-B|), so O, the Watt point and
  E stay collinear. The plate reads 7.97.
- Lateral deviation of E improves from 0.00107 to 0.00100.
- Model time 0 is the plate's level-beam pose; the official start falls at
  `canonicalTimes.sourceStart`.

### 411

**Plate proportions** (wheel-centre base = 4):
- arch top 1.9, with the pendulum eye on it;
- dotted apex 3.64;
- drum raised to 0.61 on its own live shaft, 1.77 long, radius 0.38;
- bob just below axle level;
- horizontal bar at 1.33 running past the left arch;
- one diagonal push bar held by the hands.

**Drive to the raised drum:**
- The bevel output now turns an axle-level countershaft.
- An equal 16/16 involute spur pair lifts the drive to the drum shaft; this is
  the ribbed wheel Brown draws at the drum end. Running gap is about 0.01.
- The drum now turns with the wheel (two reversals).

**Clearance fixes:**
- The arch tube moved in front of the wheels (z 0.34) and is capped.
- The pencil slides in a bore through the carrier and rod.
- The construction dashes moved behind the hubs.

## Reconstruction assumptions and residuals

**342**
- 12° is read from the beam edges (10–14°) and fits the chain-top block
  (+2.7 source units).
- The piston crosshead sits about 0.3 unit lower than drawn. With the camera
  tilt it reads close to the cylinder rim.
- The official ±20° swing is kept.

**343**
- Brown's parallel motion cannot follow his own crank. With rods about 4.75,
  vibrating piece 4.8 and a 4.37 crank, the 8.7 stroke would need the upper
  rod to reach about 5 units above its pivot.
- At a 4.3 crank with the official links, the vibrating piece would enter the
  cross-beam.
- The official 3.5 crank, rods and vibrating piece are therefore kept.

**340**
- Brown's pose tilts the beam about 31°, beyond the official ±18° swing that
  keeps C straight. The default pose is the official extreme.
- Brown leans the pillar about 6°. A vertical pillar is kept because the
  leaning version loses straightness.

**335**
- B is at 7.22, against the plate's 7.97 (see above).

**332**
- The link heights are taller than the official ones; the proportions are the
  plate's.
- D-E stays 4 (plate about 4.6).
- The stroke is reduced by the drawn cylinder.

**294**
- The wheel, balance and frame stay removed by presentation.
- The rotation places the cut where Brown draws it at t=0. The cylinder then
  oscillates ±60° as before.

**295**
- Fifteen teeth on a smaller wheel curve the rim more than Brown's arc.
  Brown's pitch implies about 20 teeth on a larger wheel; the baked contact
  fixes 15.
- One moving cylinder still replaces his superposed positions.

**296**
- The pallet contact geometry is baked, so tooth count (15) and the working tip
  are unchanged.
- The teeth are broader but less hooked than Brown's.

**309–312**
- 309–311 keep the pendulum rod in front of the wheel for the fork/beat pins.
  Brown does not draw it in 309, dashes it in 312, and draws only its ends in
  310 and 311.
- Earlier residuals are unchanged: 309/310 locking from the motion law, 311
  late lift, and 312 tooth-corner lift.
- 310's sickle legs and 311's curved three-legged wheels remain straight bars.
- **Bake dependency:** the plate bake fingerprints the display-timed motion.
  After the display profiles for 309–312 are re-measured, run
  `node scripts/generate-gravity-escapement-plates.mjs 309 310 311 312`.
  Only hashes (and sub-percent sample-phase trims) should change.

**411**
- The countershaft and spur pair are engineered; Brown shows only the ribbed
  wheel.
- The vertical drum guide and left bearing straps are kept.
- Brown's drum shaft runs to the arch sides.

**247**
- The seabed slab is still undrawn; it is kept edge-on as the probe's target
  and the weight's rest.
- The upper-arm roller grazes the weight bore at the manual reseat
  (≤ 0.012 sampled; the loaded support pair itself is unchanged).
- The spring/arm contact is now deforming (0.009).
- The reload-sling "fluid" pairs are unchanged.

**246**
- The traced paths remain as the drawing output.

## Tests run

All pass (203 checks) except as noted:
- **246:** `movement-246`, `pantograph-working-parts`.
- **247:** `movement-247`, `release-mechanism-working-parts`.
- **294–296:** `movement-294`, `movement-295`, `cylinder-escapement-contact-limits`,
  `cylinder-escapement-support-solids`, `movement-296`, `lever-296-finite-contact`.
- **309–312:** `gravity-escapement-working-solids`, `movement-309`…`312`.
- **Parallel motions:**
  - `movement-332`, `movement-333`, `movement-336`, `marine-parallel-solids`;
  - `movement-334`, `movement-335`;
  - `movement-339`, `movement-340`, `movement-341`, `vibrating-direct-action-solids`;
  - `movement-342`, `movement-343`, `beam-upright-solids`, `engines-326-345-clearance`.
- **411:** `movement-411`, `pendulum-instrument-solids`.
- **Loader:** `authored-loader`.
- **Camera:** the `camera-catalog` check, run on these 15 IDs only.

`source-presentation.test.mjs` currently fails on another lane's entry (217);
every lane-8 removal pattern matches a part.

**Test changes:**
- Tests were updated only where fixes change pinned values:
  - the 342, 335 and 332 plate poses and proportions;
  - the 340 pillar;
  - the 411 drum sense.
- A few ulp-level tolerances were widened because the sampled poses moved.
- 411's solids audit now also covers the spur pair, countershaft bearing,
  pencil bores and arch/tire pairs.

## Display-profile re-measurement needed

All 15 IDs: 246, 247, 294, 295, 296, 309, 310, 311, 312, 332, 335, 340, 342,
343 and 411. Framing, camera, pose or geometry changed; `measure-display-profiles`
was not run. After that, rebake 309–312 as noted above.
