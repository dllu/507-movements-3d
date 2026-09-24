# Lane m22-dashed-hidden: Brown's dashed hidden lines for 63 and 261

Pass-51 minor-residuals lane. Both rows were rated minor for one residual each. In both, a part
that Brown draws with his hidden-line convention was either shown as a solid strip (63) or cut off
at an occluding edge (261). This lane draws those parts as Brown does, as thin, dark, evenly
dashed ink outlines with no fill.

Method:
- Captures used a private non-watching Vite server (port 44351), restarted after each edit.
- Each ID has a before and after default view (`review-movement-source-views.mjs`), an 8-phase
  strip, and nearest-neighbour 1:1 crops of the dashes. For 63 there is also a 16-phase strip over
  event phases 0.62–0.98, which is where the old strip showed. All are in `/dev/shm/m22`, not in Git.
- Intersections were screened with `show-body-intersections.mjs ID --spacing=0.01 --samples=129`.
- The ledger was not edited.

## Shared helper: `src/simulation/hidden-ink-lines.js` (new; used only by 63 and 261)

`makeHiddenInkLine(points, options)` returns a `LineSegments` with a `LineDashedMaterial` in exact
ink (`toneMapped: false`, `fog: false`).

**Why not the 297 lines.** The 297 `hiddenLineMaterial` uses one-pixel WebGL lines. At the
viewer's pixel ratio of 2 they downsample to half-pixel grey hairlines, and the 297 capture shows
them faint and doubled. They do not read as Brown's ink.

**How this helper draws.**
- Each line is 6 parallel one-pixel strands, less than a device pixel apart. All strands share the
  centre line's dash distances, so their dashes stay in step on curves. Together they read as one
  dark stroke about 2 CSS px wide.
- A closed loop gets a whole number of dashes, and an open run starts and ends on a dash.
- A moving line can be anchored at one end, with dash fitting turned off (`fitDashes: false`),
  so its dashes never jump.
- They are lines, not meshes, so they add no bodies to the intersection screen.

## 63: the drop's leg is dashed; no solid strip in any phase (`authored-intermittent-core.js`, `snapActionStarCounter` only)

**Before.** The leg was the rearmost solid layer. While the drop is held up and the pawl has
fallen (about 0.75–0.92 of each event), a thin brass strip of the leg showed in the gap between
the pawl's lobe and the disk. At rest, the leg was simply hidden. Brown instead dashes it over the
pawl and the disk.

**Change.**
- **Undrawn zone.** The drop keeps its whole solid body, including the leg as its working edge for
  the pins, so collision and working geometry are unchanged. Its material now discards fragments
  inside an undrawn zone that is fixed to the pawl. The zone is the region right of the lobe's
  inner edge (source x = 717) and below the pawl's upper edge. It is sampled from the pawl outline
  and set 3 px inside it, so it closes under the pawl with no visible seam.
- **Why the zone rides with the pawl.** A zone fixed to the drop was tried first. When the pawl
  fell, it left a vertical cut in the drop above the arm and a dashed edge floating in the air.
  With the zone on the pawl, the drop shows solid exactly where it rises above the lobe. The leg
  below the lobe is never drawn solid.
- **Dashed outline.**
  - The drop's real edges inside the zone form one dashed run: the top edge from the lobe onward,
    the leg's right edge, its working edge round the tip, and its lower edge back to the arch.
  - The split line itself is not drawn.
  - The run lies just in front of the pawl (z = pawlFront + 0.004), so it is drawn over the pawl
    and the disk. The pins' ends, the pawl's nose and the star cover it where they pass in front.
  - Dashes are 0.06 long with 0.04 gaps (about 9 and 6 px).
  - The run is clipped to the same moving zone.
- **Unchanged.** Motion, the bake and its fingerprint (`dropOutline` is untouched), and framing
  (maxNdc 0.8729 before and after).

**Visual check.**
- **Rest pose.** The dashes run along the top of the lobe, straight down its right side onto the
  disk to the lower pin, and along the leg's lower and working edges. This is Brown's dashed
  pattern.
- **Phases 0.62–0.98.** In all 16 phases no solid brass shows between the lobe and the disk. The
  leg in the gap reads as a dashed outline, and the drop's top corner shows solid only above the
  lobe.
- **Test.** Every leg point below the drop's top corner stays at least 3 px inside the undrawn
  zone in all 361 baked poses (the measured minimum is 6.2 px).

**Intersections:** none → none.

