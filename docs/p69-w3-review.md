# Pass 69, lane p69-w3: water close review of 461–468 and 475–478

Reviewer: Claude Opus 5.5 (lane p69-w3), 2026-09-26. Each ID was checked against `public/engravings/mm_NNN.png`,
its caption and its ledger row. Captures are outside Git in `/dev/shm/p69-w3/`:

- `rv0/` holds the before `ID-{default,oblique}.png` from `review-movement-source-views` (461's before is in
  `cap/before/`, phases 0, .25, .5, .75 in the flat and oblique views).
- `final/` holds the after `ID-{default,oblique}.png` for all twelve IDs.
- `cap/<letter><n>/` hold phase strips (at least four phases) and rotated views (±60°, top, back, oblique); the
  directories are named in each section.

Intersections were screened one ID at a time with `show-body-intersections --spacing=0.01 --samples=129`; fluid
pairs (water against its own vessel, parcels passing open flaps) are not listed. Every ID passes
`check-loop-seams` with score 0 and no mid-cycle pops (before: pops in 461 (after the first rewrite), 463, 465,
466, 467, 475, 476).

The shared stream helper `water-stream.js` is used for the new streams in 462, 465 and 478, and for the look of
461's poured streams (461 follows each poured particle on its own parabola, which the helper's fixed path cannot).

## 461 swinging gutters (`authored-swinging-gutter-pumps.js`; 461 branch removed from `well-scoop-gutter-parts.js`)

