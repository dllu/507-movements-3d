# Pass 88, lane p88-x: solid-on-solid flicker (224, 268, 279, 351, 353, 472, 499)

Reviewer: Claude Opus 5.5, lane p88-x. Date: 2026-09-27.

Scratch files and captures are in `/dev/shm/p87/p88-x/`, outside Git.

- **Screens:** `before.json` and `after.json`, from `scripts/screen-coincident-faces.mjs`.
- **Aimed captures:** `before/` and `after/`. `ID-k-both.png` is zoom 5 and `-both2.png` is zoom 15, aimed at each flagged pair's peak patch. `dNNN.png` is the default view and `rNNN.png` is rotated 35°/15°.
- **Before/after tiles:** `ba-ID-k.png`, `ba1.png`, `ba2.png` and `dflt-s.png`. The columns are before z5, after z5, before z15, after z15.

## Screen, before → after (`--ids=224,268,279,351,353,472,499`)

Areas are × diag².

| ID | Before | After |
|---|---|---|
| 224 | 1 fight, 3.1e-2 (c 0.06) | 0 |
| 268 | 2 fights, 1.9e-2 + 5.9e-3 (c 0.28) | 0 |
| 279 | 2 fights, 1.2e-4 each (c 0.45) | 0 |
| 351 | 1 fight, 5.4e-3 (c 0.26) | 0 |
| 353 | 6 fights, 8.2e-3 in total | 0 |
| 472 | 2 fights, 2.5e-3 + 1.7e-3 (c 0.37) | 0 |
| 499 | 1 fight, 3.2e-3 (c 0.17) | 0 |

There are no seams in any of these IDs, and no flags remain, so there are no false positives to explain.

## Per ID

### 224: wheel c (`authored-expanding-pulleys.js`)

- **Cause.** The slotted plate (0.18 deep) overlapped the 32-tooth gear through 0.14 of its depth. The two shared the six slot walls and the 0.122 bore wall, in the same colour but at different roughness (0.72 against 0.61).
- **Fix.**
  - After `correctVariableFaceGear`, the plate is re-extruded from its own shapes as a raised face 0.04 deep. It starts on the gear's front face, and its front face stays where it was (0.04 proud).
  - It now wears the gear's material, so wheel c reads as one body.
  - The plate and gear now meet only face to face, with opposite normals, and the slot walls abut in z without overlapping.
- **Test.** `movement-224` asserts the 0.04 raised depth and that the plate's back face lies on the gear's front face. The studs still overlap the plate.
- **Contact audit.** `docs/validation/219-224-414-contact.json` was regenerated scoped to 224 (`IDS=224` + `SCOPED_REPORT`): 17 poses, inside 0, penetration 0, maxWorkingGap 0.00092. Only the source hash changed.
- **Captures.** `ba-224-0.png`: the faint slot-wall striations are gone.

### 268: rod (`authored-tangent-rod-drives.js`)

- **Cause.** The rod body is already one extrusion that includes the eye (r 0.215, bore 0.156) and the straight lower face. The separate dark `rod-eye-on-moving-crank-pin` journal repeated its rim and bore walls, and the dark `straight-lower-face-tangent-to-guide-roller` strip repeated its lower face. Both fought, with blue/black striations on the eye.
- **Fix.** Both overlay meshes are removed, and the rod is one extrusion as the brief asks. Brown draws neither as a separate part. `rodBody.userData.includes` records the two former roles.
- **Tests.**
  - `movement-268` asserts that `blocks.rodEye` and `blocks.rodWorkingFace` are gone.
  - `tangent-rhombus-journal-solids` now checks crank-arm and shaft clearance, and the crank-pin bore, against `rodBody`.
- **Visible change.** The eye is now the rod's blue instead of a dark ring. Default view: `dflt-s.png`.
- **Captures.** `ba-268-1.png`.

### 279: gib caps (`authored-sliding-journal-boxes.js`)

- **Cause.** Each taper gib runs 0.07 up into its adjustment cap, and the backs of the gib and cap lay in one plane (z 0.25). The gib is see-through.
- **Fix.** Each cap is 0.33 deep instead of 0.34, and its centre moves from 0.42 to 0.425. The cap's back face is now 0.01 in front of the gib's; its front face is unchanged.
- **Captures.** `ba-279-0.png`: the patch is behind the frame and was not visible in the aimed capture before or after.

### 351: stamp head (`authored-stamps.js`)