**Proposed ledger (63).**
- (a) "m22 default, 8-phase and 16-phase (0.62–0.98) captures: the drop's leg is drawn as Brown's
  dashed hidden outline over the pawl and disk; the drop shows solid only where it rises above the
  lobe; no solid strip in any phase."
- (b) sampled-clear: "m22 screen (0.01, 129): no pairs."
- (c) assessment: **reasonable**.
  - visibleFlaws: "".
  - limits: "The leg is a solid working body for the pins but is not drawn inside a zone that rides
    with the pawl. Where the lifted leg lies in the open gap, it is still dashed, as hidden-line
    notation. Start pose is 7° of pin rotation from Brown's to show the drop at rest. The star is
    regular and held only by the pawl."

## 261: the drum and the drum-side strand of D are dashed over B (`authored-combination-drives.js`, 261 only)

**Before.** The drum and cord lie behind B for the reasons given in m8, m12 and m14. So the
drum-side strand of D ended at B's rim, where Brown carries it to his inner circle.

**Change.**
- **Drum circle.** A dashed circle at the drum's cord radius (0.22) lies on B's face. It is a child
  of the disk assembly, so it turns with B.
- **Strand continuation.** A dashed line runs from the dark rim's outer edge (radius
  0.83 + 0.065) to the drum tangent, on the pulley-to-drum strand's own line. It is recomputed
  every frame from the same configuration as the cord, and anchored at the tangent end so its
  dashes stay steady there. Under the rim torus it is hidden by depth, so the dashes emerge just
  inside the rim, where the solid cord disappears.
- **Depth.** Both lines are at z = 0.16, just in front of B's face (0.15), under the rim, hub,
  crank pin and link C. They are 2.4 px wide, with dashes about 7 px long and gaps about 4 px.
- **Hub.** B's front hub is reduced from radius 0.24 to Brown's 0.16 (his hub circle is about 0.19
  of B's radius). At 0.24 it covered the drum circle (0.22) and the tangent point. The hub carries
  no load and touches nothing.
- **Unchanged.** Motion, cord length and framing (maxNdc 0.8617 before and after).

**Visual check.**
- **Default view.** The blue strand ends at B's rim. Dashes then carry it across B's face to a
  dashed circle round the hub, as Brown carries D to his inner circle.
- **8 phases.** The dashes track the strand through the forward and reverse turn. Link C and the
  crank pin pass over them.

**Intersections:** unchanged. The screen finds the tied cord eye (0.0296) and the cord on the drum
(0.0007), both intended, plus the seated crank pin in B (coaxial, 0.0000).

**Proposed ledger (261).**
- (a) "m22 default and 8-phase captures: the drum-side strand of D continues from B's rim as a
  dashed hidden line to a dashed drum circle round Brown's small hub, following the strand as B
  turns."
- (b) sampled-clear: "m22 screen: only the tied cord eye (0.030), cord on drum (0.0007) and the
  seated crank pin."
- (c) assessment: **reasonable**.
  - visibleFlaws: "".
  - limits: "The drum and cord lie behind B (a strand in front would be cut by the crank pin every
    turn), so Brown's solid strand and inner circle are drawn as dashed hidden lines. The drum
    circle is 0.27 of B's radius against Brown's 0.47: a larger drum would change the take-up
    law. Disk timing and demonstration reset are prescribed."
  - If the lead counts the smaller drum circle as visible, keep the assessment **minor** with
    visibleFlaws: "The dashed drum circle is about half the size of Brown's inner circle."

## Files

- `src/simulation/hidden-ink-lines.js` (new; used only by 63 and 261)
- `src/simulation/authored-intermittent-core.js`: `snapActionStarCounter` (63) and one import line.
- `src/simulation/authored-combination-drives.js`: `combinationWeightDrive` (261) and one import
  line.
- `tests/movement-063.test.mjs`: new test, "dashes the drop leg over the pawl and disk and never
  draws it as a solid strip".
- `tests/movement-261.test.mjs`: new test, "dashes the hidden drum and drum-side strand of D over
  B as Brown carries them".

**Tests** (all pass):
- movement-063 (6/6)
- movement-261 (9/9)
- spatial-linkage-solids (3/3)
- the movement-63 block of models.test.mjs
- authored-loader and camera-resize (6/6)

No `docs/validation` report fingerprints these files. The 63 bake fingerprint is unchanged.

**Display profiles.** Neither ID's extent changed: the lines lie inside existing parts, and 261's
hub shrank inside B. A re-measure of 63 and 261 is optional and should be a no-op.