**How it works.** Brown's lattice hangs on a central axis. Six horizontal pipes each end in a square box on the
right and (all but the top) a tilted box under the left end. Six parallel diagonal pipes each rise at about 38°
from a left box, or for the lowest from under water, *behind* the horizontal above it, to the right box two rows
up. So the pipes form two interleaved serpentines: odd rows from the open pipe end under water to the open left
end of the top pipe (Brown's jet), and even rows from the scoop box at the right of the lowest row to the free
open top of the highest diagonal. Every box holds a one-way flap; swinging the lattice drives the water on one
compartment per half-swing.

**What was wrong.**
- User: the flaps did not fit (a 0.27 × 0.20 plate hanging in a 0.6-square box and 0.36-deep channel) and the water
  was not conserved: every even or odd slug grew and shrank together from a fixed anchor.
- The topology was wrong: one zigzag of short 17° risers joining each row to the next, not Brown's two serpentines
  of 38° diagonals spanning two rows; an undrawn A-frame stood under the axis.

**What changed.** The factory is rebuilt on Brown's lattice (58 px per unit about the axis circle at (237, 253)).
- Horizontals in a front pipe layer, diagonals in a back layer (they pass behind the horizontals as drawn); the
  eleven boxes span both. Each pipe is cut open along its front wall so the water and flaps show.
- Seated flaps: each flap is hinged on the upper wall of the pipe entering its box, spans the whole bore (less
  0.003) and the whole layer depth, closes against a seat rib on the lower wall and the layer's back plate, and its
  hinge boss turns in a pocket cut into the upper wall (with an outside knuckle). It opens only toward its box.
- Conserved water: each serpentine is a two-phase shift register of three equal parcels (bore × 0.7). On its
  exchange half-swing the top parcel pours out, the middle parcel advances and the dipping scoop takes one in; on
  the other half the rest advance and the scooped parcel runs up to the first flap. Pipe water + poured − scooped
  is constant (tested at 1200 poses); parcels never cross a closed flap; every horizontal is run while it slopes
  down to its box. The right scoop slot fills only while it is under the pool.
- Water is drawn per fixed compartment, so every mesh changes continuously and the picture repeats each cycle.
- The top jet follows each poured particle on its own parabola, thins as it accelerates and breaks into Brown's
  spray within the plate; the free diagonal throws its water clear over the right boxes into the pool (checked
  against every box).
- Supports: Brown's two dotted posts under the axis with a short cross-head; the crossed braces are part of the
  swinging lattice. The A-frame is gone.

Captures: `final/461-default.png`, `cap/d1/` (eight phases, both streams, oblique, ±60°, top, back), `cap/c1–c3/`
(flaps and parcels at the boxes, closed and open).

- **Intersections:** before, sampled clear; after, no solid pairs (flaps, pins, braces, axle, posts, walls).
- **Faces:** clean except 2 same-look coplanar faces where the posts meet the cross-head (a joint).
- **Tests:** `movement-461.test.mjs` rewritten for the lattice, seats, conservation, compartments and streams; the
  461 case in `well-scoop-gutter-solids.test.mjs` rewritten for the two-layer walls.

## 462 chain pump (`authored-chain-pumps.js`)

**How it works.** Disks on an endless chain lift the water up the riser; it spills from the spout head at the top.

**What was wrong.** The lifted water went nowhere: a long trough held a static sheet, and the riser column stopped
below the spout floor.

**What changed.** The spout is cut to Brown's length, with a closed end round the riser. The riser stands full to
the spout's water surface. A steady sheet (helper stream, streaks moving) runs to the lip and pours on to Brown's
flume below and left, which is now modelled (open timber trough, closed at its right end). The flume's sheet runs
off its open left end back into the pool, so what is lifted arrives. The pool and fit bounds extend left to catch
it (Brown's plate runs further left than the old crop). Captures: `final/462-*.png`.

## 463 self-acting weir (`authored-self-acting-weirs.js`, `chain-weir-working-parts.js`)

**What was wrong.** The closed lower leaf stood 0.05 above the floor (and 0.10 above the bed plate): the closed
weir leaked under it. The scour flow switched on (2.6% pop).

**What changed.** The bed's top is now the channel floor, and the lower leaf stands on it when closed. Its pivot is
moved to its upstream face, so turned back both bottom corners lift off the bed and none digs in (tested). The scour
passage opens from nothing to about 0.05 under the leaf; its sheet fills from nothing. Captures: `cap/f2/`.

## 464 Hero's fountain (`authored-herons-fountains.js`)

**What was wrong.** While running, the lower vessel gained 0.32 but the bowl lost only 0.24; the difference came
from an external pour that the presentation hides (Brown does not draw it), so water appeared from nowhere.

**What changed.** The drain carries exactly the jet's return (0.24): the upper basin level, the shared air volume
and pressure stay constant, and no pour is needed. The demonstration reset after each run (the bowl refilled and
the lower vessel emptied over 2.5 s with no flow drawn) remains. Captures: `cap/g1/`.

## 465 balance pumps (`authored-balance-pumps.js`)

**What was wrong.** The joined delivery ended in a stub under the deck, so the pumps delivered nowhere. The pipe
water switched on and off with the checks (2.3% pop, a colour signal).

**What changed.** The suction and delivery pipes stand full. Just above the Y, the delivery bends back under the
deck and discharges down between the pumps into the well (Brown does not draw where the delivery main goes; the
demonstration returns the water to the well). Captures: `cap/h2/`.

## 466 hydrostatic press (`authored-hydrostatic-presses.js`)

**What was wrong.** The cistern level never changed as the ram rose, and the ram was let down by a relief valve the
presentation hides, so water vanished and reappeared.

**What changed.** The cistern level falls by exactly the water pumped under the ram and recovers as the ram is let
down. The let-down is through a screw-down release valve on the pressure pipe inside the cistern; its T handle
stands above the water, like Brown's T beside the weighted valve, and lifts while it is open. The inlet passage
stands full (no pop). Captures: `final/466-default.png`.

## 467 Robertson's jack (`authored-robertson-jacks.js`)

Base water plus cylinder water is constant (checked). The return passage water switched on with the thumb-screw
(2.1% pop); it now stands full, and the screw's retreat shows the return.

## 468 flexible water main

No water is drawn. The ball (0.40) turns in its socket (0.41) with 0.01 clearance; the joint is sound. No change.

## 475 bilge ejector, 476 steam siphon pump (`ejector-trap-working-parts.js`)

The water rises through B, D and C and falls back when the steam is shut off; the inventory follows the level. The
empty columns now collapse to flat rings instead of switching on (1.2% pop at the seam), and the discharge at C
fades as it dwindles (0.5% pop in 476). Captures: `cap/k1/`.

## 477 Hoard & Wiggin trap (`authored-diaphragm-steam-traps.js`)

**What was wrong.** The trap passes water of condensation, but no water was drawn at all.

**What changed.** Condensate gathers in A on the shut seat (the coil feeds A at the mean discharge rate, so the level
rises while the seat is shut and falls while it drains, closing every cycle). When D has cooled and dropped, the
water runs through the seat gap, down the outside of D and its flange, across the floor and out through B. The
film and the water in B fade with the flow. All are half-lathes behind the section plane. Captures: `cap/l2/`,
`cap/l3/`.

## 478 Ray's trap (`authored-expansion-steam-traps.js`)

**What was wrong.** The outlet column's opacity pulsed with the flow (a colour signal), with no water leaving A.

**What changed.** While the contracted pipe leaves valve a open, a helper stream runs from A's end through the gap,
falls to the bottom of sphere C and down its outlet, thinning and fading as the expanding pipe shuts the gap. The
old column is hidden. Captures: `cap/m2/`, `cap/m3/`.

## Intersections and faces (after)

| ID | Solid pairs (after) | Before (ledger) |
|----|--------------------|-----------------|
| 461 | none | sampled clear |
| 462 | none | 0.0398 chain × cross-shaft |
| 463 | none (spacing 0.02; 0.01 exhausts the worker heap on the head-water volume) | 0.0174 coaxial |
| 464 | none | sampled clear |
| 465 | operator figure joints (0.036–0.117, unchanged); seated check disks 0.0000 | sampled clear |
| 466 | seated check disks 0.0000 | 0.0437 seated check disks |
| 467 | seated screw tip and inlet disk 0.0000 | 0.0000 seated |
| 468 | not re-screened (unchanged) | hidden crossing only |
| 475, 476 | none | sampled clear |
| 477 | diaphragm on its reaction cap 0.0000 | 0.001 clamped seat |
| 478 | support B and clamp round pipe A 0.080/0.030, packing ring × lever pad 0.024 and × screw b 0.006 (all unchanged, not in the changed water parts); pipe end on valve a 0.0000 | 0.1194 rim × plunger rod |

Faces: the new water bodies and parts add no inward, shading, mixed or z-fighting faces. 462's flume floor was
shortened between its sides and end so no faces coincide; the remaining 462 z-fights (pocket rims × spokes) and the
other IDs' findings are unchanged. 475's collapsed D water reads as degenerate at pose 0 (it is empty there).

## Proposed ledger text

- **461** minor. visibleFlaws: "The even serpentine's pour from the free diagonal arcs over the right boxes into the pool; Brown draws only the top jet." limits: "Brown's two-serpentine lattice with seated flaps; water is a prescribed two-phase shift register of equal parcels (conserved, tested), not solved inertial flow; parcels keep the bore section through the boxes; pipes cut open along their front walls; the posts' cross-head carrying the axle is inferred."
- **462** reasonable. visibleFlaws: "". limits: "One cutaway on the camera plane; the delivery sheet, pour and flume run steadily at the ideal lift rate and return to the pool off the flume's open end; shafts end as plain stubs."
- **463** reasonable. visibleFlaws: "". limits: "Head water scheduled; overflow follows a weir law; the lower leaf's pivot sits on its upstream face so it seats on the bed closed and lifts off it turned back; the scour passage is about 0.05 deep."
- **464** minor. visibleFlaws: "After each run the bowl refills and the lower vessel empties over 2.5 s with no flow drawn (demonstration reset)." limits: "Cut-open section; while running, drain equals jet so basin level and air pressure hold; the jet is a shaped column and crown."
- **465** reasonable. visibleFlaws: "". limits: "Vessels are whole exteriors, as Brown draws them; the joined delivery (undrawn beyond the Y) discharges back into the well; pipes stand full."
- **466** reasonable. visibleFlaws: "". limits: "One cutaway on the camera plane; cistern level conserves the pumped water; the ram is let down through an inferred screw-down release valve on the pressure pipe inside the cistern."
- **467** reasonable. visibleFlaws: "". limits: unchanged, plus "base plus cylinder water constant; return passage stands full."
- **468** reasonable. visibleFlaws: "". limits: "Plan hatching not drawn; no water drawn in the mains."
- **475** reasonable. visibleFlaws: "". limits: "The overflow is a shaped sheet; the level is a prescribed start–run–stop history."
- **476** reasonable. visibleFlaws: "". limits: "Water inside the opaque fork is not shown; the discharge from C fades with the scheduled flow."
- **477** reasonable. visibleFlaws: "". limits: "One cutaway on the camera plane; condensate gathers in A at the mean discharge rate and drains over D and out of B; heat transfer and flow are prescribed."
- **478** reasonable. visibleFlaws: "". limits: "One cutaway on the camera plane; the condensate stream through C thins with the prescribed gap flow; pipe A's water is hidden inside it."
