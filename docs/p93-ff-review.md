# Pass 93, lane p93-ff: fixes from the 426–507 audit

Reviewer: Claude Opus 5.5, lane p93-ff. Date: 2026-09-28. Source audit: `docs/p93-audit-426-507.md`.

Scratch files and captures are in `/dev/shm/p93/ff/`, outside Git. Each `ID/a1.png` or `ID/a2.png` sheet puts the plate first, followed by the model views. The dev server ran on port 46951 using `shots.mjs`.

## Claims

The lane claimed these files under `/dev/shm/p93/claims`:
- `authored-warren-central-discharge-turbines`, `-persian-irrigation-wheels`, `-eisach-pot-wheels`, `-cary-rotary-pumps`, `-chain-pumps`, `-balance-pumps`, `-helical-current-rotors`, `-pivoted-sail-windmills`, `-common-paddle-wheels`, `-feathering-paddle-wheels`, `-capstans`, `-entwistle-gearing`, `-siphon-pressure-gauges`, `-bourdon-pressure-gauges`, `-diaphragm-pressure-gauges`, `-mercurial-barometers`, `-epicyclic-trains`
- `wind-rotor-working-parts`, `marine-rotor-working-parts`, `capstan-pawl-contact`, `capstan-pawl-profile`, `capstan-finite-parts`, `rotary-pump-contact`, `fountain-balance-working-parts`, `epicyclic-family-corrections`

## Shared helpers: siblings unchanged

`/dev/shm/p93/ff/hash.mjs` hashes every mesh's attributes, index, world matrix and material at phases 0, 0.37 and 0.71, loading each model the way the browser does.

| Helper | Siblings checked | Result |
|---|---|---|
| `wind-rotor-working-parts.js` | 485 | `dec3dcebe539ceb1`, same before and after |
| `marine-rotor-working-parts.js` | 488 | `d5a21b965d3ecdf7` matches a copy built with the HEAD helper |
| `authored-epicyclic-trains.js` and `epicyclic-family-corrections.js` | 503, 505, 506, 507 | All four hashes unchanged (`2e6ed834…`, `0c9f725a…`, `d4b6c8ad…`, `cb25888d…`) |
| `capstan-pawl-profile.js` | — | Regenerated with `scripts/generate-capstan-pawl-contact.mjs` after the pivot moved; byte-identical, because the table is rotation-invariant |

## 426, 427, 429: steam normals (verified; `crease-normals.js` not touched)

**Captures.** `steam/sheet-426.png`, `sheet-427.png` and `sheet-429.png` show phases 0.1, 0.33, 0.66 and 0.8 beside the plate; `steam/rot.png` shows rotated views.
- The steam now fills each crescent as a smooth translucent body.
- The black polygons and faceted fans are gone. Compare `/dev/shm/p93/f/z/f1/m429.png` from before.

**Test.** New case in `tests/movement-426.test.mjs`: "loaded as the browser does, the steam draws the normals it computes each frame".
- It loads 426 through `loadMovementModel`, so the presentation pass runs.
- It steps to phase 0.3 and then 0.66.
- It checks that every steam normal matches a direct factory model's own normals to within 1e-6, and that more than 50 cap triangles have |nz| = 1.
- With HEAD's `crease-normals.js` in a scratch copy, the test fails (`steam-in-left-eduction-channel normal 144`). With the fix, it passes.

## 484 (high): helix handedness, blade size, standards

**Change.**
- `helixHandedness` is now −1, a left-handed winding. The front crossing now runs "/" down-left from the right-hand lobe, and the hidden crossing runs "\\", as on the plate.
- The lobes are unchanged: high at both drum ends and low at midspan, matching Brown's pose at t = 0.
- The shaft now turns in +X, the physically consistent sign for this winding. The descriptive text was updated to match.
- Blade outer radius 1.34 → 1.54, about 2.65 drum radii as measured on the plate. The drum is 3.6 long, about 6.2 radii.
- The standards are now Brown's plain upright planks, running from his ground line (y −2.08) to just above the drum. Each is one bored block the shaft passes straight through.
- The undrawn bearing rings and shoulders are removed. The hidden base is detached from the scene.
- Camera bounds were refit.

**Captures.** `484/a1.png` (plate, default, phase 0.25, right) and `484/a2.png` (left, top, back).

**Tests.**
- `movement-484.test.mjs` asserts handedness −1, a counterclockwise sense and +FULL_TURN per cycle. The camera-fit check now uses precise bounds.
- `wind-rotor-working-interfaces.test.mjs` checks shaft and blade against the standards.
- 485 and `models.test.mjs` pass.

