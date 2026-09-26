# Pass 64 — deep horology lane (298, 309, 314)

Captures are not in Git. They are in `/dev/shm/p64-deep-horology/`:

- `before/ID-default.png` and `after/ID-default.png`: the render beside the plate.
- 298: `b298/tile.png` (before) and `a298/tile2.png`, `a298/tile3.png` (after). These are close views of the loops
  from the front, back, below and the end, and four phases. `cl.png` plots the loop centrelines in three
  projections.
- 309: `cmp309.png` shows the B and A ends before, after and on the plate. `ov309-*.png` overlays the baked plate
  outlines and tooth tips on the plate. `a309/L.png` and `a309/R.png` show 8 phases.
- 314: `ov314-new*.png` overlays the part outlines on the plate. `blend314.png` and `blend314C.png` blend the
  render with the plate. `a314/phases.png`, `a314/cz.png` (the C region at 16 times) and `a314/rot.png` (±60°,
  top and back).

Intersection screens were run one at a time (`--spacing=0.01 --samples=129`). `check-loop-seams --ids=298,309,314`
found 0 seams.

## 298 geared verge (`authored-geared-balance-verge.js`)

**Plate.** Brown's two loops are narrow rings, each leaning with its top to the left. The loop axis runs about
0.34 px left per px of rise. They lean the same way.

**Cause of the old residual.** The working arcs were already mirror images through the vertical plane of the arbor.
One loop works behind the wheel's mid-plane and one in front. A mirror in that plane leaves the front view
unchanged, so the working arcs themselves allow the same lean. The mirror-image lean came only from the free wire,
which kept running along the helix. The front strand of one loop is the back strand of the other, so the visible
strands leaned opposite ways.

**Rebuild of the free wire.** The working helix and its contact law are unchanged, and the loop is not planar.

- **End view.** The loop is one smooth egg around the rod: an upright ellipse soldered at its foot under the
  arbor, standing just clear at the sides, with its top 0.41 above the axis.
- **The far end of the working arc** now stands 0.12 rad beyond the deepest contact.
- **Along the arbor, beyond the working arc,** the wire eases (over 0.5 rad) onto a surface that starts as the
  helix's own tangent plane.
  - The working-side strand spreads with the helix.
  - The other strand stays near the loop's station, bowing slightly the other way. This keeps the back strands
    off the other loop's working arc.
  - The surface narrows upward.
  - Above arbor-frame y −0.1 it is sheared left, so the loop's top stands Brown's lean left of its lowest point.
    No tooth contact goes above y −0.129.

**Results.**

- Both loops now lean like Brown's narrow rings, at every phase.
- The loops' centrelines stay at least 0.094 apart (the wire diameter is 0.07).
- The tightest bend is 0.038, above the wire radius.
- New test: both loops lean −0.25 to −0.45, and the loops clear each other.

**Intersections.** Clear before and after. Faces show only the existing zfightSameLook between the balance spokes.

**Remaining.**

- Each loop is about 0.4 long along the arbor, against Brown's 0.35. This is set by the helix pitch.
- Near release the rendered wire leaves the analytic contact point by up to 0.03, where the release bend is
  rounded. This was 0.034 before.

## 309 Mudge gravity (`authored-gravity-escapements.js`, rebaked `baked/gravity-escapement-plates.js`)

**Plate.**

- Brown's teeth stand at a phase of 129.4° + 12k about his wheel centre. His locked B tooth has its tip in notch b.
- The model locked at 135/45 (seven and a half pitches apart). Every tooth was therefore 5.6° off Brown's teeth.
- With the lock at 135°, the lifting face in the cocked frame starts at about (137, 198). Everything below it is
  swept by the lifting tooth. Adding Brown's level bottom and nib to the plate blank and baking again (experiment
  `ov309-exp2`) removed all of it.

**Redesign.**

- The lock stations are now 129° and 51°. They are mirror images and six and a half pitches apart, so the
  half-pitch step still leaves a fallen pallet's stop over a tooth space.
- The wheel's teeth now stand on Brown's teeth, and the locked B tooth sits in notch b.
- The lifting face now starts at (128, 192). With Brown's outline in the blank, the swept cut keeps his level bottom
  edge (y 206.5) from the corner to x ≈ 124–129.
- The blank's bottom now runs level to x 124 and then turns up into the lifting face.
- `lockStationSeparationTeeth` changes from 7.5 to 6.5. The test that pinned 7.5, and its right-tooth index (−7
  becomes −6), were rewritten.

**Still forced.** Brown's toe: his bottom continues to x 131 and drops into a small nib at about (145, 214.5).

- The cocking tooth comes from below the lifting face, and the fallen contact maps above the tip circle in the
  cocked frame. So material under the face is always in the tooth's path.
- A nib inside the tip circle would need the pallet to ratchet over the tooth, which a gravity pallet does not do.
- Blank experiment `ov309-exp1`, with the nib included: the bake cut the nib out and left a square pocket. This
  was replaced by the plain up-turn.

