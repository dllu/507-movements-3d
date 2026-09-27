# Pass 85: new detached groups from the disconnected-parts screen (391, 492, 247, 271, 181, 182, 232, 213, 291, 500)

Reviewer: Claude Opus 5.5, fix lane p85. Date: 2026-09-27.

The screen (`scripts/screen-disconnected-parts.mjs`) was rerun per ID into `/dev/shm/p85/ID.json` (after: `ID-after.json`).
Captures are in `/dev/shm/p85/` (outside Git), made with the p84-d `shots.mjs` harness: `ID-tile.png` (default, zoom on
the gap, rotated zoom, plate) and `after-tile.png` (271, 232 and 500 after the fixes). Per-phase pair gaps came from a
scratch `pair.mjs` (48 or 40 phases).

A detached entry lists every component other than the largest, so its part list is often the whole sub-assembly on
the far side of the bridge. Several entries here are "new" only because an earlier pass changed which parts join the
group; the bridge pair and gap were already in the p74 baseline.

## Fixed (3)

### 271: the table stopped 0.172 short of the fulcrum post
- **Cause.** The lever, pawls and post formed one group, joined to the rest only through the pawl hooks. When the
  short pawl lifts on its return (phase 0.70), the group floated 0.143 clear. The real gap was the plank table: it ended
  at x −0.342, and the post's left face is at −0.170. That left a slot 0.172 wide through the whole depth, plainly visible
  in the default and rotated views (`271-tile2.png`). Brown runs the table's top and bottom edges into the post's left
  face.
- **Change** (`ratchet-bar-working-parts.js`). The plank now runs to the post's left face. The other option was to widen
  the post leftward, to Brown's 413–415 px edge. That was rejected because the bar's right end reaches x −0.23 in the
  in-view return, which would run it into a wider post.
- **After:** 0 detached (the gap was 0.143). The intersection screen shows only the cord on the bar end, as before.

### 232: the output wheel was not fast on its shaft
- **Cause.** The wheel body was bored r 0.18 on the r 0.105 output shaft. The two turn together, so this was a rigid
  0.075 annular gap. The wheel was held only by the retaining click until pass 81 removed the click (Brown draws none).
  After that it joined the rest only through pawl C's finger, which is intermittent: it was flagged 0.044 from the band
  at 2 of 6 phases.
- **Change** (`authored-intermittent-core.js`, the 232-only `parallelogramLiftAndDrawPawlRatchet`). The bore is now the
  shaft's own radius (0.105).
- **After:** 0 detached, and the wheel/shaft near-miss is gone. The intersection screen is clear.

### 500: slot between dial face and bezel
- **Cause.** The cutaway presentation seats the bezel torus (R 3.28, tube 0.17) at the dial's plane, so its inner edge is
  at r 3.11. The dial ring ended at r 3.08, leaving a persistent 0.03 annular slot. It showed as a dark hairline round the
  dial edge in the default view (`500-z.png`). The face-view gauge body joined the dial only across that slot.
- **Change** (`authored-diaphragm-pressure-gauges.js`). The dial ring's outer radius is now 3.12, running 0.01 under the
  bezel.
- **After:** 0 detached, and the hairline is gone (`after-tile.png`). The intersection screen is unchanged: only the known
  ball-joint and rod-eye pairs.

## Accepted (7)

### 391: Brown draws C's pivot free
- The C group floats 0.574 from the right guide casting. It was 0.604 in the p74 baseline, where p79 dismissed it as
  "pivot drawn without support".
- Pass 83 lowered the pivot and pass 82 moved the knob onto C, so the group's members changed. The group has no fixed
  support because Brown draws C's pivot, like spring d's anchor, with no frame (`391-tile.png`).
- C's pivot stud fills C's bore (0.060 on 0.064) and is carried by nothing, as drawn. No undrawn bracket was added.

### 492: intended release
- The gap is 0.22 at phase 0.535 only, after the tongue has swung out and the hook rises free on the tackle falls. The
  falls run off the plate.
- The same bridge and gap were judged an intended release in p77. The group now also lists the pass 83 strop, seizing
  and forged eye, which hang the hook from the block correctly (`492-tile.png`: engaged at 0–0.5 and 0.8, released at
  0.535–0.6).

### 247: no floating weight in view
- **The 18.0 "floating" entry** is the recycled weight on its hidden route. At phase 0.20 it is being lifted at the
  previous station, x = 40, y ≈ 19, far outside the fitted view and the 3× zoom-out.
- **The 0.79 near-miss** is the sea bottom, with the spent weight lying on it, 0.8 below the probe foot in Brown's pose.
  The bottom is separate scenery.
- **Views checked:** default and 3× zoom-out at phases 0.035, 0.1, 0.2, 0.26, 0.3, 0.33, 0.4 and 0.535
  (`247-tile.png`). The weight in view is always either seated on the catch or lying on the bottom; it never hangs in
  mid-air. The unmodelled carrying route is already recorded in the ledger limits.

### 213: intermittent pin drive
- The ring assembly (fixed stud, drum and split rim) joins the ratchet only through the face pin, as the ledger records.
- The 0.03 is the axial clearance of the ratchet's plane behind the ring, and it is the same at every phase.
- Over 40 phases the pin touches the rim at 0.0, 0.2–0.28, 0.6, 0.72–0.78 and 0.9 (gap ≤ 0.006). The screen's six
  samples miss all of these.
- No visible gap (`213-tile.png`).

### 291: free-balance running clearance
- The 0.020 roller-to-tooth clearance was set in p77 so that the balance is free except at unlocking and impulse.
- The arbors have no drawn frame. Unchanged since p77.

### 181 and 182: intermittent handle–catch contacts
- **Bridges:**
  - Upper tappet arm to lower handle tip, 0.0666, at 2 of 6 phases.
  - Lower finger to the diagonal catch, 0.0189.
- Both bridges and gaps are identical to the p74 baseline. The groups now also list the back-weight hinge pins, the
  fixed pivots and the weight rods. Pass 81 seated those rod eyes and made the fixed pins flush, so they now join their
  handles instead of floating separately.
- The fixed pivots have no drawn frame (pass 60 removed the undrawn supports). Each handle therefore reaches the rest
  only through its working contacts, which open during the cycle as intended (`181-tile.png`).

## Checks
- `node --test` on elastic-gauge-working-solids, movement-500, ratchet-bar-finite-contact, movement-271,
  lift-draw-pawl-232-solids, movement-232, authored-loader and source-presentation: 46 pass, 0 fail.
- `check-loop-seams --ids=181,182,213,232,247,271,291,391,492,500`: 0 seams, 0 pops, 0 errors.
- Disconnected-parts screen after the fixes: 271, 232 and 500 have 0 detached groups. The others are unchanged.
- No saved validation report fingerprints the three changed files.

## Proposed ledger changes
- **271** limits: append "The plank table runs to the fulcrum post's left face, as Brown draws it."
- **232** limits: append "The wheel is fast on its output shaft (bored to the shaft's radius)."
- **500** limits: append "The dial ring runs under the bezel's inner edge."
- **391, 492, 247, 213, 291, 181, 182**: no change.
