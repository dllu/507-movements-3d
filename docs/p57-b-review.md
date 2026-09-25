# Pass 57, lane b: supports, real rod ends and jointed shafts

Scope: the pass-57 findings in `/dev/shm/audit57/b/findings.json` for 153, 183,
184, 186–189, 192–194, 197, 201, 234 and 247. The same support convention is used
throughout: a plain frame-grey back bar or column behind the moving parts,
with a boss or bearing for each fixed pivot and shaft. Where a floor is implied,
the frame stands on a foot. Supports are added after framing and tagged
`runsPastCrop`, so the plate framing does not change. The exceptions are 187
and 189, which gain plate-envelope fit bounds (see below), and 193, 194 and 197,
which gain a long lens.

All results were checked in fresh captures from a restarted private server
(port 44472). The final tiles are `/dev/shm/n57b/fin-A.png` (153–189) and
`/dev/shm/n57b/fin-B.png` (192–247). Columns are default, oblique
(0.8,0.3,0.6), rotm70 and zoomed-out. Per-ID working captures are
`/dev/shm/n57b/a*-<id>.png` and `b*-197.png`.

## Per movement

- **153** (baked stud reverser; `src/simulation/baked/stud-reverser.js`). A
  plain back bar is added at z −0.56…−0.66. It has a rail behind the sliding bar
  that drops to both roller axles, a drop behind the disk, and an arm to the
  elbow pivot. Each axle sits in a boss, and a short pillar and foot stand below
  the disk. It is presentation-only: the recorded motion is unchanged and no
  rebake was needed. All support z ≤ −0.24, while every moving part is at
  z ≥ −0.16, so it is clear by construction. Seen in a1-153 and fin-A row 1.
- **183/184** (`authored-quadrant-catches.js`):
  - The piston rod now moves with its tappet (before, it was static). It runs
    up through a sleeve guide above the view and down into a gland-topped steam
    cylinder below it.
  - Each back-weight rod has a fixed length and ends in a weight, so the weight
    rises and falls with its eye. The weights hang clear above the cylinder.
  - Both handle shafts sit in bosses on one back bar (behind the weight-rod
    layer). The bar carries the guide arm and stands on a foot beside the
    cylinder.
  - 184 builds the supports in the reflected view frame.

  Seen in a1-183, a1-184 and fin-A rows 2–3.
- **186–189** (`gab-disengager-18[6-9].js` and `gab-disengager-shared.js`). The
  eccentric rod runs on to a strap round a true eccentric sheave (16 units
  away). Its shaft turns in a bearing on a floor column. The rod now tilts
  slightly about the gab so the strap centre stays level with the sheave, or
  about the stopped sheave while the gab is lifted. The cam/claw/toe lift solves
  include that turn, so the contacts stay exact.
  - 186: a beam carries a hanger (hidden behind the rocker boss) to the
    rockshaft's rear bearing.
  - 187: the rockshaft has its own column (hidden behind the valve arm), and the
    fit bounds are set to the plate envelope. The rod was previously running
    across the whole view.
  - 188: a valve arm from a rockshaft below the view now carries the formerly
    floating pin. The pin swings on a slight arc and the rod follows it.
  - 189: the rod's pivot moves to the true strap end (x −658 px). The free bell
    crank now swings slightly with the running eccentric. A bracket behind
    carries the bell-crank stud boss, and the fit bounds are set to the plate
    envelope.
  - 187 and 188 now run 2 whole eccentric turns per run instead of 3, so the
    sheave stops where it started.

  Seen in a2/a3-186…189 and fin-A rows 4–7.
- **192–194** (new `mangle-universal-drive.js`, used from
  `reversing-mangle-guides.js`). This is the captioned jointed shaft: a real
  Hooke joint (yokes with bored eyes and a cross) at a fixed input bearing and
  another on the pinion shaft, joined by a telescopic slip shaft (bored tube
  plus rod).
  - The yoke phasing makes the pinion turn exactly with the input shaft.
  - The slip shaft stays within 35° of the axis.
  - The input bearing sits on an arm from a thin column beside the wheel. A
    standard behind the wheel carries the wheel shaft in a bored bearing, and
    each stands on its own foot.
  - This replaces the factory's ball-ended placeholder joint and its unconnected
    standard. Their source-presentation removals are dropped.
  - A long lens (fov 16) is used for 193/194, as 192 already had.

  Seen in a2-192, a3-193, a3-194 and fin-B rows 1–3.
