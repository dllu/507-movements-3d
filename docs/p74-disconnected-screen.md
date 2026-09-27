# Pass 74: disconnected-part screen

The user asked for "another pass to fix all the movements that have disconnected parts". Examples were 494's tong links
stopping short of their pins, 466's blocks floating above the platen, gaps in 468 and 481, and 474's handles not joined
and legs without end caps. This pass adds a reusable automated screen, runs it over all 507 movements and triages the
flags visually. It does not edit any movement factory.

## Tool

`node scripts/screen-disconnected-parts.mjs [--ids=1-507] [--jobs=3] [--out=/dev/shm/507-disconnected-parts.json]`

Optional flags are `--touch`, `--connect`, `--figure`, `--phases`, `--spacing`, `--max-points` and `--max-old-space-size`.
Each movement runs in its own worker process. Results are merged into the JSON output, so a partial rerun only replaces
its own IDs. `--worker=ID` prints a single result. Set `P74_DEBUG=<role regex>` to list the neighbour gaps of matching
meshes.

- **Model.** The screen loads the production model through `model-loader.js`, with baked MuJoCo routes and source
  presentation applied. It does not use the synchronous registry fallback, which differs for the baked and MuJoCo IDs:
  for example, 149 has 54 meshes in the registry but 20 in production. Baked data is read from disk through a
  fetch shim.
- **Phases.** Six phases are sampled at (i + 0.21) / 6 of the review period, using the same period rule as the
  intersection screen.
- **Distance.** For each pair of visible meshes whose world boxes are within `--connect`, the screen measures the
  rendered-surface gap. It samples dense surface points on each mesh (spacing diag/350, at most 5000 per mesh) and finds
  the closest point on the other mesh through a triangle BVH (`tests/helpers/solid-surface.mjs`), in both directions.
  If one mesh lies inside a closed mesh, the gap is 0, so a pin buried in a hub counts as touching.
- **Mesh classes.**
  - *Fluids* neither join the graph nor get flagged. A fluid is a translucent non-see-through material, or a role that
    names a fluid state (water-column, live-steam-in-..., meniscus, jet, spray, ...). A role that merely names a medium
    ("water-wheel", "steam-cylinder", "downstream-log") is still treated as solid.
  - *Connectors* join the graph within 3 × touch but are never flagged. Connectors are ropes (laid-rope geometry),
    cords, belts, chains, springs and any mesh whose geometry deforms.
  - *Solids* are everything else, including see-through parts.
- **Detached components.** At each phase, meshes with gap ≤ `--touch` are joined into components. Components whose
  boxes are within `--figure` are grouped into one figure, so a plan beside an elevation, or paired views, each keep
  their own main assembly. Every component other than a figure's largest is reported with:
  - its parts
  - its gap to the main assembly
  - the bridging pair and that pair's relative motion (rigid, hinge or moving)
  - the phase and world position
  - whether it is `persistent` (separated in every phase)

  The kind is `floating` when the gap is greater than `--connect`, otherwise `near-miss`.
- **Hinge classification.** For a hinge pair (a relative motion that is a pure rotation about a fixed axis line, solved
  from the sampled transforms), the screen measures the angular coverage of each mesh around the joint axis:
  - If the outer mesh wraps the axis (coverage ≥ 0.75), the joint is `bore-clearance`.
  - Otherwise it is `short-of-pin`: a link end that stops beside its pin.
- **Near-miss pairs.** `nearMiss` lists every pair that never touches but stays within `--connect` in every phase, with
  its relation and joint class. It is diagnostic only; most of these pairs are gear, rack and cam running clearances.
- **Open ends.** For tube, cylinder, lathe and capsule meshes, each open boundary loop is found. A loop counts as capped
  when its centre lies within touch + 0.25 r of another visible surface, or inside a closed mesh. Uncapped loops are
  reported as `openEnds`.

### Thresholds (fractions of the model's bounding diagonal, typically 7–15 units)

| option | default | meaning |
|---|---|---|
| `--touch` | 0.0015 (≈ 0.015 units) | joined / touching; also absorbs normal pin running clearance |
| `--connect` | 0.012 (≈ 0.12 units) | near-miss vs floating boundary; pair-search radius |
| `--figure` | 0.04 | components this close belong to one figure |
| `--phases` | 6 | sampled phases |
| `--spacing` | 1/350 | surface sample spacing |

