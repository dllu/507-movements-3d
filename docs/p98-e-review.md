# Pass 98, lane p98-e: crank handles flush with the lever's back face; 267 shoes; 280 grip and wheel cue

Reviewer: Claude Opus 5.5, lane p98-e. Date: 2026-09-28. No git writes.
Scratch, screens and captures are in `/dev/shm/p98/e/`.

User rules for this lane:
- "Generally we can make all the handles have the cylindrical portion be flush with the back side of the lever" (prompted by 133's kinked crank handle, `/dev/shm/p98/img/99.png`).
- Handles and pins never sit on part edges. Use unified turned handles. Use smooth geometry.
- 280: "the handle is slightly off" (`img/106.png`), and the blue wheel wants the quadrant cue.
- 267: the yellow parts need "greater surface area to be mated to the orange rim".

Interpretation: a grip stands out from one face of its lever. Its turned profile carries on through the lever as a straight shank, and the shank ends `HANDLE_BACK_RECESS` (0.005) inside the far ("back") face. The grip is then one turned piece, concentric with the lever's round end. It does not float, it does not stop partway into the lever, and its end disc is not coplanar with a lever face. Handles that Brown draws in front stay in front.

## Inventory

- **Screen.** `/dev/shm/p98/e/handle-seat.mjs` loads every production model. For each round mesh whose role reads handle, grip or knob, it finds the part that the grip's axis pierces, then reports:
  - the base's embed or gap against that part's near and far faces;
  - whether the grip passes through;
  - radius steps along the grip;
  - the part's outline distance from the axis.
- **Roles.** 280 role-matched meshes (handle, grip, knob, crank pin, hand crank) in 109 movements (`roles-all.txt`).
- **Round grips.** 57 round grip or knob meshes in 37 movements (`seat-before.json`, `seat-final.json`).
- **Crank and lever grips reviewed by eye.** There are 26 movements, excluding knobs on screws and spindles and bosses:
  - Grip on a lever face (18): 133, 190, 266, 281, 282, 283, 285, 358, 361, 366, 368, 370, 379, 380, 413, 417, 490 (on the wheel rim) and 506.
  - In-line grip on a lever end (6): 47, 52, 179 (two grips), 280, 453 and 467.
  - Hidden grips (2): 129 and 144, not rendered.
- **Before.** No crank grip was flush with the back face.
  - The turned-handle users (283, 358, 368, 370, 379, 380, 506, 190) stood 0.012 into the front face.
  - 281 and 285 stopped partway in or on the face (285's base was 0.001 in).
  - 282, 413 and 52 abutted the face with no embed.
  - 47's grip floated 0.004 beyond the bar's end.
- **Kinks and odd joints found:**
  - 361 and 366: plain cylinders on square-ended box arms, with the handle axis on the arm's end edge.
  - 266: a tapered plain cylinder starting at the eye's mid-plane.
  - 417 and 413: a rod plus a separate ellipsoid.
  - 285 and 490: faceted polyline lathes; 490's had two swellings.
  - 52: a six-segment flat-banded grip.
  - 179: the upright lever's 0.18 × 0.32 bar corners stood out through its r 0.17 grip, and the lifting handle ended in a plain cylinder.
  - 453: the 0.38-deep beam ran through an undrawn r 0.15 grip.
  - 280: the collar (r 0.105) butted askew on a 0.23 × 0.24 bar.
  - 467: the bar corners stood 0.002 out of the ferrule.
- **Captures.**
  - Before: `bsheet0–3.png` (per grip: default, +40/+20, −60/−20 and back views), `b133-tile.png`, `b179-tile.png`, `binline.png`, `b453-zz.png`, `t280.png`.
  - After: `asheet0–3.png` (the same views), and `dsheet0–3.png` (plate, default, and a rotated view at phase 0.4 for every changed ID).

## Shared helper (`turned-handle.js`, claimed)

- `turnedHandleGeometry` and `standardTurnedHandleGeometry` take `shank` (default 0). The default builds the old profile exactly.
- New: `HANDLE_BACK_RECESS = 0.005` and `handleShank(leverThickness, embed = HANDLE_FOOT_EMBED)`.
- New: `crankArmAcrossXGeometry`, the shared round-ended crank arm, turning about x.
- A recess of 0.002 still left 358's shank disc flagged coplanar at that model's scale, so it is 0.005.
- Unchanged users hash byte-identical against HEAD: 190 (clamps, p98-c), 393, and 502–505 and 507, which share files with 370 and 506.

## Per-ID changes

**Turned-handle users, given the shank (arm end already concentric; nothing new visible from the default view):**

| ID | Grip now reaches |
|---|---|
| 283 | through the 0.25 eye |
| 358 | through the 0.10 arm |
| 368 | through the 0.11 arm |
| 370 | through the 0.14 arm |
| 379, 380 | through the 0.11 bar |
| 506 | through the 0.15 crank |

**Crank grips rebuilt:**
- **361.** The Box arm became a flat round-ended arm (x 1.73–1.83; end radii 0.085 at the handle and 0.12 at the hub), concentric with the handle. The grip is a turned handle (h 0.30, bulb 0.08) with the shank. The arm now hangs down 0.95 as drawn (230 px against the 435 px hand wheel); it was 0.44 pointing up. The screens show no new contact.
- **366.** The same treatment: arm x 1.05–1.19, end radii 0.10 and 0.13. The turned handle has bulb 0.12 and keeps its tip at x 1.66.
- **417.** The Box arm became a round-ended arm, and the rod plus ellipsoid became one turned handle (h 0.56, bulb 0.10). The `crankKnob` block was removed.
- **266.** The tapered cylinder became a turned handle (h 0.32, bulb 0.095). Its foot is in the eye's outboard face and its shank is flush with the eye's inboard face.
- **285.** The faceted polyline became a standard turned handle (h 0.6, bulb 0.14), with the shank through the 0.16 bar.
- **413.** The stem plus yellow ellipsoid (0.82 long) became one turned handle 0.40 long, bulb 0.09 (Brown: 195 px against the flank's 120 px). The foot is in the flank's face (x −0.247) and the shank ends 0.005 short of x 0.
- **490.** The eight faceted two-swelling handles became standard turned handles (bulb 0.085). The foot is sunk 0.012 into the torus surface and the shank runs through the tube. The tips are unchanged.
- **281, 282.** These are rear cranks that Brown dashes. They are still plain cylinders, since Brown draws no grip, but now run through the arm's round end to 0.005 inside its front face. The rear ends are unchanged.

**In-line grips:**
- **179, lever.** A turned knob with an r 0.195 collar enclosing the bar corners (0.184). The bar stops 0.004 into the collar, and the knob spans the plate's handle point ±0.31.
- **179, lifting handle.** A turned knob standing out of the handle's end face, with an r 0.14 collar round its 0.128 corners. It points along the end's normal and reaches past the old grip centre. `engine-reverser-solids.test.mjs` was updated to match.
- **280.** The grip is now coaxial with the lower lever segment. Brown's grip leans about 4° off the lever, and that lean set the old collar askew (`img/106.png`). The grip is one turned profile with an r 0.17 ferrule sleeved 0.09 over the bar's end, enclosing its 0.165 corners.
- **280, wheel cue.** Its wheel, rim, barrel and hub take the quadrant cue in `rotation-indicators.js`. `rotation-indicator.test` passes.
- **453.** The undrawn beam grip was removed. Brown breaks the beam off plain.
- **47.** The grip is sleeved over the bar's round end instead of floating 0.004 beyond it. Its outer end is unchanged.
- **52.** The grip is one smooth spline-plus-dome profile, and the bar runs 0.01 into its foot.
- **467.** The ferrule goes from r 0.11 to 0.115, and the grip is one smooth spline-plus-dome profile (the old one ended in a blunt cone).

**267 shoes** (`friction-family-working-parts.js`):
- Each arm now runs on from its tip into a curved shoe as deep as the tip (0.17). The shoe's face lies on the circle inscribed in the rim's 768-sided bore. It runs 28° clockwise along the rim (carrier polar −18° to −46° from the pivot radial), and its far end is round.
- The shoe bears along that whole arc, where the old tip touched at one point.
- All of the shoe lies clockwise of the pivot radial, so the clockwise release clears it: 0.092 at the tip and 0.18 at the far end.
- Captures: `t267a.png` (default, +40°, and junction zooms).
- Earlier trials (T-shaped shoes spanning −3° to −40°) were rejected because they looked like anchors.

## Screens (`/dev/shm/p98/e/`)

Screens were run on HEAD's versions of these files and on the new ones, over the same 23 IDs.

- **Disconnected parts:** no new detached parts. The new lips are 47's grip sleeve and 280's ferrule. Both stand proud of the bar by design, like Brown's collar.
- **Coincident faces:** no new pairs, with the recess at 0.005.
- **Body intersections:** no handle pairs. 361's longer crank touches nothing.
- **Loop seams:** 0.
- **Handle seat screen:** every rebuilt crank grip now has its embed equal to the lever thickness minus 0.005.

## Tests

All pass:
- `movement-{179,266,267,280,281,282,283,285,358,361,366,368,370,379,380,413,417,453,467,490,506}`
- `engine-reverser-solids`, `friction-family-working-solids`, `rotation-indicator`, `see-through-part`, `p59-visual-fixes`, `dual-input-differential`
- `scriber-dynamometer-solids`, `epicyclic-503-504-contact`, `differential-thread-solids`
- `models.test.mjs` blocks for 47, 52, all-507 timing, all-507 construction and distinct layouts
- New: `tests/p98-handle-seating.test.mjs`, 13 checks: the helper, plus 12 grips whose axes pierce their arms and whose shanks end 0.005 inside the far face.

## Regenerated reports

| Report | How | Result |
|---|---|---|
| `368-372-contact-solids.json` | `POSES=33` | results identical |
| `260-266-275-thread-solids.json` | `POSES=33` | results identical |
| `503-504-contact-solids.json` | 33 poses | results identical |
| `506-507-gear-solids.json` | source hash only | the script reproduces the results exactly |

- The 179 reports were already stale against HEAD (historical), so they were left.
- `src/data/display-profiles.{json,js}` was regenerated for the changed IDs. Only 47, 52, 179, 266, 280, 361, 366, 417, 453, 467 and 490 changed: bounds everywhere, 280's fastestPart name, and 453's visible speed (0.636 against 0.623).

## Deferred

- **133** (`authored-gears-core.js`, p98-a). The grip hangs off the arm's square end: the arm stops at x 0.441 and the grip's axis is at 0.388. The grip's back disc is coplanar with the arm's back face (z 0.198). Needed:
  - end the arm in an arc concentric with the grip (`crankArmOutline`);
  - use `standardTurnedHandleGeometry({ height: 0.25 + HANDLE_FOOT_EMBED, bulbRadius: 0.085, shank: handleShank(0.105) })`, with the foot at z 0.303 − 0.012;
  - drop the separate sphere.
- **190** (`authored-clamps.js`, p98-c). Its turned handle stands 0.012 into the 0.14 arm. Pass `shank: handleShank(0.14)` to its `turnedHandleGeometry` call; the helper is already in place.
