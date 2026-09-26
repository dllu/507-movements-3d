# Pass 59: see-through foreground parts (lane p59-hidden)

The user's new policy is as follows. Where Brown's engraving draws occluded
working details with dotted or dashed lines, the foreground part that hides
them is drawn semi-transparent in one consistent style, so the working parts
behind it show. Dashed notation lines are still never drawn, and paths,
second poses and construction figures stay undrawn.

This lane took over the stalled lane p59-hidden. It checked that lane's
partial work, finished it, and redid the verification.

## Shared helper

`src/simulation/see-through-part.js` exports `makeSeeThrough(object)`. It
applies one style to every part it touches:

- Face opacity is 0.45. Where the surface turns away from the viewer (rims,
  bevels, the silhouette), an edge term raises the opacity towards 0.9, so
  the part still reads as a solid body.
- `depthWrite` is off and `renderOrder` is 2. Everything behind the part is
  drawn first, and opaque parts in front still hide it.
- Only front faces are drawn. The parts are closed solids, so their back
  faces would only double the tint.
- The part casts no shadow. `markShadows` honours `userData.seeThrough`.
- Materials are cloned, so shared materials stay opaque. Clones of a
  see-through material keep the style.

`rotation-indicator.js` applies the same fragment patch when a see-through
part also carries the quadrant rotation cue. Either order works.

`scripts/screen-body-intersections.mjs` used to class every material with
opacity below 0.6 as a fluid. It now treats `userData.seeThrough` meshes as
solids, so these parts are still screened for intersections.

## Movements given the see-through treatment

Each one was checked against its plate. The helper is applied only where
Brown dots a hidden working part behind a foreground part.