- **Cause.** A dark 1.04 × 0.055 × 0.74 "impact-face" plate lay flush on the head's lower face and stood 0.01 proud of the front and back faces as a dark lip. Brown draws the head face plain.
- **Fix.** The plate is removed, and the head's own lower face is the impact face (`stampDie.userData.includes`). The unused `rectangularShape` helper is removed.
- **Tests.**
  - `movement-351` asserts that there is no `dieFace`.
  - `stamp-trip-working-parts` audits the strike against the head alone.
- **Captures.** `ba-351-0.png`: the striations on the underside and the dark lip are gone.

### 353: trip hammer (`stamp-trip-working-parts.js`, `correctTripHammerParts`)

This helper file is used only by 351 and 353, both in this lane. `correctStampParts` (351) is unchanged.

| Flagged pair | Cause | Fix |
|---|---|---|
| Journal block / helve hub | Both bored 0.123 while the hub (r 0.28) passes through the block | The block is bored to the hub radius and wraps the hub. |
| Helve / hub | The same shared bore | The helve's notch round the fulcrum is also cut at the hub radius, inside the journal block. |
| Helve / follower nose | The helve's rounded tail was the nose's radius | The tail is now 0.01 smaller, so it stops inside the proud nose. |
| Wiper-wheel body / hub | Both bored 0.123 | The body is bored to the hub radius (0.26). The hub is lengthened 0.02 at the back so that it stands 0.01 proud behind the body. The input shaft's cut end follows the hub, as before. |
| Post / braces | Brace faces coplanar with the post faces | The braces are 0.008 thinner in z, so their faces sit 0.004 inside the post faces. |

- **Disconnected-parts screen.** The first try used a 0.2 helve notch, which left a false "short-of-pin" flag against the fulcrum shaft. With the notch at the hub radius, the result is back to 9 near-misses and 0 short-of-pin, the same as HEAD.
- **Captures.** `ba-353-0.png` and `ba-353-1.png`.

### 472: cylinder B (`authored-compressed-air-hammers.js`)

- **Cause.** The shared `correctHammerWorkingParts` builds shell B 0.08 past each inner end, straight through the full-radius heads. The heads' outer walls, and the section faces left by the front cutaway, lay on the shell's.
- **Fix.** In the 472 factory only, after the shared call, shell B is rebuilt as just the barrel between the heads (`boredLatheGeometry`, same radii). The heads close its ends face to face.
- **Shared helper.** `hammer-working-parts.js` is not touched, so 470 and 471 are unchanged.
- **Disconnected-parts screen.** It adds one benign near-miss: shell and yoke bottom bar, gap 0.08. The lower head now fills the 0.08 that the shell used to run, and it seats on the bar.
- **Captures.** `ba-472-0.png`: the seam at the head and shell section is gone.

### 499: inlet (`authored-bourdon-pressure-gauges.js`)

- **Cause.** The shared `correctElasticGaugeParts` replaces the socket and the collar with bored rings (bore 0.115), and the socket ran up through the collar to the collar's top. The two shared the bore wall and the top face, which showed as radial black/grey hatching.
- **Fix.** In the 499 factory only, after the helper, the socket is rebuilt with `horizontalRing` to end at the collar's lower face (y -4.26 to -3.28). The collar carries the inlet on up.
- **Shared helper.** The helper, which is shared with 500, is not touched. The pressure passage and core still run through both bores.
- **Captures.** `ba-499-0.png`: the hatching is gone.

## Checks

- **Coincident-face screen.** 0 fights and 0 seams for all seven IDs (`after.json`, plus `after353.json` and `after499.json`).
- **Disconnected parts.** HEAD (`git archive` snapshot) against the working tree:

  | ID | Result |
  |---|---|
  | 224, 279, 351, 499 | Identical counts |
  | 268 | Near-misses fell from 5 to 2 (the eye and strip were removed); short-of-pin fell from 1 to 0 |
  | 353 | Identical (9 near-misses; 3 floating, as at HEAD) |
  | 472 | One more near-miss: the benign shell/yoke pair above |

  No new detached parts, slivers or lips.
- **Body intersections.** Identical before and after for all seven IDs.
- **Loop seams.** `check-loop-seams --ids=…`: 7 checked, 0 seams, 0 pops, 0 errors.
- **Tests.** All pass:
  - the 13 targeted files (97 tests): `movement-224/268/279/351/353/472/499`, `elastic-gauge-working-solids`, `hammer-working-interfaces`, `stamp-trip-working-parts`, `tangent-rhombus-journal-solids`, `variable-face-gear-solids` and `screen-coincident-faces`;
  - `models`, `see-through-part`, `movement-500` and `movement-352` (188 tests).
- **Routes.** No authored factory changed which IDs it handles, so the routes were not regenerated.

## Proposed ledger rows