- **197** (`mangle-rack-working-parts.js`):
  - The frame slides on a back rail through a fixed channel. The channel is
    always hidden behind the plate.
  - The rising and falling pinion shaft turns in a carriage on a thin vertical
    rail in front. Both stand on one foot.
  - The guide arcs are deepened (z 0.325–0.545) and their standards widened.
  - The guide bracket ends on its standard's centre, and a long lens (fov 16)
    removes the perspective "poke" past the short ends in the default view.

  Seen in b2/b3-197 and fin-B row 4.
- **201** (`authored-gears-core.js`, after `correctIrregularGearFamily`). One
  back bar stands on a foot behind rod A, where the two guide webs now land. It
  runs behind the pulley to a boss on the pivot shaft, then up behind the
  carrier's mean line to a bearing on the input shaft. Seen in a2-201 and fin-B
  row 5.
- **234** (`authored-escapements.js`, `hideGroundFor234`). A plain U-frame in
  the verge plane has a bored cock round S at each end and a foot bearing for
  the arbor on the bar below. The fit bounds are frozen without it. Seen in
  a2-234 and fin-B row 6.
- **247** (`authored-sounding-weights.js`):
  - The sounding line is now tied through an eye on the rod's top (the rod is
    lengthened, so the eye stays above the plate crop). It runs to a leadsman's
    hand in every phase, including the reset.
  - The reload sling keeps its own hand, set to one side, and a material that
    fades independently of the line.
  - The rod now hangs from its line while the sling lifts the weight.

  Seen in a2-247 (reset phases p8f/p9f) and fin-B row 7.

## Intersections (spacing 0.01, 129 poses)

Before: every row was sampled-clear per the ledger.

| ID | After | Notes |
|---|---|---|
| 153 | Clear by construction | The support z-separation is shown above. The sync registry screen uses the authored model, which is unchanged. |
| 183, 184 | Seated 0.0005 only | Unchanged. |
| 186–189 | Clear | Early coaxial 0.05 shaft-in-bar pairs were fixed: shafts now stop inside their bored bearings. |
| 192–194 | Clear | Early 0.04 rod/boss pairs were fixed by shortening the slip shaft to clear the solid bosses. |
| 197 | Clear | |
| 201 | Clear | Needed 8 GB heap. |
| 234 | Tangent working contact only | |
| 247 | Clear | Only the intended rope-to-knot and rope-to-eye tie contacts (0.071 and 0.037, deforming). Open meshes are the existing cutaways. |

The "fluid" pairs in 187 and 189 are the invisible camera envelopes and are not
real parts.

## Remaining flaws (honest)

- 186/187/189: in the default view a short grey hanger or column shows above
  the rocker boss (186) or below the valve-arm eye (187, 189).
- 188: the valve arm shows below the rod.
- 192–194: the input bearing arm crosses the lower wheel face in front. Brown
  omits the pinion and joint in 192/194.
- 197: the front shaft rail crosses the frame at the pinion's line.
- 234: the U-frame is plainly visible.
- 201: the back bar peeks from behind the carrier at its extremes.
- 183: the central back bar shows between and around the shafts, as in 181.
- 186–189: the strap sits within a 0.012 running clearance of the sheave while
  the gab steers the rod (it is exact while lifted).
- Forces are not simulated in any of these.

## Tests

All of these pass:
- `movement-183…189`, `192…194`, `197`, `198`, `201`, `234`, `238`, `247`,
  `299…302`
- `gab-joint-solids`, `quadrant-catch-finite-interfaces`,
  `stud-reverser-baked`, `reversing-mangle-finite-guides`,
  `radial-pin-mangle-contact`, `mangle-contact`, `mangle-rack-working-contact`,
  `irregular-gear-family`, `verge-crown-working-solids`,
  `release-mechanism-working-parts`, `baked-motion`, `source-presentation`

Test assertions forbidding frames or supports were updated to the support
convention. `docs/validation/191-196-201-contact.json` was regenerated: 0
penetrating poses. It fingerprints `authored-gears-core.js`, which other lanes
also edit, so it must be rerun after integration.

Display profiles to re-measure: 187, 189 (new fit bounds), 193, 194, 197 (fov
16), 234 (frozen fit bounds), and 153, 183, 184, 186, 188, 192, 201, 247 (new
off-frame parts).
