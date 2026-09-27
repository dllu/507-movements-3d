# Pass 80, lane p80-3: confirmed disconnections in the water family (433, 442, 449, 450, 451, 459, 477)

Source: `/dev/shm/p79-triage/confirmed.json`. Screen: `node scripts/screen-disconnected-parts.mjs --ids=...` (before and after JSON in `/dev/shm/p80-3/`). Captures are in `/dev/shm/p80-3/after/` (default and oblique) and `/dev/shm/p80-3/shots/` (close-ups, rotated views and phases). The tiles are `t1.png` to `t7.png`.

Screen totals (detached groups, before → after):

| ID | Before | After |
|---|---|---|
| 433 | 1 | 0 |
| 442 | 14 | 0 |
| 449 | 1 | 0 |
| 450 | 7 | 2* |
| 451 | 5 | 2* |
| 459 | 3 | 1 (worm clearance, by design) |
| 477 | 1 | 0 |

\* The remaining 450 and 451 entries are the lifting poppet checks. They are free discs that rise off their seats as designed, and they are only listed at open phases. In 450 the screen also treats the barrel as fluid, because its role `fixed-force-pump-cylinder-above-water` ends in "-water". That produced the spurious 1.5–2.1 "floating" gaps. A temporary copy of the screen that treats the barrel as solid confirms that the only 450 residuals are the two lifted discs. That copy has been deleted.

## 433 Horizontal overshot wheel

**How it works.** The flume jet strikes the flat boards of a horizontal runner, which turns the vertical shaft in its conical top bearing.

**What was wrong.** The hub (r 0.48) sat inside the support ring's torus (inner edge 0.52), so the ring and all 16 boards (which started at r 0.54) were fastened to nothing. The gap was 0.04.

**Change** (`authored-horizontal-overshot-water-wheels.js`):
- The hub radius is 0.52, so it fills the ring.
- The boards start at r 0.52, so they butt on the hub.
- The jet, spray and board pitch are unchanged.

**Evidence.** `shots/433-hub-*.png` (t1).

**Screen and intersections.** Screen 1 → 0. Intersections are only the existing spray-sheet fluid overlaps. **Seams.** Clean.

## 442 Eisach pot wheel

**How it works.** The pots have inward mouths and ride between two rims on a rigid wheel. The current turns the wheel counter-clockwise. The pots fill at the bottom and empty into the raised trough at the top.

**What was wrong.**
- The rims (r 2.43, z ±0.73) passed outside the pots.
- The pot tips (half-length 0.62) stopped 0.11 short of the rim planes, so the pot ring floated.
- The spokes were 12 full-diameter bars. Bars 7–12 lay exactly on top of bars 1–6 (coincident duplicates), and they ended 0.0725 short of the pots.

**Change** (`authored-eisach-pot-wheels.js`):
- The rims run through the pot axes (r = 1.85 + 0.30 = 2.15).
- The pot half-length is 0.72, so each pointed end runs into the rim tube (tip radius 0.06 inside the 0.085 tube). This matches Brown's pots held between the rims.
- There are 12 radial spokes, one per pot, running from inside the hub into the rear rim.
- `rimRadius` is exported in the geometry.
- The pot water cell (±0.56) stays inside the longer pots.
- The front rim is carried by the pots, as in the plate. The spokes stay in the rear plane, and the trough still runs through the wheel clear of everything.

**Evidence.** `after/442-default.png`, `after/442-oblique.png`, `shots/442-tip-00.png`, `442-full-{00,25,50,75}.png` (fill, lift, pour, return).

**Screen and intersections.** Screen 14 → 0. There are no solid intersections. **Seams.** Clean.

## 449 Modern lift pump

**How it works.** On the upstroke the bucket lifts the water above it through the side port into the rising main and the upward delivery flap. The foot flap admits water below the bucket. On the downstroke the bucket flap passes water up through it.

**What was wrong.** The main (0.30 outside) passed a rectangular port in the barrel (half-height 0.34, about ±0.42 wide). That left an open ring round the pipe (0.031 at the top, about 0.1 at the sides). The pump leaked there, and the riser was joined only through water.

**Change** (`lift-pump-working-parts.js`):
- New export `roundPortedBarrel(inner, outer, low, high, portY, holeRadius, side)`. It is a finite barrel wall with a round side hole on a fine grid.
- 449 uses a hole of 0.27, which lies between the main's 0.24 bore and 0.30 outside, centred on the main's axis at the wall (y 1.487). The hole's staircase edge is therefore buried in the pipe wall, the pipe seals the port, and the bore opens straight into the barrel.
- 448 still uses `portedBarrel`, which is unchanged.

**Evidence.** `shots/449-port-{00,50}.png` and `449-portR-00.png` (t2).

**Screen and intersections.** Screen 1 → 0. The only intersections are the existing zero-depth seat contacts. **Seams.** Clean.

## 450 Force pump

**How it works.** A solid piston is used. On the upstroke the suction check lifts. On the downstroke the outlet check lifts, and the water goes out through the side port and the elbow to the delivery pipe.

**What was wrong.**
- The delivery elbow (0.29 outside) passed a larger square port (half-height 0.33), leaving a gap round it of 0.04 and more.
- The pipe also began at x −0.54, inside the 0.705 bore.
- The suction pipe stopped 0.025 below its check seat.

**Change** (`force-pump-working-parts.js`):
- The barrel is now `roundPortedBarrel` with a 0.26 hole, between the elbow's 0.235 bore and 0.29 outside.
- The elbow starts in the wall at x −0.71.
- The suction pipe (and its water column) rises to butt on the seat ring's underside. The taper is extrapolated.

**Evidence.** `shots/450-port-{00,50}.png` and `450-back-00.png` (t2).