Every row keeps its assessment ("reasonable") and has no visible flaws. Append to limits:

- **224:** "p88: the slotted face of wheel c is a 0.04 raised face on the gear, in its material, no longer overlapping it (a faint coincident-face flicker)."
- **268:** "p88: the rod is one extrusion; the separate dark eye journal and lower-face strip, which z-fought with it, are gone."
- **279:** "p88: the gib caps' backs sit 0.01 in front of the gibs' (were coplanar)."
- **351:** "p88: the head's own lower face is the impact face; the flush dark face plate that z-fought is gone."
- **353:** "p88: the journal block, helve notch and wiper-wheel body wrap their hubs instead of sharing the hub bore; the helve tail stops inside the wear nose; the braces sit just inside the post faces (all were coincident)."
- **472:** "p88: shell B ends at its heads instead of running through them (coincident walls and section faces)."
- **499:** "p88: the inlet socket ends at the collar's lower face (shared bore wall and top face flickered)."

## Full 507 screen: opaque–opaque fights in other movements

- **Run.** `node scripts/screen-coincident-faces.mjs --jobs=20 --out=/dev/shm/p87/p88-x/all.json` (6 min 42 s) over the working tree, which had other p88 lanes' edits in progress. There were no errors.
- **Filter.** Opaque–opaque fights (no transparent or fluid face) with contrast ≥ 0.1 and area ≥ 1e-4 × diag²: 155 rows in 71 movements.
- **Visibility test.** 107 unique pairs remain after excluding this lane's IDs and the other p88 lanes' IDs (347, 418, 425–429, 432, 439, 444, 448–451, 453, 463, 466, 467, 469, 473, 477). For each, a new visibility test (`vis.mjs`) raycasts from the default camera and 9 rotated cameras to the pair's peak patch. It counts the views where the first hit is one of the pair's faces, and captures the best such view at zoom 6, and at zoom 18 for the doubtful ones: `visd/`, `visz/`, and the tiles `c1–c3.png` and `z1–z2.png`.
- **What it found.** 82 of the 107 pairs are not visible from any of the 10 views. Most are two coaxial parts sharing a bore wall, which can only be seen through the shaft clearance. Almost all the rest are two parts sharing a flush end face. Listed below are the pairs that are visible from outside, ordered by evidence and then by area.

Columns: area × diag², contrast, and the number of views (of 10) in which the patch is visible.