**Screens.** Body intersections clear. Detached parts 0 (near-misses 6 → 2). Coincident faces: two contact leads remain on drum and end collar (contrast 0.22, area 0.03), as before.

## 486 (medium): sails, arms, hinges

**Change.**
- Each arm is one flat bar (0.15 × 0.08) ending in a 0.26 square bracket that carries the pivot. The arms were round rods.
- The sails are 1.62 long, up from 1.28. This is 0.94 of the pivot radius, where Brown's are about 1.05.
  - An analytic sweep (`/dev/shm/p93/ff/sail486.mjs`) shows the closest neighbour clearance through the official flip schedule, at phase 0.75. Board centre lines are 0.12 apart at 1.60 long, 0.07 at 1.65 and touching at 1.75.
  - 1.62 therefore leaves about 0.035 of clearance between faces. Brown's length would make adjacent sails collide under the site's flip timing.
- The bulky orange hinge sleeves are replaced by the sail's own bored stile (r 0.075, sail colour) on a slim pin (r 0.05). The pin is seated half into the bracket, with its head just below the stile top.

**Disagreement.** The ring Brown draws through the sail pivots was deliberately left unmodelled, and I agree with that.
- It is drawn as a single thin line, where Brown draws every structural bar as a double line.
- The current presentation already records it as notation for the sail track.

**Captures.** `486/a1.png` (plate, default, phase 0.3, oblique) and `486/a2.png` (low side view, zoom on a bracket).

**Tests.** `movement-486` and `wind-rotor-working-interfaces` pass, including the sail-against-sail and pin/sleeve clearance cases.

**Screens.** Detached 6 → 0. Coincident faces 0. Body intersections clear.

## 487 (low, p90 carry-over): arms through the rim

**Change** (`marine-rotor-working-parts.js`).
- Every arm now runs on through the rim to 11.1 of the official 13-unit radius.
- Each float is a board bolted alongside its arm: offset half a thickness, reaching in under the rim to 7.25, as on the plate.
- The float boards lie between the two wheel frames. Their ends stop inside the rims' thickness (z ±0.60), so Brown's near rim runs unbroken across them.
- The float's origin stays at the working face's centre, which the hydrodynamics use.

**Captures.** `487/a1.png` and `487/a2.png`.

**Tests.** 487 (new case "arms run on through the rim…") and 488 pass.

**Screens.** All clear.

## 489 (low, p90 carry-over): bucket length

**Change.** Buckets are 11 source units long (2.2), up from 8. That is 0.78 of ring d's diameter, as on the plate. The physical bucket height was scaled to match.

**Clearance.** Vertically aligned pivots are 3.39 apart, so the buckets clear. The `spatial-linkage-solids` crank test passes, and body intersections are clear.

**Captures.** `489/a1.png` and `489/a2.png`.

## 491 (medium): pawl seat

**Finding checked.** The nose was already seated in the root at its own radius: 3.0° from the face at r 1.227, clear by 0.015.
- The pawl rides the inner edge of the crown teeth, at r 1.12–1.21 of a 1.15–1.45 ring.
- The pivot sat at the front (azimuth 90°), so the seated nose met a face 18° off the line of sight. The face's outer edge then projected 0.09 beyond the nose, which reads as a quarter pitch short.
- This is a parallax effect, but it is a visible flaw in the default view.

**Change.**
- `capstanPawlDimensions.pivotAzimuth` = π/2 + π/12. The seated nose now meets its radial face at azimuth 86.7°, within about 2° of the presentation camera (88.9°), so the face shows nearly edge-on.
- The contact table is unchanged: regenerated and byte-identical.
- **Residual:** the pivot boss now sits 0.30 left of the collar's centre line, where Brown draws it at the centre.

**Captures.** `491/a1.png` (default, nose zoom at t = 0, right view) and `491/a2.png` (end of cycle, seated again).

**Tests.** `capstan-491-finite.test.mjs` now asserts the pivot position and a seated-nose azimuth between 84° and 90°. `movement-491` passes.

## 495 (medium): bevels and carrier

**Disagreement.** "Back face equal to the tip circle" cannot be built for three equal meshing miter gears.
- A tip-radius back disc on A at the heel plane would take in B's teeth near the mesh. For example, B's tooth tip at (1.22, 1.15, 0.40) lies inside such a disc on A.
- The flat, toothed back is what a real flat-backed bevel shows. It is also consistent with Brown's section, where the cut passes through the teeth.
- The short-faced flat-ended teeth are therefore kept.