| ID | See-through part | What shows through (Brown's dotted detail) |
|---|---|---|
| 63 | Driving disk | The drop's leg and the working ends of the pins |
| 67 | Tumbler E | Wheel B and the shaft's pin C |
| 70 | Cover of driving wheel C | The rim and tappet B, and A's studs where they pass behind C |
| 71 | Front plate of B | The interior studs, the tappet and the inside of the rim |
| 94 | Slotted radial plate | The two-turn spiral groove plate and the bolt's shank |
| 279 | The journal box's lining pieces and taper gibs | The crank throw behind them |
| 281 | The grooved disk (body, groove lands and groove floor) | The driving arm keyed on the shaft behind the disk |

Candidates from `docs/p53-no-hidden-lines-review.md` that were not given the
treatment:

- **261**: the plate draws no dotted line (checked at full size).
- **221, 297, 310**: the dotted part is modelled in front of the part Brown
  puts in front of it, so there is nothing to see through.
- **423**: the dotted circle may be a flywheel, but no flywheel is modelled.
- **142, 166, 168, 169, 172, 175, 369, 405, 408, 411, 421, 424, 473**: the
  dots are paths or construction figures, not hidden parts.

## Per-movement changes

### 63
The driving disk is see-through. No other change.

Intersections: screened at 0.01 spacing over 129 poses, with the disk now a
solid target. No pairs.

### 67
- The tumbler E is symmetric. Brown's E is symmetric about a line through the
  shaft centre, turned 13.5° clockwise from vertical: the horn tips sit at
  equal radius and the scalloped edge has one central hollow between matching
  lobes. The outline is the mirror average of the freehand trace about the
  best-fit axis (76.5° from +X). It stays within 17 source pixels of Brown's
  line; before, the limit was 13 px against the asymmetric trace.
- The plate's area changed from 9.31155 to 9.31266. The lower impact moves
  about 0.01 s later.
- E is see-through.
- The plain weight sleeve carries the quadrant rotation cue.

Evidence: `/dev/shm/x3b/src1/67-default.png` and `-oblique.png`, and
`/dev/shm/x3b/rv/67-{obl,rot,rear}.png`.

Intersections: screened at 0.01 spacing over 129 poses, with E as a solid
target. No pairs.

### 70
- C's cover is see-through and shows the rim and tappet B, as Brown's dotted
  circle and dotted tappet do.
- C's cover and its front hub carry the quadrant rotation cue. This fixes the
  ledger flaw "plain featureless front face".

Intersections: the only pair is the rim against stud0 at 0.0000, which is
working contact.

### 71
B's front plate is see-through, so the interior studs, the tappet and the
inside of the rim show.

Intersections: no pairs.

### 73
The spring rewrite that the stalled lane left half done is now finished and
consistent. `makeFlatBandGeometry` takes a depth range at each position along
the band, so a leaf can change depth along its length.

- **B (brass)** is a flat leaf clamped to D's face, behind A. Only its
  square-ended nib is deep enough to reach forward into A's back half.
- **C (grey)** is fixed. Its long pressing web is deep enough to reach back to
  the nib, and its thin end works in A's front half. B's leaf and clamp
  therefore pass under C (Brown: "B passes under the strong spring C").
- **The drive cycle.** C's straight web bears on the back of B's nib and
  presses it inward into the space before a tooth. The nib drives that tooth
  one pitch by its crest. It then escapes up the end of the web and springs
  back out. C's thin end rides over the tooth and drops in behind it as the
  stop.
- **The nib path.** It is designed from A's teeth: the nib clears the next
  tooth by 0.056 and spans the crest by at least 0.032 throughout the drive.
  C's web is its envelope, holding a constant 0.004 gap. The press is
  kinematic contact, not a force solution.
- **No rods at the spring tips.** The two old cylinders that stood out along
  the axis are gone. B ends in its square nib. C ends in a half-round of
  exactly its own width and depth, carried on C.
- **Slower playback.** One turn of D now plays in at least 10 s, where before
  the default loop was about 2 s. The one-tooth index lasts about 1 s on
  screen.
- **D** is a plain disc and carries the quadrant rotation cue.

Evidence:
- Default, oblique, rotated, rear and top views at the drive phase:
  `/dev/shm/x3b/v73/73-*.png`, tiled in `/dev/shm/x3b/v73.png`.
- Motion strips through press, index and escape: `/dev/shm/x3b/m73s.png`
  (face) and `/dev/shm/x3b/z73.png` (oblique).
- Fresh default view: `/dev/shm/x3b/src1/73-default.png`.

Intersections:
- The standard screen (0.01 spacing, 129 poses) finds only B against A at
  0.0004 (driving contact at the escape), C's end against A at 0.0000
  (seated) and C against its own end cap at 0.0000.
- A dedicated dense check (`/dev/shm/x3b/dense73.mjs`, 0.006 spacing) sampled
  150 phases through the event and 200 over the whole cycle. It covered every
  pair among A, B, C, C's end, B's clamp, D and the block:
  - B against C: none at any phase.
  - B against A: 0.00045 at most (the nib's crest contact during the escape).
  - C against A: 0.00001.
  - C's root is seated 0.045 deep in its clamp block. This is intended; the
    leaf is clamped in the block.

### 76
- Each of the driver's four spokes now carries one stud D, on the rim just
  above the spoke's upper edge, as Brown draws his one visible stud. The
  tappet is struck, and A counts one tooth, every quarter turn.
- The strike cycle has been solved again:
  - The dynamics study (`scripts/lib/jointed-tappet-dynamics-study.mjs`)
    tests every stud in `geometry.studCount`.
  - The bake (`scripts/bake-jointed-tappet-motion.mjs`) integrates one 6 s
    physical strike cycle, a quarter of the 24 s driver turn. The earlier
    single-stud bake integrated 7.2 s of a 24 s cycle. The cycle ends exactly
    at the next stud. After the count settles, the state blends to the exact
    rest pose over 0.25 s.
  - Convergence is unchanged: the three step sizes agree, and the smallest
    interpolated gap is -4.9e-8.
- `src/data/jointed-tappet-profile.js` was rebaked with `physicsPeriod` 6,
  `driverPeriod` 24, `studCount` 4 and a display `period` of 3.
  `jointed-tappet-motion.js` turns the driver by `driverPeriod`.
- Each strike event (about 2.4 s of physics) completes 2.6 s before the next
  stud arrives. The motion is unchanged from the single-stud cache; it now
  repeats four times per turn.

Evidence:
- Four strike cycles, zoomed out: `/dev/shm/x3b/m76s.png`.
- Fresh default view: `/dev/shm/x3b/src1/76-default.png`.

Intersections: the only pair is the coaxial seated dog stop pin at 0.0000.

### 94
The slotted radial plate is see-through, so the whole two-turn spiral groove
reads where Brown dots it. `frontOpacity < 1` still selects the old flat
transparency for studies. The MuJoCo physics is unchanged.

Evidence: `/dev/shm/x3b/src1/94-default.png` and
`/dev/shm/x3b/rv/94-{obl,rot,rear}.png`.

Intersections: the screen loads the authored non-production 94, whose pairs
are unchanged and belong to that model. Production 94 keeps its MuJoCo
evidence, because no geometry changed.

### 279
The lining pieces and taper gibs are see-through, so the crank throw shows
behind the box, as Brown dots it.

Evidence: `/dev/shm/x3b/src1/279-default.png` and `/dev/shm/x3b/rv/279-*`.

Intersections: no pairs.

### 281
The disk's body, groove lands and groove floor are see-through, so the
driving arm behind the disk shows, as Brown dots it.

Brown's dashed second pose of the lever is still not drawn. The disk's
role-based quadrant cue comes from `src/data/rotation-indicators.js`, which
another lane added; it composes with the see-through style.

Residual: the A-frame legs and the fulcrum brace behind the disk also show
through. They are real parts, but Brown does not dot them.

Evidence: `/dev/shm/x3b/src1/281-default.png` and `/dev/shm/x3b/rv/281-*`.

Intersections: no pairs.

## Validation

Test files:
- `tests/jointed-tappet.test.mjs`: updated for the four studs and the 3 s
  strike cycle.
- `tests/gravity-tumbler.test.mjs`: new symmetry test, updated area and
  contact time, source tolerance raised to 17 px.
- `tests/models.test.mjs`: the movement 73 block is rewritten for the new
  spring design, depth layers, nib-to-web clearance and timing.
- `tests/see-through-part.test.mjs` (new): the helper's style, its
  composition with the rotation cue, and the exact see-through parts per ID.
- `tests/open-rim-tappet.test.mjs`, `movement-063`, `movement-071`,
  `movement-279`, `movement-281`, `mujoco-variable-crank`,
  `rotation-indicator` and `source-presentation` were rerun.

Bake: `node scripts/bake-jointed-tappet-motion.mjs` (76). Its report
`artifacts/review/076-rebake-report.json` is gitignored.

No `docs/validation` report fingerprints the changed files.