| # | ID | Parts | Area | Contrast | Views | Evidence | Suggested fix |
|---|---|---|---|---|---|---|---|
| 1 | 373 | `wagon-load-bed` / `didactic-removable-test-weight-showing-load-change` | 1.1e-3 | 0.43 | 3 | Yellow blotches through the orange bed (z1: v037) | Seat the weight 1e-3 × diag above the bed top, or sink its base into the bed |
| 2 | 220 | `output-slotted-crank-hub` / `second-offset-parallel-slotted-crank-shaft` | 9.0e-4 | 0.30 | 8, default | Radial hatch where the shaft end meets the hub face (c1: v041) | End the shaft short of the hub face, or let it stand proud |
| 3 | 190 | `hub-rigid-with-top-of-power-screw` / `continuous-core-of-vertical-power-screw` | 4.7e-4 | 0.18 | 3 | Radial hatch on the hub top (c2: v070) | Stop the screw core below the hub top |
| 4 | 471 | `constant-speed-driving-crank-A` / `crank-A-pin` | 1.5e-4 | 0.75 | 2, default | Hatched pin end flush in the crank face (c2: v088) | Make the pin stand proud of, or stop short of, the crank face |
| 5 | 311 | `long-fan-fly-crossarm` / `upper-fly-vane` (and `lower-fly-vane`) | 3.3e-4 each | 0.25 | 8, default | Dark hatch where the arm end lies in the vane face (c2: v068) | Stop the crossarm end inside the vane, not on its face |
| 6 | 300 | `front-` and `rear-swept-rest-and-impulse-band` / `…-rounded-forty-five-degree-impulse-flange` | 1.5e-4 each | 0.37 | 6 / 3, default | Speckled flange face (c2: v087, v089) | Make the flange one extrusion with the band, or inset its side faces |
| 7 | 301 | The same pair as 300 (front and rear) | 1.2e-4 each | 0.37 | 8 / 9, default | Same speckle (c2: v097, v098) | As 300 |
| 8 | 170 | `pivotForkBridge` / `pivotForkFront` | 3.0e-4 | 0.46 | 6, default | Hatch on the bridge face (z1: v066) | Merge the fork's bridge and front into one extrusion, or offset one |
| 9 | 454 | `fixed-cylindrical-water-chamber-below-diaphragm` / `fixed-diaphragm-pump-chamber-bottom` | 1.0e-4 | 0.23 | 8, default | Speckle at the flange corner (z2: v102) | End the chamber wall on the bottom's top face instead of overlapping its rim |
| 10 | 320 | `roughened-ratchet-pulley-p-hub` / `ratchet-wheel-riding-on-arbor-p` | 5.8e-4 | 0.71 | 3 | Stripes in the shared bore (c1: v047) | Bore the ratchet wheel to the hub's outer radius (the 353 pattern) |
| 11 | 402 | `left-internal-mesh-balance-hub` / `finite-involute-balance-pinion` | 2.3e-4 | 0.68 | 1, default | Speckle in the shared bore (z2: v076) | As 320 |
| 12 | 199 | `solid-side-plate-of-partial-lantern-pinion` / `hub-of-partial-lantern-pinion` (2 pairs) | 7.2e-4 each | 0.79 | 1, default | Small speckle at the hub (z1: v044) | Bore the side plates to the hub radius |
| 13 | 413 | `right-flank-of-v-edged-rubber-disk` / `right-rigid-v-groove-flank` | 5.3e-4 | 0.45 | 3 | Streaks at the flank foot (c3 at zoom 6; clean at zoom 18) | Keep the contact flank 1e-3 × diag off the groove face |
| 14 | 326 | `source-proportioned-frame-solid-minus-real-guide-opening` / `right-` and `left-planed-true-guide-surface` | 1.4e-3 each | 0.28 | 5 / 3, default | Dashed dark marks along the guide edge (z1: v025) | Sink the guide-surface strips 1e-3 × diag into the frame, or drop them (the frame already has the opening) |
| 15 | 36 | `root/ExtrudeGeometry` / `root/ShapeGeometry` | 2.9e-3 | 0.19 | 8, default | 7320 triangle pairs: a flat ShapeGeometry lying on an extrusion face. Clean in the capture (single winner) | Offset the overlay 1e-3 × diag, or merge it into the extrusion |
| 16 | 447 | `boat-hull-radial-to-anchor` / `ferry-deck` | 5.8e-4 | 0.29 | 6, default | Clean at zoom 6 and 18 (latent) | Raise the deck slightly off the hull's top faces |
| 17 | 327 | `left-` and `right-straight-guide-bar-A-column-body` / `…-round-ended-guide-strap` | 2.3e-4 each | 0.28 | 7 / 6, default | Clean (latent) | Merge the strap into the column extrusion |
| 18 | 383 | `cloth-wound-roll-body` / `one-continuous-cloth-or-warp-web-on-tangent-s-path`; also 12 `one-of-dressing-cylinder-brush-bars` pairs, 1.8e-3 each | 4.7e-4 | 0.40 | 5, default | Clean at zoom 18 (latent) | Lift the web off the roll and brush-bar faces by 1e-3 × diag |
| 19 | 500 | `fixed-case-of-diaphragm-gauge-in-section` / `passage-nipple-behind-case-in-section` | 2.6e-4 | 0.69 | 7, default | Clean (latent) | Recess the nipple end 1e-3 × diag behind the case face |
| 20 | 486 | `central-six-arm-rotor-hub` / `square-boss-on-vertical-output-shaft` | 3.2e-3 | 0.71 | 2 | Clean (identical vertices; latent, as p87-z found) | Offset the boss face |

Rows 1 to 14 were seen to speckle or streak in captures. Rows 15 to 20 are visible from outside but rendered stably in the captures (one face wins), so they are latent.

The largest pairs by area are not in this table: 254, 248, 500 (case / rim ring), 493, 375, 495, 413 (nut / collar), 242, 241, 505, 401, 260, 361, 287, 346, 366, 328 and 7. None of them is visible from any of the 10 views. They are shared bore walls or section faces enclosed by other parts, which matches p87-z's reading.

### Limits of the visibility test

It probes only the pair's single peak point, at one phase. A pair whose peak is hidden but whose other patches show is missed. For example, 353's journal-block pair scored "not visible" in the same kind of probe, yet its hub streaks were visible at zoom.

## Incident

In the first "after" capture, a Vite server on port 45890 was still serving old modules. That server was p88-w's (`/dev/shm/p87/p88-w/vite.config.mjs`), and I killed it. I restarted it on 45890 at once with p88-w's own `restart.sh`, and moved my own server to 45911. All the "after" captures come from 45911 and were checked to serve the edited files.

The "before" captures were served by p88-w's server from the same working tree, before my edits. The one exception is 499: I had already edited it, so its HEAD file was restored temporarily for the capture.