An earlier touch of 0.0006 flagged ordinary pin clearances (rope-in-groove 0.006, pin-in-bore 0.002–0.005) in most
movements. At 0.0015 those joints join, and the floating list is dominated by real separations.

### Tests

`tests/screen-disconnected-parts.test.mjs` covers:

- the component grouping and the angular-coverage bore/short-of-pin classifier
- the fluid role pattern
- a synthetic model: a floating block and a link 0.05 short of its pin are flagged, and a load hanging on a rope is not
- the open-end check: a bare tube leg is flagged and a capped one is not

## Full run

The production screen ran over all 507 movements, 3 workers at a time, in about 15 minutes of worker time, with a
maximum of 23 s per movement. It produced:

- 367 detached rows (149 floating) in 180 movements
- 19 movements with open-end rows

Full results are in `/dev/shm/p74-screen/all.json`.

Triage captures were made from one vite server at 44744 and one browser. `/dev/shm/p74-screen/zoom.mjs` renders each
flag at the flagged phase in three views: the full default view with the gap circled, a zoom on the gap along the
default camera axis, and a zoom rotated 60° about the vertical. Doubtful cases were then placed beside the engraving.
All 339 deduplicated detached flags and all 24 open-end flags were inspected.

### Confirmed visible disconnections (`/dev/shm/p74-screen/confirmed.json`)

| ID | problem | gap |
|---|---|---|
| 86 | overhead post B stands beside the base plinth, not on it | 0.079 |
| 145 | yellow bearing/retaining rings float loose round their pins; the wrist ring is clear of the link | 0.068 |
| 170 | spreading bow ends short of the right arm (Brown: the bow passes through both arms) | 0.112 |
| 273 | front retaining rings float loose round the through-pins A–D | 0.035 |
| 290 | pendulum rod C stops below the suspension chops | 0.03 |
| 291 | detent spring A ends short of its fixed block b | 0.08 |
| 310 | gravity-arm pivot bearings hang below the crossbar with no joint | 0.19 |
| 332 | parallel-motion joints at D, C and E: the bar and link eyes do not engage their pins | ≥0.02 |
| 338 | upper radius bar eye sits off-centre on pin U, leaving a visible crescent | 0.13 |
| 373 | the wagon body floats above its chassis | 0.045 |
| 376 | the output axle "rigid with treadwheel" touches none of the cage spokes | 0.22 |
| 412 | the locking pawls lift clear of the barrel rim during part of the cycle | 0.188 |
| 454 | a yellow ring floats loose round the lever fulcrum pin | 0.015 |
| 470 | the anvil block is separate from the standards' feet (Brown draws one base) | 0.44 |
| 473 | the upper check-valve disk hovers above the bell stem between the ropes | 0.268 |
| 492 | the tackle hook does not engage the tongue end | 0.22 |
| 500 | section view: the rod from disk A ends short of the lug pin | 0.074 |

### User examples in the current tree

The user's examples were re-screened against HEAD (055f725) and against the current working tree:

- **494.** At HEAD there were 6 detached rows: the curved gripping arms were 0.106 short of the upper arms, the eye was
  0.40 from the hoist ring, and the uncapped ends of the gripping arms were flagged. In the working tree (pass-73 edits)
  none of these remain. Only the ground bed separates from the lifted stone, which is correct.
- **466.** At HEAD the load and the ram/platen group were floating, 1.15 and 0.64 from the rest. In the working tree
  there are none.
- **474.** At HEAD 6 uncapped handle and leg tubes were flagged. In the working tree there are none.
- **468.** At HEAD there were only rigid near-miss pairs of 0.02 between the frame and the pipes. The working tree has
  no detached rows.
- **481.** The remaining near-miss rows (0.085 from the drum journal to the rear head, and the partition sheets 0.05
  apart) are the intended outer compartment gaps and the journal clearance. They are not confirmed.

The screen reproduces the user's examples on the old tree, and the lanes that edited them have already cleared them.

### Minor, not confirmed (visible clearance but the parts read as joined)

These are listed for the fix lanes' discretion:

- 13, 14, 16, 17: the hook floats about 0.02 inside the load's eye ring.
- 64, 66, 67: a loose sleeve on the input shaft shows a crescent.
- 130: the jaw pivot pin is loose in its bore.
- 167: the drum-groove stud tip clearance is 0.065.
- 190: the pressure-shoe pin is loose.
- 195: the worm-to-wheel tooth clearance is 0.06.
- 201: the gear bore is larger than the shaft.
- 230, 231: the crank and coupler pins have 0.04 radial play.
- 287: a centrifugal weight leaves its leaf spring by 0.09 at one phase.
- 336, 337: parallel-motion eyes have 0.02–0.03 play.
- 393: the polishing pad sits 0.028 above the lens.
- 448, 449: the lifted check-valve plates hover in the barrel with no guide.
- 459: the worm thread clears the star pins by 0.054.

### False-positive classes discarded

- **Hands holding ropes.** The hand meets the rope within 0.01–0.08, and the grip is drawn around the rope
  (5–22, 247).
- **Rope-borne loads.** These include rope-to-pulley tread clearances.
- **Section and cutaway parts.**
  - Parts hidden inside tubs or casings (473 lower valves).
  - Section halves with a small offset (249, 453, 481–482).
- **Deliberately undrawn supports.** Fixed flumes, the bell and stream beds with no support drawn (420, 436, 438, 440,
  444). By the no-undrawn-supports rule these stay unsupported.
- **Separate figures and traced curves.** Examples are 405's opposite hyperbola branch, 499's dial marks and 498's
  scale tags.
- **Running clearances.** Gear, rack and cam clearances, and intermittent contacts (pawls, cams, escapements) that
  break in some phases by design.
- **Baked-model phases.** The flag for 181's hanging back-weight rod eye (a 1.5 gap) comes from the baked model's phase
  mapping. It was not seen in the rendered views.
- **Open ends.** All 24 remaining open-end flags render with closed-looking ends:
  - hook tube ends (12–22)
  - curve traces (405, 406)
  - bellows pleat cylinders (453)
  - handwheel handles (490)
  - bore liners (249)

  None was confirmed. The open-end check did confirm 474's legs and handles and 494's gripping arms at HEAD, and both
  are already fixed.

## Limits

- The screen samples six phases. Contacts that break for only a short part of the cycle can be missed, and a short
  separation can be reported as persistent only if it spans all six samples.
- Gaps are measured between rendered surfaces. A gap hidden behind another part is still flagged, so triage must
  confirm visibility.
- The hinge solver needs a clean fixed axis across all sampled phases. Baked playback with jitter falls back to
  `moving`.
- The fluid and connector classes come from role patterns and material translucency. Unusual role names can
  misclassify.
- Instanced meshes are skipped; their count is reported.

## Fixes after the first run (lead, 2026-09-27)

Lane p77-dc found two classification bugs that produced false floats:

- **Deforming meshes were measured in their last-phase shape.** Ropes, bands and other meshes rebuilt each frame are now snapshotted per phase (a plain position/index copy, since custom geometries such as the laid rope cannot be cloned without constructor arguments), and every distance and box uses the phase's own snapshot.
- **Any role ending in a medium word was treated as fluid.** The suffix rule (`...-water`, `...-steam`, `...-mercury`) now excludes solids described as standing, immersed, submerged, dipping or resting in the medium, and `in-water`-style endings (e.g. `shaft-exhaust-pipe-standing-in-water`). The combined classifier is exported as `isFluidRole`.

After the fixes, 473 (ropes and the tub pipe) screens clean.
- **Instanced meshes were skipped.** Generated teeth drawn as an `InstancedMesh` (e.g. 195's face teeth) are now merged per phase into one geometry in the mesh's frame, so they join the part they belong to; they are excluded only from the open-end check. 195 now screens clean.
- **Solids named after the water they hold.** Roles such as `fixed-force-pump-cylinder-above-water` (450's barrel) or `…-trough-receiving-raised-water` end in a medium word but are solids; the suffix rule now also excludes roles with `above`, `receiving`, `rotating`, `stationary` or `sealed`. Media such as `fixed-outer-tub-water` or `hand-pump-reservoir-water` stay fluid.
