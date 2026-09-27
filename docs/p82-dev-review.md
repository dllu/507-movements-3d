# Pass 82, lane p82-dev: 481, 483, 450, 451, 435

Reviewer: Claude Opus 5.5, lane p82-dev. Date: 2026-09-27.

The audit findings came from `/dev/shm/audit81/b/findings.json`. Before/after captures are in `/dev/shm/p82-dev/`:
- `final/NNN-default.png`, `final/NNN-oblique.png`
- `a481/`, `a483/`, `a45/`, `a435/` (rotated, hidden-part and close-up views)

Loop seams: `check-loop-seams --ids=435,450,451,481,483` found 0 seams and 0 pops.

## 481 Wet gas meter: pipe a now reaches the journal and case head

**How it works.** Gas comes in through pipe a, which passes through one of the drum's hollow journals and turns up above the water in the central well. The gas fills each compartment B in turn through its hooked mouth and turns the drum.

**What was wrong.** Pipe a entered from the *front* along the axis. The section (z = 0.48) cut that run away, so only a bent stub remained, floating 0.70 from the rear journal and the case head. The gas had no way in. The axle stubs sat outside the case (|z| 0.78–1.05) and never reached the journals, so the drum was carried by nothing.

**What changed** (`gas-meter-working-parts.js`, 481 branch):
- **Pipe a:** it now comes in from behind. It starts 0.27 outside the rear case head and passes through the head's bore, which is bored to the pipe (0.106 bore, 0.105 pipe). It then runs through the rear hollow journal (0.12 bore, 0.015 running clearance) along the axis, and turns up on a 0.20-radius bend to its mouth 0.06 above the water, inside the innermost hook.
- **Pipe size:** it grew from 0.055 to 0.105 outside radius, closer to Brown's oblong a.
- **Drum support:** the rear axle stub was removed. The drum's rear journal now rides on pipe a.
- **Cutaway comment:** updated to match.

**Captures:** `a481/tile.png`, `a481/tile2.png` (side view with the case hidden: pipe → head → journal → upturn), `final/481-default.png`.

**Intersections.**
- Before: no solid overlaps.
- After: no solid overlaps; only the stationary water passed by the turning walls ("fluid").
- Disconnected-parts screen: the pipe is no longer detached. The drum group sits 0.015 from pipe a, which is its journal running clearance.

**Test:** a new test in `gas-meter-working-solids.test.mjs` checks that pipe a is continuous from outside the rear head, through the head bore and the rear journal, along the axis, to a mouth above the water. The pipe/rear-head pair was added to the clearance screen.

**Proposed ledger (481)**
- assessment: reasonable
- visibleFlaws: (none)
- limits: The water is one stationary body that the turning walls pass through. Fill and discharge are an idealised quarter-cycle clock aligned to the gaps. Drum torque is prescribed. Pipe a's run outside the case ends as a plain stub, because Brown does not show the supply.

## 483 Dry gas meter: port ducts cored in the back wall

**What was wrong.** The four seat-port ducts ran back through a 0.1 back panel and crossed behind it at z −2.2 to −2.45. From behind, that read as a tangle of undrawn plumbing.

**What changed** (`authored-dry-gas-meters.js`):
- **Back wall:** it is now 0.50 thick (z −1.90 to −2.40), comparable to the 0.44 side walls. The floor, walls and roof were extended to match.
- **Passages:** the four ducts run in real passages cored inside the wall, built as z-slabs:
  - an entry skin with 8 duct entries;
  - a channel layer at z −2.06 for A-outer, A-inner and A′-outer, with A′-inner's entries through it;
  - a separator;
  - a second channel layer at z −2.24 for A′-inner, which crosses the others;
  - a back skin.
- **Duct liners:** the duct tubes are liners in 0.075 bores (0.07 outer radius). Their routing inside the case is unchanged (shelf → back wall, back wall → top edge of each board).
- **Inlet:** it is now a short stub from the wall's outer face, with a 0.10 bore through the wall.

**Captures:** `a483/tile.png`:
- the back is now a plain panel with only the inlet stub;
- ±60°, 155° and top views;
- `a483/tile2.png` shows the liners inside the wall with the wall hidden.

**Intersections.**
- Before: only leather/plate "deforming" (depth 0).
- After: the same. The ducts/back-panel pair passes the clearance test, and so do the duct-to-duct pairs.

**Test:** a new test checks that no duct extends behind the back wall's outer skin.