**Side effects.**

- A's lock moved 6° up the wheel with the mirror.
- Brown's drawing is not mirror-symmetric: his hook a sits near 39°, seven and a half pitches from his b. The model
  keeps mirror symmetry and matches b.

**Intersections and checks.**

- Clear before and after.
- Faces show zfight between each half-fork and its fork pin. HEAD has the same finding, so this pass did not
  cause it. The forks and pins were not changed.
- 310–312 bake entries are unchanged.

## 314 lever chronometer (`authored-lever-chronometers.js`)

### C length

- Brown's blade reaches about 1.70–1.74 from the staff: his tooth tip at (283, 145) meets its end. Its thick part
  ends at about r = 1.50.
- A new study swept the blade over the whole swing against the locked wheel at every phase (`feas314.mjs`). No
  phase clears 1.74 (the tried C angles run from −12° to +12°). 1.70 overlaps slightly. 1.65 clears only for phases
  0.87–0.93 of a pitch, and 1.60 for phases 0.82–1.0.
- The cause is that the lens C's end cuts inside the tip circle becomes longer than the gap between two locked teeth.
- On the forward swing, a longer C enters the tip circle upstream of the regular phase through A. For reach 1.6,
  the entry is 1.65° upstream.

**Redesign.**

- The wheel is set 1.9° upstream. Brown's free tips scatter about ±2° about the regular phase. The tooth at C's end
  is 2.3° upstream in his plate; A stays within his 6 px.
- The long advance becomes 0.871 pitch, so the B-locked phase is 0.95, inside the pass-back window. B moves about
  4 px.
- C reaches **1.60** (from 1.50). At the plate pose, C's end is at the waiting tooth's tip, as Brown draws it.
- Measured clearances outside the impulse:
  - C's end passes the waiting tooth by 0.0077 as it enters.
  - 0.0088 during the drop.
  - 0.0027 at slide-off.
  - 0.048 on the pass back.

### Speed overshoot

A freed wheel that starts from rest must travel further than C in the same time to reach it. So a smooth,
speed-matched catch is only possible if the wheel slows before the contact. C's equivalent speed falls through the
catch, which is what the old wheel did: it peaked at 1.73× and then slowed in mid-air.

**New law.**

- The free wheel only accelerates uniformly under the train. The acceleration is fixed by the drop.
- It strikes C (impact, slowing to C's speed) and rides C by exact contact.
- It slides off with continuous speed, keeps accelerating, and strikes B.
- On the return, B releases after C has passed back (half-phase 0.56). The wheel accelerates through the short
  0.129-pitch transfer and strikes A. The lever has turned far enough by then that A's face is in place.
- The landing times are now computed, not prescribed.
- The quintic laws, and their braking before contact, are gone.

**Test rewrites.**

- Catch: the wheel strikes C faster than C moves, and never slows during the drop.
- Speed jumps occur only at the three strikes, and each one slows the wheel.
- C's reach is now 1.60–1.68.

### Crescent

- The inner edge was the tooth-clearance envelope. It is now Brown's straight inner line from (283, 428) to
  (377, 333). A smooth maximum with the envelope applies only near B, where the tips come within reach.
- The outer arc passed through (360, 445). Brown's outer edge there is at y 416, which made the band about 30 px
  too fat. It is re-measured through (424, 328), (360, 416) and (289, 468).
- The band now matches Brown's even-width crescent (`blend314.png`).
- The swept cut samples adaptively (at most 0.003 of tooth travel), which removed serrations near B.
- Vertices microns apart are merged.

### Disc

Brown's disc is cut down on its left, toward the wheel.

- From a concave notch through (324, 40), (317, 56) and (320, 72), the edge runs on an arc 67 px about the staff
  down to C, which stands on the step back out to the rim.
- This is now modelled. The model previously drew a full disc with a small bite, which bulged left over the teeth.
- The 314 source-presentation note has been updated.

### Checks

**Intersections.**

- Before: wheel/crescent 0.0010 (seated lock), wheel/C 0.0000, banking pin/crescent coaxial.
- After: wheel/crescent 0.0001, wheel/C 0.0000.

**Faces.**

- The fine sweep had left 8 degenerate triangles in the crescent. They are now gone.
- A same-mesh, same-look coplanar overlap of 0.003 remains in the crescent. It is invisible.
- The existing back-bar pair remains.

**Still forced.**

- C is 1.60, not Brown's 1.70–1.74.
- The C blade continues inward to a collet on the staff. Brown draws only its outer part. This is forced: every
  point of C swings through the lever plane below the staff, so C cannot be mounted to the disc through that plane.
- Not changed, and not in the ledger: the back bars show through the wheel's windows. Brown draws no bars.

## Tests

The following pass (61 in all):

- `movement-298`
- `verge-crown-working-solids`
- `movement-309`
- `gravity-escapement-working-solids`
- `movement-310`, `movement-311`, `movement-312`
- `movement-314`
- `detached-chronometer-working`
- `source-presentation`