**Change** (`authored-entwistle-gearing.js`).
- Each wheel's boss now starts at its toe (axial 0.80) instead of running in to 0.19 from the apex.
- That frees the space between the three toes for Brown's carrier block.
- The block is now 1.0 along D, 1.37 tall and 1.0 deep, where it was a 0.40 × 0.28 collar. That is 0.37 of B's tip diameter wide and 0.54 tall, as drawn, and it keeps 0.30 clear of each toe.

**Captures.** `495/a1.png` (after) and `495/b-z.png` / `495/b-c2.png` (before).

**Report.** `docs/validation/412-495-gear-solids.json` was regenerated with `scripts/review-capstan-entwistle-solids.mjs` (hash change only).

**Tests.** `capstan-entwistle-solids` and `movement-495` pass.

**Screens.** Body intersections clear. The one lip and one coincident lead (left standard bearing) are unchanged from before.

## 441 (medium): trip lug

**Change.**
- The black shoe held out in front on a rod is replaced by one flat tab welded flush to the bucket's side, in the bucket's colour and mid-plane.
- Its outer edge is the same capsule shoe the trip contact uses. Its inner edge is buried in the tapered wall, and above the wall it runs into the rolled rim.
- The stationary pin now reaches back from its arm to 0.04 behind the bucket plane, so it meets the tab.
- The trip kinematics are unchanged.

**Captures.** `441/a1.png` (default and oblique) and `441/a2.png` (trip sequence at phases 0.05–0.2).

**Tests.** `movement-441` passes.

**Screens.** Body intersections clear through the trip. Detached 0. There are 6 new benign rigid near-miss leads: tab to bucket bottom disc, gap 0.025.

## 442 (medium): trough

**Change.**
- The trough is one U-section extrusion: floor 0.10 thick, and walls 0.04 thick standing 0.22 above the floor.
- The raised water is 0.13 deep, about 60% up the walls. Its sides and bottom run 0.01 into the wood, so no face is shared.
- The pots' pour lands on the new water surface.

**Captures.** `442/a1.png`.

**Tests.** `movement-442` passes.

**Screens.** Coincident faces 0. Detached 0.

## 456 (medium): delivery pipe H