**Screen and intersections.** Screen: see the note above; the remaining entries are the lifting discs. The only intersections are zero-depth seat contacts. **Seams.** Clean.

## 451 Force pump with air chamber

**How it works.** The solid piston forces water through the delivery check into the neck under the air vessel. The compressed air keeps the flow out of the side outlet (or the dip tube) steady.

**What was wrong.**
- The pump-to-chamber pipe stood 0.06 off an oversized square barrel port.
- The pipe ended open at y 0.40, 0.2 inside the neck's bore. The neck had no floor, so the whole air-chamber assembly was joined only through water.
- The side outlet began on the neck's axis, as a stub across the valve box.
- The dome's top opening (0.225) was wider than the dip tube (0.20), which left the air vessel open to the atmosphere round the tube.
- The suction pipe stopped 0.035 short of its seat.

**Change** (`force-pump-working-parts.js`):
- The barrel port is round, with a 0.245 hole. The pipe starts in the wall at pumpX − 0.71.
- The valve box has a floor ring (0.245–0.53, y 0.335–0.395), which the delivery pipe enters. The floor stays 0.005 under the chamber water's base, so there is no coplanar face.
- The neck's side port is round (0.205), and the outlet curve is trimmed to start at the neck wall. The rest of Brown's curve is unchanged.
- The dome's top opening is sized to the dip tube (inner 0.20).
- The suction pipe butts on the seat.

**Evidence.** `shots/451-port-*`, `451-neck-{00,50}.png`, `451-back-00.png` and `451-dome-00.png` (t3 and t7).

**Screen and intersections.** Screen 5 → 2. The two remaining entries are the lifted poppet discs. The only intersections are zero-depth seat contacts.

**Tests.** The chamber-volume and port tests pass. **Seams.** Clean.

## 459 Reciprocating well lift

**How it works.** The wind wheel turns the worm. The worm drives one star wheel at a time, and each star wheel has its rope pulley behind it. The rising bucket strikes the tappet, and through an arm the tappet shifts the step carrying the worm's lower end to the other wheel.

**What was wrong.**
- The central post ended in mid-air at y −0.63, inside the well. The tappet, the arm, and through them the step, worm and wind shaft were carried by nothing. The gap to the well and troughs was 2.2.
- The arm from the tappet ended in the 0.08 bore of the annular step, so it touched nothing (0.018).

**Change.**
- `authored-reciprocating-well-lifts.js`:
  - Brown draws the post running from the bottom line of the elevation up to the tappet block. It now stands on the well floor (y −3.67 to 0.825, at the same x, z and section).
  - The arm's slanted end is set back so its upper edge meets the step's underside without entering it.
- `well-scoop-gutter-parts.js`, 459 branch only:
  - The step is a solid disc (r 0.17, the same depth). The worm shaft's end rests on its top, and the arm meets its underside.

No stands, bars or feet were added.

**Evidence.**
- `shots/459-full-{00,25,50,75}.png`: right lift, exchange, left lift, return.
- `459-rotL-30.png` and `459-rotR-30.png`: the post stands on the floor.
- `459-step-{00,30}.png` (t4).

**Screen.** 3 → 1.

**Intersections.** Run at 0.02 spacing over 65 samples, because 0.01 runs out of memory on this 86-mesh model. The arm–step overlap of 0.016 is gone. What remains predates this pass: the 0.001 crank pin in the arm eye, and the rope ends at the bails.

**Seams.** Clean.

**Residual.**
- The two star-wheel/pulley axles and their journals have no carrier. Brown draws none, and pass 64 removed an undrawn bar. They connect to the rest only through the worm mesh (the designed 0.054 free-window clearance).
- The wind shaft's upper collar is likewise uncarried, as in the plate.

## 477 Diaphragm steam trap (Hoard & Wiggin)

**How it works.** While D is hot, its expanded liquid bows the diaphragm, and D's collar closes on the seat a a in inlet A. Condensate gathers in A on the seat. When D cools, it drops, the seat opens, and the water runs down D to the box floor and out through B.

**What was wrong.** The seat ring (top y 1.70) stood 0.08 below the cover's underside (y 1.78), so it was joined only through condensate.

**Changes.**
- `ejector-trap-working-parts.js`: the seat's slanted outer flank now continues up to the cover's bore edge (r 0.745 at y 1.78), so the seat is cast on at inlet A. The working cone and the 0.48 throat are unchanged.
  - A trial with the seat top 0.02 into the cover z-fought on the section plane. A trial with the pool coplanar with the seat top showed stripes. Both were rejected.
- `authored-diaphragm-steam-traps.js`: the condensate pool's base (`seatTop`) is 1.785, 0.005 above the seat's top. The bore water reaches it, so the water stays continuous.

**Evidence.** `shots/477-seat-{00,50}.png` and `477-full-{00,25,50,75}.png`: shut and filling, opening, draining, shut (t7).

**Screen and intersections.** Screen 1 → 0. Intersections are unchanged: stem × bore water (0.022 at the lift peak), plus the coaxial diaphragm contacts.

**Faces and seams.** No zfight remains between the casing and the seat. Seams are clean.

## Tests

`node --test` on:
- ejector-trap-working-solids
- force-pump-working-solids
- lift-pump-working-solids
- movement-433, movement-442, movement-449, movement-450, movement-451, movement-459, movement-477
- turbine-433-435-solids
- water-lifting-441-443-solids
- well-scoop-gutter-solids

All 110 pass, plus 20 on the rerun of 477. The one failure met along the way was the 451 floor ring overlapping the chamber water by 0.005, which is now fixed.

`check-loop-seams --ids=433,442,449,450,451,459,477`: 0 seams, 0 pops.