**Proposed ledger (483)**
- assessment: reasonable
- visibleFlaws: The left flag rod, which Brown does not draw, shows as a thin rod behind chamber A. The spindle's crank disc and eccentric are inferred. The short in-case duct runs from the seat ports to the back wall and from the wall to the board tops show under the shelf.
- limits: Plate forces from gas pressure are not solved, and the crank turns uniformly. The ducts, their passages cored in the thick back wall, the cored exhaust passage and the inlet are inferred. The bellows section is a rounded rectangle.

## 450 and 451 Force pumps: hinged clack flaps

**Plates.** All four valves are the same clack flap with a knob on top. Brown draws a flap tilted when open (450 suction, 451 delivery) and flat on its seat when shut (450 delivery, 451 suction). Both hinges are on the left.

**What was wrong.** Every check was a loose disc that lifted 0.16–0.17 with no hinge, stem or guide.

**What changed** (`force-pump-working-parts.js`):
- **Flaps:** all four checks are now flat plates on hinge pivots at the left edge. They use the p78 `clackHinge` and `addDome`, which are now exported from `lift-pump-working-parts.js` without any change in behaviour. Each flap has:
  - a bored lug;
  - a pin through two journals standing on the seat ring;
  - Brown's knob.
- **Motion:** each flap lies flat on its seat when shut, with zero gap. It turns up to 30° with the existing C2 open lobe (`geometry.maximumFlapAngle`).
- **Sizes:** radii are 0.44 and 0.43 for suction, 0.30 for 450's delivery and 0.31 for 451's delivery. Journal positions were chosen to fit inside each bore.
- **450 valve chamber:** it now stands full of water (a turned body inside its bore). Before, a pipe-sized water column ran through the flap.
- **Cutaway:** the 450 and 451 specs cut `/check-opening/`, which covers the flaps, knobs, pins, lugs and journals. The front journal lies wholly in front of the section and is dropped.

**Captures:**
- `a45/tile.png`: p0 and p0.5 for both pumps (suction open / delivery open).
- `a45/tile2.png`: close-ups of each flap open and shut, and 451's delivery flap seen from the front as Brown draws it.

**Intersections.**
- Before: the discs were "floating".
- After: seat/flap contact at depth 0 when shut, and flaps immersed in water ("fluid"); no solid overlaps. The disconnected-parts screen shows 0 detached. Its "short-of-pin" near-misses are pins passing near unrelated walls, and the pins bear in bored journals.

**Tests:**
- `force-pump-working-solids`: flap, knob and lug checked against seat, wall, pin, journals and piston through 65 poses; the pin checked against its journals.
- A new test checks that each flap lies flat on its seat when shut, that its rotation follows the open lobe, and that its journals lie on the hinge axis.
- `movement-450` and `movement-451` now assert pivot parents and flap angles instead of disc lifts.

**Proposed ledger (450)**
- assessment: reasonable
- visibleFlaws: (none)
- limits: Flap angles follow a prescribed C2 lobe (30° maximum), not a solved pressure balance. Water displacement is prescribed. Priming, leakage and seal forces are not modelled.

**Proposed ledger (451)**
- assessment: reasonable
- visibleFlaws: The default pose shows the upstroke (suction flap open). Brown's plate shows the downstroke (delivery flap open), which the model reaches at half cycle.
- limits: As for 450. The air cushion follows the prescribed isothermal law.

## 435 Warren turbine: undrawn foundation removed

**What was wrong.** An undrawn foundation ring (r 1.38–3.86, y −0.63 to −0.45) supported nothing. The guide rings hovered about 0.35 above it, and the shaft passed its bore with 0.19 clearance.

**Brown's plate.** It is a plan of the guides a, the wheel b and the sectioned shaft end, with no foundation.

**What changed** (`authored-warren-central-discharge-turbines.js`):
- **Foundation:** removed from the factory and from the blocks.
- **Guides:** the fixed guide assembly (rings, guide floor, vanes) stands as drawn.
- **Shaft:** shortened to a plain stub that ends 0.44 below the hub (y −0.95).
- **Text:** the mechanism description no longer mentions a foundation.

**Captures:** `a435/tile.png` (plan, side, oblique, underside): nothing floats, and the shaft ends cleanly. `final/435-default.png`.

**Intersections.** After: no solid overlaps. The disconnected-parts screen shows 0 detached (before: the foundation was "floating", 0.19).

**Tests:** `movement-435` asserts there is no foundation. `turbine-433-435-solids` was updated to drop the foundation target.

**Proposed ledger (435)**
- assessment: reasonable
- visibleFlaws: (none)
- limits: The fixed guides have no drawn mounting, because Brown's plan shows none. The shaft bearing is an ideal fixed axis. The flow sheets are prescribed illustrations.