**Change** (`rotary-pump-contact.js`).
- H leaves port M, turns and runs round the casing hard against its eccentric outer face (merged 0.02, like Brown's cast passage).
- It then rises straight up the right side into the goose-neck and spout. It no longer loops down in an S below the casing.

**Captures.** `456/a1.png` (default, right, back) and `456/a2.png` (the elbow at M).

**Tests.** `movement-456` and `rotary-pump-455-456-solids` pass.

**Screens.** Clear. The existing cam/piston lead is unchanged.

## 462 (medium): delivery onto the bank

**Change.**
- The bank is now one solid from the pool floor to 0.01 above the spout floor's underside, so the open end of the spout rests on it.
- The water spills over the lip, drops about 0.1 onto the bank and runs away left over it. None of it returns to the pool.
- The return stream, the lower open flume box and its buried end wall (the old `receiving-flume-under-spout-lip` box) are deleted.
- The bank's left face stands 0.05 past the pool's side face, so no face is shared.

**Captures.** `462/a1.png`.

**Tests.** `movement-462` passes.

**Screens.** Detached 1 → 0. Coincident faces: one lead of area 1.7e-5. Body intersections: the 0.0398 solid lead is the same at HEAD.

**Residual.** The bank and its water end at the model's left edge, where Brown crops the land.

## 465 (medium): beam pins

**Finding checked.** The pins were already on the beam's axis, at local y 0. The edge ratio came from the pin (Ø 0.144) being as deep as the 0.14 bar, so the pin filled the bar edge to edge and the pitman eyes overhung it.

**Change** (`fountain-balance-working-parts.js`). The beam extrusion now has round bosses (r 0.14) concentric with both pitman pins, like its central boss.

**Captures.** `465/a1.png`.

**Tests.** 465 tests pass.

**Screens.** The 5 detached leads (check-disk near-misses and similar) and the body-intersection leads (operator figure and reservoir water) are unchanged from before.

## 435 (low, p90 carry-over): water tabs

**Change.** Each guide-passage sheet now starts at the guide ring's outer edge; it began 0.33 outside, which stood 16 tabs of water off the ring.

**Captures.** `435/a1.png`.

**Tests.** `movement-435` passes.

## 499 (medium): feed pipe, tube eyes, dial colour

**Change.**
- **Feed.** The pressure feed now runs up behind the dial plate at z −0.63. It turns forward through a new 0.13 bore in the plate at C into the clamp.
  - The case back moved 0.26 deeper to make room.
  - The socket and collar sit below the case, under the feed.
- **Eyes.** Each free tube end carries a round eye (r 0.085, 0.008 proud of both tube faces) concentric with its link pin.
- **Colour.** The dial plate is light ivory (#ece4d1) and the graduated band is Brown's ivory scale colour (#e6dcc3). Both were the page colour #f3f0e9, which read as a hole.

**Captures.** `499/a1.png` (default, right, back, tube-end zoom).

**Tests.** 499 and elastic-gauge tests pass.

**Screens.** Coincident faces 0 after raising the eyes proud. The coaxial 0.0897 stud/ball lead is the same at HEAD.

## 500 (low): dial colour

**Change.** The annular dial is ivory #e6dcc3, where it was the page colour.

**Captures.** `499/a500.png`.

## 498 and 501 (low): kept

Their scale boards and tag are already ivory (#e6dcc3). They are Brown's ivory scales: pass 91 kept them as legitimate, and the brief exempts them. No change.

## 502 and 504 (low): edge pins

**502.** The F/E and B pin heads are now r 0.13 on their 0.091 bores, where they were r 0.20. They sit inside the arm's existing round eyes (0.22 and 0.20) instead of covering them.

**504.**
- The nuts under M and N are now r 0.13 and 0.17 on their bores, where both were 0.19.
- The arm's bosses at M and N are now 0.22 and 0.26, where both were 0.20.

**Captures.** `502/a1.png` and `502/a504.png` (default, underside, zoom).

**Reports.**
- `503-504-contact-solids.json` and `502-505-gear-solids.json` were regenerated with their scripts.
- `506-507-gear-solids.json` had only its source hashes updated. Its script writes to `/dev/shm` by default, and 506/507 geometry is byte-identical.

**Pre-existing, not introduced here.** `502-505-gear-solids.json` now reports 504 "thick B row vs G" penetrations (max depth 0.050).
- A `git archive HEAD` checkout gives the same result, so HEAD's committed report was stale.
- Deferred to a gear lane.

**Screens.** 504 has one new lip lead, where arm D's N boss meets the handle (0.026, relative 0.066).

## Screens (all changed IDs)

The full set is in `/dev/shm/p93/ff/{disc,cf,bi}.json` and `seams.log`.
- Disconnected parts: 0 detached anywhere except 465's unchanged 5.
- Coincident faces: no new fights, after the 462 and 499 follow-ups.
- Body intersections: no new solid overlaps; every remaining lead matches HEAD.
- Loop seams: 16 checked, 0 above tolerance.

## Tests

48 targeted files, 342 tests (`/dev/shm/p93/ff/tests.log`).
- 341 pass.
- 1 fails in `source-presentation.test.mjs`: "151: bearing-(?:post|foot)-.* removes a part". That is another lane's movement 151, not touched here.

## Proposed ledger rows

| ID | Assessment | visibleFlaws | Limits text |
|---|---|---|---|
| 426, 427, 429 | Unchanged | Empty | Append: "Pass 93: steam normals written in place (browser-load test)." |
| 484 | reasonable | Empty | Append: "Left-handed winding read from the plate's crossings; blade radius 2.65 drum radii; plank standards." |
| 486 | minor | "Sails 0.94 of the pivot radius where Brown's are about 1.05; longer boards collide under the official flip timing." | Keep. |
| 487 | reasonable | Empty | Append: "Arms through the rim with floats alongside, between the frames." |
| 489 | reasonable | Empty | No change. |
| 491 | minor | "Pawl pivot sits 15° round from the collar's front (Brown: centred) so the seated nose reads in the root from Brown's view." | Keep. |
| 495 | minor | "Bevels keep flat toothed backs (a tip-circle back disc on all three equal miters would cut the mating teeth)." | Keep. |
| 441, 442, 456, 465, 435, 500, 502 | reasonable | Empty | Append the change summaries above. |
| 462 | reasonable | Empty | Append: "Delivered water runs off at Brown's crop of the land." |
| 499 | reasonable | Empty | Replace the feed-pipe limit with: "Feed runs behind the dial plate." |
| 504 | minor | Empty | Add: "B/G tooth penetration 0.05 in the 502–505 teeth screen (pre-existing at HEAD)." Keep minor until a gear lane resolves it. |

## Deferred

- 504: B/G tooth penetration, pre-existing at HEAD.
- 151: `source-presentation.test` failure belongs to another lane.
- The other lows from the audit were not attempted. They are not on this lane's list: 430, 432, 433, 436, 445/446, 447, 448, 451, 452, 467, 470, 477, 482, 490, 494, 497, 507.

## Note

At 03:21:02 another process ran `git stash` and then popped it (reflog: "reset: moving to HEAD"). This lane's edits survived. Captures taken in that window were discarded and retaken.
