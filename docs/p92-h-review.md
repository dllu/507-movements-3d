# Pass 92, lane p92-h: notch a in one piece (186, 188); handles and hinge pins on edges

Reviewer: Claude Opus 5.5, lane p92-h (five sub-forks for the edge fixes, integrated by the lane). Date: 2026-09-28.
Scratch and captures are in `/dev/shm/p92/h/` (outside Git). No git writes were made.

## 186: notch a cut into the lever's drop

- **Before** (`b186-tile.png`, zoom `z186.png`). The drop ended in a narrow stalk with a foot. Notch a was a pocket in the foot's underside with a lip hanging below it, so the foot read as two legs (split parts), and the spring's tongue lay flat under it.
- **Plate.** Brown draws the drop as one broad web: his thin inner edge on the left, his heavy outer edge on the right. Notch a is the concavity cut into its lower outer corner. The tongue runs under the drop, and its end sits at a.
- **Change** (`src/simulation/gab-disengager-186.js`):
  - The drop is one extrusion with the lever. Its web is widened to Brown's inner edge, and the flat the tongue bears on starts at x 445 (was 457).
  - Notch a is cut into the lower outer corner. The outer edge comes in along a concave circular arc (sagitta 2.5 px) to the notch roof at y 309.5. The notch has a short wall down to the flat. The old lip is gone.
  - The tongue now runs on to x 484, under the notch. When latched, its last 6 px spring up 3.9 px into the notch, and its end stands just past the corner, as Brown's barb at a.
  - The kinematics are unchanged: lever angle, lift, tongue slide of 0–3.7 px, and the latch timing.
- **Captures:** `a186-tile.png` (default, latched, rotated, zooms, plate) and `a186-latch.png` (before the snap, then latched).
- **Tests:** movement-186 passes 7/7. The free-end x is now 484 and the drop's outer edge is 495.5. The existing checks still hold: the strap never enters the lever, the tip touches within 0.003, and the loop stays rigid.
- **Screens:**
  - Disconnected parts: 0 detached, 0 slivers, 0 lips. There are 2 near-misses, the existing c-bore clearance and rocker/rod.
  - Coincident faces: 0.
  - Seams: 0.
  - `docs/validation/186-187-cam-solids.json` was regenerated: 129 poses, 0 intersections for 186–189.
- **Proposed ledger row:**
  - assessment: reasonable
  - visibleFlaws: ""
  - limits (append): "Pass 92: notch a is cut into the drop's lower outer corner (one extrusion with a concave outer edge, as Brown draws it); the tongue's end springs up into it to latch."

## 188: notch a cut into the loop handle's limb

- **Before** (`b188-tile.png`). The brass limb ended at a and stood on the wide blue head of a separate leaf spring through a hidden lug. Step a was the joint between two parts in two colours.
- **Plate.** Brown draws the loop's right-hand band as one continuous band from the loop down, through a, behind the diagonal, and on to the clip. There is no line across it at a. The band narrows above a, so notch a is a step cut into its inner edge.
- **Change** (`src/simulation/gab-disengager-188.js`):
  - The handle's single extrusion now includes the limb's head below a. The notch ledge runs from x 204 in to the limb's inner edge at y 177.5. The head widens below the ledge to Brown's 34 px, then closes onto the diagonal's centreline. Limb, notch and diagonal are one piece.
  - Behind the diagonal, hidden in the plate view, the head carries a round tab (r 10 px, z −0.605…−0.39) back to the leaf's plane. The leaf's end is set in the tab.
  - The leaf now runs from the clip to the tab (end at (216, 231), leaning 45° right, as Brown's band where it passes behind the diagonal). It keeps constant length, sliding in the clip. Its section tapers from 15 px to 9 px.
  - The leaf is now the handle's brass, so the band reads as one piece from the loop to the clip, as drawn.
  - The lug is removed. The handle kinematics are unchanged.
  - `review-gab-cam-solids.mjs` treats the leaf/tab pair as joined.
- **Captures:** `a188-tile.png` (default, lifted, rotated, oblique and front zooms, back view).
- **Tests:** movement-188 passes 7/7:
  - The notch ledge is an edge of the handle extrusion, and there is no lug.
  - The leaf end lies at (216, 231), stays inside the tab, and is carried by the head.
  - The tab never shows past the handle's outline.
  - Pins never enter the rod, handle or tab.
  - gab-joint-solids passes.
- **Screens:**
  - Disconnected parts: 0 detached, 0 slivers, 0 lips. The near-misses are the existing rod/handle z-gap at the pivot and the clip cheeks.
  - Coincident faces: 0.
  - Seams: 0.
  - The cam-solids report is clear.
- **Residual:**
  - Brown gives notch a no working partner in 188 ("modifications of 186"). The model now shows it as the drawn step, and the leaf, set in the head behind the diagonal, props the lifted handle.
  - From oblique views the leaf visibly steps back behind the diagonal to its own plane.
- **Proposed ledger row:**
  - assessment: reasonable
  - visibleFlaws: ""
  - limits (replace the leaf/step-a sentence): "Pass 92: notch a is a step cut into the loop handle's limb, which runs on below it as one extrusion joining the diagonal; the leaf spring (same brass) is set in a tab on the head hidden behind the diagonal and props the lifted handle; the leaf steps back one plane behind the diagonal."

## Edge-mount screen

`scripts/screen-edge-mounts.mjs` loads every production model as the browser does and samples two phases.

- **Candidate pins.** Candidates are cylinder-like meshes: Cylinder, Lathe or Capsule geometry, or any mesh round about one local axis. Their roles must read as handle, grip, knob, crank pin, hinge, pivot, pin, stud, rivet and the like. These are `PINLIKE` from `screen-disconnected-parts.mjs` plus handle/grip/knob, less mounting words (boss, eye, hub, collar, bearing, washer, cap) and shafts.
- **Mounts.** A mount is any other visible solid whose triangles meet the pin's axial span and whose projected silhouette reaches the pin's circle. Meshes of the same named part, figures and ground are excluded.
- **Margin.** The outline is the union of the mount's triangles projected on the plane normal to the pin, inside a window of 3 radii. The margin is the distance from the axis to the outline's outer boundary; holes such as the pin's own bore are ignored.
- **Flag.** A pair is flagged when the margin is below 1.1 r, where r is the pin's radius at the mount (a turned handle is measured at its foot). Pins whose circle only grazes a part from outside are skipped as working contacts.

Output is `/dev/shm/p92/edge.json`. The run found 1129 pins and 1339 mounted pairs; 147 pairs in 76 movements are flagged.

Contact sheets of every flagged pin are in `/dev/shm/p92/h/e/sheet00–10.png`, with a default-direction zoom and an oblique zoom for each. They were reviewed by eye. Many flags are false positives:
- pins passing near a part without being mounted on it;
- pins riding slots, gabs or grooves;
- studs on rims;
- eyes exactly the bar's width.

Before the fixes, 147 pairs were flagged in 76 movements. After the fixes, and after adding the rule that clears pins enclosed by a same-body coaxial mesh (found through 337/338/339), 98 pairs remain in 43 movements.

### Fixed in this pass (sub-lanes A–G, unclaimed files)

| ID | Fix |
|---|---|
| 190 | The 74.png case: the grip is now the shared turned handle, on a round crank end. |
| 283 | Shared turned handle in a round eye. |
| 358 | Shared turned handle on an arc-ended crank arm. |
| 368 | Shared turned handle on an arc-ended crank arm. |
| 370 | Shared turned handle on an arc-ended crank arm. |
| 506 | Shared turned handle on a round crank end. |
| 328 | Crosshead span ends are round about the pins. |
| 309 | Fork rods P and Q end in eyes. |
| 441 | Tipping-pin arm ends in an eye. |
| 185 | Handle fulcrum boss and die-pin eye. |
| 281 | Bracket eye. |
| 357 | Round lug top under lever N's pivot. |
| 360 | Round-topped upright. |
| 366 | Link eyes on the treadle and upper lever. |
| 401 | Treadle eye. |
| 421 | Round-ended crank throw. |

### Handles unified on the shared builder

`src/simulation/turned-handle.js` now holds p90-u2's builders, which were local to 379/380: `turnedHandleGeometry`, `crankArmOutline`, `crankArmGeometry` and `HANDLE_FOOT_EMBED`. It adds `standardTurnedHandleGeometry`, which scales 379's stations to a given height and bulb.

- 379 and 380 now import the shared builders; their geometry is unchanged.
- Converted: 190, 283, 358, 368, 370 and 506.

### Remaining edge-mount hit list (after fixes)

The Owner column is the lane that has claimed the file.

| ID | pairs | worst ratio (margin / r) | file | Owner | verdict |
|---|---|---|---|---|---|
| 76 | 4 | 1.003 | `jointed-tappet.js` | - | studs on the rim of the driver ring; margin ~1 r (flush eye width); not an edge mount |
| 87 | 2 | 0.653 | `weighted-clutch.js` | - | reversing stud on stud wheel rim / bell-crank pin in eye of equal width; minor |
| 100 | 1 | 1 | `authored-cranks.js` | p92-s | crank pin fills the rounded crank end flush (ratio 1.0); acceptable |
| 133 | 1 | 0 | `authored-gears-core.js` | p92-g | hand-crank grip on the square end of a box crank arm; real, file claimed by p92-g, deferred |
| 145 | 1 | 0.894 | `authored-linkages.js` | p92-g | through-pin at beam end, eye nearly flush; file claimed by p92-g, deferred |
| 175 | 1 | 1.09 | `authored-stroke-cranks.js` | - | retaining head fills the rod eye flush; acceptable |
| 181 | 5 | -0.181 | `authored-diagonal-catches.js` | p92-c | hinge pins and rounded working ends of the back-weighted handles on square bar ends; real, file claimed by p92-c, deferred |
| 182 | 5 | -0.181 | `authored-diagonal-catches.js` | p92-c | as 181; claimed by p92-c, deferred |
| 185 | 1 | 0.375 | `authored-locomotive-valve-gears.js` | p92-h | reversing-handle axis: boss added by p92-h/E, the screen measures the bar mesh only (false positive) |
| 188 | 1 | 0.681 | `authored-gab-disengagers.js` | p92-h | the new hidden tab behind the diagonal against the handle (same body, tab is not a pin; false positive) |
| 194 | 1 | 0.608 | `authored-gears-core.js` | p92-g | face pins seated in their own dark seats (by design) |
| 206 | 2 | -0.577 | `authored-intermittent-core.js` | - | pawls pass the common pin of the other pawl (not a mount; false positive) |
| 208 | 3 | -0.883 | `authored-gears-core.js` | p92-g | axial drive pins crossing the slotted pinion web (pins pass through slots; false positive); claimed by p92-g |
| 211 | 1 | 0.803 | `authored-intermittent-core.js` | - | single driving pin near wheel rim; minor, by design (entry pin) |
| 224 | 7 | 0.4 | `authored-expanding-pulleys.js` | - | slot-captive studs and click pivot in guide lip: studs ride slots; minor |
| 237 | 1 | 0.189 | `authored-intermittent-core.js` | - | pawl hinge pin on square end of the radial box arm; real but small; deferred (time) |
| 274 | 4 | 0 | `authored-parabolic-governors.js` | - | top fastening pins of the parabolic guides at the guide ends (bent guide tube ends at the pin); deferred |
| 280 | 4 | 0 | `authored-friction-windlasses.js` | - | coupler pin at the end of the short box arm and cheek pins; deferred |
| 310 | 2 | 0.31 | `authored-gravity-escapements.js` | p92-h | beat pins on the thin gravity-arm bows: pin wider than the bow (Brown draws pins on the arms); deferred |
| 354 | 1 | 1 | `authored-uniform-groove-crossheads.js` | - | crank wrist fills disk groove (slot rider; false positive) |
| 356 | 2 | 0.733 | `authored-gyroscopes.js` | - | gimbal trunnions through thin rings, ring narrower than the pin; deferred |
| 357 | 1 | 0.548 | `authored-anderson-governors.js` | p92-h | Cardan hinge trunnion in the open hinge frame; not reviewed in detail, deferred |
| 361 | 1 | 0.1 | `authored-axial-pin-clutches.js` | - | lever pivot on a bearing upright, boss nearly flush; minor |
| 378 | 1 | 0.477 | `authored-pendulum-saws.js` | - | pendulum lower driving pin on the thin rod; file claimed by p92-r, deferred |
| 386 | 1 | -0.749 | `authored-folding-ladders.js` | - | pivot pin through the pole shell side (not a mount) |
| 390 | 1 | 0.345 | `authored-dual-band-ratchets.js` | - | fixed fulcrum a on the operating lever near its edge; deferred |
| 391 | 2 | 0.382 | `authored-alternating-weighted-racks.js` | - | lower pivot pins on weight arms; file claimed by p91-b, deferred |
| 392 | 1 | 0 | `authored-gig-saws.js` | - | wrist pin in sliding block; eye nearly flush; minor |
| 397 | 1 | 0.999 | `authored-intermittent-shuttle-drives.js` | - | crank pin in curved slot, flush eye (ratio 1.0); acceptable |
| 398 | 1 | -0.351 | `authored-cam-rocking-drives.js` | - | crosshead pin beside guide block (not a mount) |
| 400 | 1 | 0.621 | `authored-four-motion-feeds.js` | - | pivot inside fork cheek, eye flush with cheek; minor |
| 403 | 2 | -0.542 | `authored-cyclographs.js` | - | crossing fastening of the two rules sits at the rule edges; plate draws the rules crossing; deferred |
| 409 | 1 | -0.274 | `authored-proportional-compasses.js` | - | common pivot slide in the slotted legs (slot rider; false positive) |
| 411 | 3 | -0.873 | `authored-self-recording-levels.js` | - | diagonal push handle passes near frame members (not a mount; false positive); pendulum pivot on the curved frame, minor |
| 441 | 12 | 0.735 | `authored-persian-irrigation-wheels.js` | p92-h | tipping pin fixed by p92-h/E; bucket suspension pins nearly fill the thin rim (0.735); deferred |
| 450 | 2 | 0.293 | `authored-force-pumps.js` | - | handle fulcrum/rod-top pins through the flat hand lever near its edges; deferred |
| 451 | 2 | 0.293 | `authored-force-pumps.js` | - | as 450; deferred |
| 459 | 1 | 0.75 | `authored-reciprocating-well-lifts.js` | - | fixed tappet pivot on the frame edge; deferred |
| 465 | 2 | 0.972 | `authored-balance-pumps.js` | - | beam-to-pitman pins with flush eyes (0.97); acceptable |
| 489 | 4 | 0.361 | `authored-feathering-paddle-wheels.js` | - | bucket pivots against the blind axle-bore back wall (not a mount; false positive); file claimed by p91 |
| 499 | 4 | 0 | `authored-bourdon-pressure-gauges.js` | - | Bourdon tube end link pins at the closed tube ends (tube end is round about the pin); acceptable |
| 502 | 2 | 0.999 | `authored-epicyclic-trains.js` | p92-h | carrier pins fill rounded bar ends flush (reviewed by p92-h/C); acceptable |
| 504 | 2 | 1.051 | `authored-epicyclic-trains.js` | p92-h | as 502; acceptable |

### Deferred as claimed by other lanes

These have real edge mounts, but their files are claimed:
- 133, 145 and 208 (p92-g);
- 181–184 (p92-c);
- 378 (p92-r);
- 391 (p91-b);
- 489 (p91).

### Deferred for time

Also seen and not fixed:
- 237, 274, 280, 310, 356, 390, 403, 450/451 and 459;
- 441's bucket-suspension pins on the thin rim;
- 368's default crank pointing up where Brown draws it down;
- 185's white index spheres.

## Sub-lane evidence

### 190: crank handle stood on the very end of its bar (the 74.png case)

Sub-lane p92-h/A. File: `src/simulation/authored-clamps.js` (claimed). Scratch in `/dev/shm/p92/h/A/`.

- **Before.** The screw's turning handle was a 0.16-wide box bar that stopped exactly at the handle axis, and the grip was a plain black capsule (r 0.115) standing on that square end. The grip was wider than the bar and half of it hung past the end (74.png). The edge-mount screen flagged it at ratio 0.
- **Plate.** Brown draws the usual crank. The bar is 18 px deep (y 245–263) and runs 13 px past the handle. The handle is turned: 37 px tall, with a slightly flared foot, a slim neck (about 7 px) low down and a pear bulb 19 px across at about 0.7 of its height (`plate-handle.png`, a gridded crop).
- **After.**
  - **Bar.** The bar is one flat extrusion from the shared `crankArmGeometry` (`turned-handle.js`), 0.14 deep, as before. Its plan is the hull of a 0.10 circle buried in the screw hub (r 0.22) and a 0.13 circle concentric with the handle axis, so the bar's end is a circular arc 0.13 past the handle.
  - **Grip.** The grip is the shared `turnedHandleGeometry`, with plate 190's proportions at 0.017 units per pixel:
    - 0.63 tall above the bar;
    - foot 0.085;
    - neck 0.058 at 0.32 of the height;
    - bulb 0.155 at 0.72.

    Its foot is sunk `HANDLE_FOOT_EMBED` (0.012) into the bar top, and it stands on the unchanged handle axis (`handleTipAnchor`, raster x 460).
  - **Unchanged.** Motion, handle radius and clamp analytics are unchanged.
- **Framing.** The taller handle raises the motion bounds' max y from 1.35 to 1.465. `src/data/display-profiles.json` was regenerated for 190 only (`node scripts/measure-display-profiles.mjs 190`). The diff was checked to touch only the 190 entry.
- **Captures:**
  - `A/before-tile.png` and `A/after-tile.png`: default, yaw 40, a zoom on the handle and a rotated zoom, beside the plate.
- **Tests:**
  - `tests/movement-190.test.mjs` passes 6/6. The new test checks that:
    - the grip is a LatheGeometry on the handle axis, upright, with its foot sunk into the bar top;
    - the foot is under 0.8 of the end-arc radius;
    - every bar vertex past the axis lies on the 0.13 arc about the handle.
  - camera-catalog passes over all 507 models. A first run during other lanes' edits failed once; the rerun passed.
- **Screens (190):**
  - Disconnected parts: 0 detached, 0 slivers, 0 lips. The 3 near-misses are pre-existing and none involves the handle (fulcrum-pin bore clearance, screw core in its arm, nut in its bench).
  - Coincident faces: 0.
  - Loop seams: 0.
  - Edge mounts: 0 flagged (was 1: grip on bar, ratio 0).
- **Validation reports.** `docs/validation/180-bake.json`, `180-native-cycle.json`, `180-native-study.json`, `180-existing-contact.json` and `174-existing-contact.json` fingerprint `authored-clamps.js`. Their hashes (9d3e…, c499…, 8767…) already did not match the HEAD file (d9f7…) before this change. They were not regenerated: that needs the 180 native MuJoCo study and bake, which is outside this item. They were stale before this pass and still are.
- **Proposed ledger row (190):**
  - assessment: reasonable
  - visibleFlaws: ""
  - limits (append): "Pass 92: the screw's crank takes the shared turned handle at plate 190's proportions, on a bar whose end is a circular arc concentric with the handle (runs 0.13 past it); the capsule grip that stood on the bar's square end is gone."

### Sub-lane p92-h/B: 358, 368 and 370 crank handles

All three used to have a plain black cylinder handle standing on the square end of a box crank arm. The arm ended at the handle axis, so the handle hung half off the arm (edge-mount ratio 0). 368 and 370 also had a separate orange ball knob. Each is now built from the shared `src/simulation/turned-handle.js`:
- **Arm.** One flat extrusion from `crankArmGeometry` / `crankArmOutline`. Its ends are circular arcs concentric with the shaft and with the handle axis.
- **Handle.** A `turnedHandleGeometry` lathe, with its foot sunk `HANDLE_FOOT_EMBED` (0.012) into the arm's face and a margin all round.

Captures are in `/dev/shm/p92/h/B/`:
- `tile-NNN.png`: top row before, bottom row after (default, rotated 40/20, and two zooms on the handle), beside the plate.
- The individual `before-*` and `after-*` frames are alongside.

### 358 (`authored-fusee-traverses.js`)
- **Change.**
  - **Arm.** The crank arm is 0.14 wide and 0.10 thick, with arc ends of radius 0.075 at the handle (1.30 from the shaft) and at the hub. Its top is at 2.245, 0.005 under the hub's top face, so they are not coplanar.
  - **Handle.** Brown's handle is a slim neck swelling to a bulb, about 45 px long, which is 0.32 of the crank radius. The model's is 0.41 long, with foot 0.05, neck 0.036 and bulb 0.082 at 0.8 of its height. It points away from the arm as Brown draws it.
- **Tests.** movement-358 now has a pass-92 test: the handle is lathed; its axis stands inside an arc-ended arm with margin > 1.2 × the foot radius at three poses; the arm's end arc is concentric within 1e-4; no ball knob. movement-358 and fusee: 13+1 pass.
- **Screens.**
  - Edge-mounts: 0 flagged (was ratio 0).
  - Disconnected parts: 0 detached, 0 lips, 0 slivers.
  - Seams: 0.
  - Coincident faces: 2 tiny pairs (carriage bed against the long side bar, area 1.9e-6). They are unrelated to the crank and predate this change.
- **Proposed ledger row.** Assessment unchanged; visibleFlaws "". Append to limits: "p92: crank carries the shared turned handle, centred in an arc-ended arm."

### 368 (`authored-cylinder-spiral-scribers.js`)
- **Change.**
  - **Arm.** Brown's arm tapers to a narrow end carrying a short turned knob with a round bulb (plate x 480–505, y 180–205). The arm is now one extrusion in the crank plane, 0.11 thick along the shaft, with end radii 0.11 at the hub and 0.075 at the knob.
  - **Knob.** It replaces the cylinder and the orange ball: 0.32 long, foot 0.055, neck 0.045, bulb 0.12 at 0.7 of its height, and it points outward along the shaft.
  - **Role.** The handle's role is now `free-turning-hand-crank-turned-knob`. The `crank-handle-end-knob` sphere is removed.
- **Saved report.** `docs/validation/368-372-contact-solids.json` was regenerated with `POSES=33` (pose count kept). Only the source hashes changed: this file, and `primitives.js`, which another p92 lane is editing. That lane must regenerate the report again after its own change. Penetrations remain 0.
- **Tests.** The same pass-92 test was added. movement-368 and scriber-dynamometer-solids pass: 14+ with 0 fail.
- **Screens.**
  - Edge-mounts: 0 flagged.
  - Disconnected parts: 0 detached, 0 slivers. There is 1 lip, on the input-shaft bearing post against the table, which is unrelated and predates this change.
  - Coincident faces: 0.
  - Seams: 0.
- **Residual (not this change).** The default pose shows the crank pointing up, where Brown draws the handle below the shaft.
- **Proposed ledger row.** visibleFlaws "". Append to limits: "p92: Brown's short turned knob on an arc-ended tapered arm (shared builder); the separate ball knob is removed."

### 370 (`authored-mirror-polishers.js`, final geometry in `polishing-joint-parts.js`)
- **Plate check.** Brown draws the handle crank as a tapered arm with a big round boss on the shaft and a round eye at its end, and shows the handle end-on as a smaller circle inside the eye. A handle is therefore drawn; it is kept, and only reshaped.
- **Change** (in `correctMirrorPolisher`):
  - **Arm.** The arm is an extrusion (z 1.00–1.14) with a hub radius of 0.19 and an eye radius of 0.12 about the handle axis, 0.88 from the shaft.
  - **Handle.** The shared turned handle, 0.44 long, with foot 0.065 and bulb 0.08. It replaces the 0.095 cylinder.
  - **Knob.** The ball knob is hidden (`handleKnob.visible = false`). The object is kept for the existing block contract.
  - **End-on view.** The black bulb now sits inside the orange eye, as Brown draws it.
- **Tests.** The pass-92 test was added. movement-370 and polishing-interfaces: 12 pass.
- **Screens.**
  - Edge-mounts: 0 flagged.
  - Disconnected parts: 0 lips, 0 slivers. There is 1 near-miss "detached" group: the lower-rail fasteners and guide pins against the rail, a 0.03 gap. It is unrelated.
  - Coincident faces: 0.
  - Seams: 0.
- **Proposed ledger row.** visibleFlaws "". Append to limits: "p92: handle crank is an arc-ended tapered arm with Brown's eye round a shared turned handle; the ball knob is removed."

### Files changed and claimed by p92-h
- `src/simulation/authored-fusee-traverses.js`
- `src/simulation/authored-cylinder-spiral-scribers.js`
- `src/simulation/polishing-joint-parts.js` (`authored-mirror-polishers.js` is claimed but not edited)
- `tests/movement-358.test.mjs`, `tests/movement-368.test.mjs`, `tests/movement-370.test.mjs`
- new `tests/helpers/turned-handle-mount.mjs`
- `docs/validation/368-372-contact-solids.json`

### 506: crank A's handle (sub-lane p92-h/C)

- **Before.** The edge-mount screen flagged `driver-A-hand-grip` on `hand-crank-rigid-with-driver-A` at ratio 0.33. The grip was a plain black cylinder (r 0.12, 0.58 long) run straight through the square-ended box crank (0.15 x 1.12 x 0.14). Its axis sat 0.04 below the crank's end, so the grip overhung the crank's end and sides. Capture: `/dev/shm/p92/h/C/b506-tile.png`.
- **Change** (`src/simulation/authored-epicyclic-trains.js`; one line in `src/simulation/compound-epicyclic-corrections.js`):
  - **Crank.** The crank is one flat plate, 0.15 thick along A, built from `crankArmOutline` in the shared `turned-handle.js`. Its ends are circular arcs: one concentric with the handle axis (r 0.17, leaving a 0.07 margin round the handle's 0.10 foot), and one concentric with shaft A (r 0.13, round the 0.12 shaft). The throw is unchanged at 1.02.
  - **Handle.** Brown draws the usual turned handle on A. The grip is now the shared `standardTurnedHandleGeometry`: 0.46 long, bulb 0.12, foot 0.10, read from plate 506 at about 0.0097 units per pixel. It stands on the crank's outer face pointing away from the machine along -x, with its foot sunk `HANDLE_FOOT_EMBED` (0.012) into the face and centred on the crank's centreline.
  - **Correction file.** The source-support correction used to move the grip to a hard-coded x of -3.72. It now places the grip at the crank's x plus `crankGrip.userData.armOffsetX`, so the foot stays on the crank face.
  - Motion, framing and the input index are unchanged.
- **502/504.** No change. Their flagged carrier pins (ratios 0.999 to 1.099) fill the rounded bar ends flush with the bar sides and do not look like they sit on an edge (`/dev/shm/p92/h/e/sheet09.png`, `sheet10.png`).
- **Captures:**
  - `/dev/shm/p92/h/C/b506-tile.png` (before) and `/dev/shm/p92/h/C/a506-tile.png` (after): default and rotated views beside the plate.
  - `/dev/shm/p92/h/C/a506-ztile.png`: after, zoomed on the handle from the front, oblique and back.
- **Tests:**
  - A new `movement-506` test checks that the handle is a lathe pointing along -x, on the crank centreline, with its foot sunk 0.012. It also checks that every crank vertex beyond the handle lies on the r 0.17 end arc, and that the hub is on A.
  - movement-506, compound-epicyclic-geometry, compound-epicyclic-supports, epicyclic-family-clearance and epicyclic-503-504-contact pass: 23 tests, 0 failures.
- **Reports:**
  - `docs/validation/503-504-contact-solids.json` was regenerated. It was current before this pass; only the source hashes changed. The `primitives.js` hash also moved, because of another lane's edit.
  - `docs/validation/506-507-gear-solids.json`: `scripts/review-compound-epicyclic-teeth.mjs` reproduces its results exactly (506: 33 poses, 0 penetrations). Its source hashes were refreshed.
  - `docs/validation/502-505-gear-solids.json` was already stale and was left untouched. Its current script drops the sources block and reports 504 penetrations against the older contact model; 504 is validated by the 503-504 report.
- **Screens (502, 504, 506):**
  - Disconnected parts: 0 detached, 0 slivers, 0 lips. No near-miss involves the crank or the handle.
  - Coincident faces: 506 has 1 flagged pair, `driver-shaft-A-bearing` against `driver-bearing-bridge-to-curved-standard` (area 0.00046 relative). This predates the pass and does not involve the crank. It is not fixed here.
  - Loop seams: 0.
  - Edge mounts: 506 has 0 flags. The 502/504 carrier pins remain flagged as above.
- **Proposed ledger row, 506:**
  - assessment: reasonable
  - visibleFlaws: ""
  - limits (append): "p92: crank A is one round-ended plate carrying the shared turned handle, centred with a 0.07 margin, as Brown draws it."

### Sub-lane D: pins on square bar ends (328; 337, 338, 339 checked)

Files claimed: `authored-cartwright-parallel-motions.js`, `authored-vibrating-rod-parallel-motions.js`, `authored-direct-action-parallel-motions.js` (the last two left unchanged).

### 328: crosshead rod-joint pins
- **Before.** The horizontal crosshead was a `BoxGeometry` that stopped at the two rod-joint pin axes. Half of each pin (r 0.079) hung past the bar's square end, which was 0.105 high. Edge-mount ratio: 0.
- **Plate.** Brown rounds each crosshead end concentric with its small pin (mm_328, crop `D/p328z.png`).
- **Change.** `crossheadBar` is now one flat `ExtrudeGeometry` with the same depth (0.18) and plane:
  - the 0.105-high bar, plus a round end of radius 0.113 (0.54 source units, the rods' eye radius) about each pin axis;
  - the bar joins each end arc at its tangent-free neck;
  - pin margin 1.44 r.

  Pins, rods and motion are unchanged.
- **Captures:** `/dev/shm/p92/h/D/tile-328.png`. The top row is before and the bottom row after: default, zoom and oblique zoom, beside the plate. The per-view images are `D/before-*.png` and `D/after-*.png`.
- **Tests:** `movement-328` 10/10. The new p92 test checks that every crosshead-outline vertex beyond each pin axis lies on one circle about the pin, that the bar runs past the pin by that radius, and that the end radius is more than 1.3 × the pin radius.
- **Screens:**
  - Edge mounts: 328 has 0 flagged (was 2).
  - Disconnected parts: 0 detached, 0 slivers, 0 lips. No new crosshead near-miss; the only one is the existing piston rod / cylinder clearance.
  - Coincident faces: 1 pair, the existing gland/neck pair, unrelated to this change.
  - Loop seams: 0.
- **Reports:** no saved validation report fingerprints this file.
- **Proposed ledger row (328):**
  - assessment: unchanged (no new visible flaw)
  - visibleFlaws: unchanged
  - limits (append): "p92: the crosshead is one extrusion with round ends concentric with the rod-joint pins (Brown's rounded ends); the pins no longer stand on a square bar end."

### 337, 338, 339: screen false positives, no change
- **Why they were flagged.** The edge-mount hits (ratio 0) pair each pin with a box rod or arm that ends at the pin axis. On these movements that rod or arm is only one mesh of a rigid body that also carries a coaxial boss round the pin:
  - 337 C: crosshead boss 0.36 s against pin 0.20 s;
  - 338 L: boss 0.32 s against pin 0.19 s;
  - 339 C: crosshead box 0.76 s high against pin 0.25 s;
  - 339 P: crank-pin boss 0.50 s against pin 0.24 s.
- **What shows.** Each pin stands centred in a boss with a margin all round, and the rod end is buried in the boss (contact sheet `/dev/shm/p92/h/e/sheet03.png`, #44–#47).
- **Screen improvement (for the parent).** When a coaxial mesh of the same rigid body already encloses the pin with margin, discount the other mount.
- **Ledger:** no change.

### Sub-lane p92-h/E: edge-mounted pins in 185, 309 and 441

Claims taken (p92-h): `authored-gravity-escapements.js`, `authored-persian-irrigation-wheels.js`, `authored-locomotive-valve-gears.js`, `generate-gravity-escapement-plates.mjs`, `gravity-escapement-plates.js`. None of these was claimed before.
Captures are in `/dev/shm/p92/h/E/`. `b*` files are before, `a*` files are after, and `ba<ID>-tile.png` shows the before zooms, then the after default view and zooms, beside the plate.

### 309: fork pins P and Q
- **Before.** Each half-fork (a band 0.12 wide) ended in a disc of radius 0.10. The pin P or Q, of radius 0.105, was wider than that disc, so the pin stood over the rod's edges. Edge-mount ratio was 0.949.
- **Change.** Brown draws each rod ending in a round eye, with the small pin concentric inside it. The eye disc is now 1.5 × the pin radius (0.1575), part of the half-fork's single plate extrusion. The pin radius and contact clearance are unchanged, so the motion is unchanged.
- **Bake.** `scripts/generate-gravity-escapement-plates.mjs 309` was rerun, and `src/simulation/baked/gravity-escapement-plates.js` was regenerated.
  - Only 309's left and right half-fork outlines and its inputHash changed.
  - The pallet plates are byte-identical, and 310–312 are untouched.
  - The eye is uncut by the swept envelope (area 0.83711, kept in full).
- **Tests:**
  - movement-309 has 11 tests. The new one checks that every fork-outline vertex lies at least 1.45 r from the pin axis.
  - gravity-escapement-working-solids passes, with the bake fingerprint current.
- **Screens.**
  - Edge-mount: 0 flagged (was 2).
  - Coincident faces: 0. Seams: 0.
  - Disconnected parts: the pallet assemblies still show as near-miss detached through the fixed pendulum-suspension stud (0.06 and 0.029). These rows bridge the arbors to the stud and do not involve the eye, so they predate this change.
- **Proposed ledger row:**
  - assessment: unchanged
  - visibleFlaws: unchanged
  - limits (append): "p92: half-forks end in round eyes (1.5 × pin radius) concentric with pins P/Q; the pins remain larger than Brown's small circles because their radius sets the pendulum contact."

### 441: stationary tipping pin
- **Before.** The pin (r 0.07) stood on the square end of the grey arm. The 0.12 box bar stopped 0.04 short of the pin axis, so half the pin hung past it. Ratio was 0.571.
- **Change.** The arm is now one flat extrusion (z 1.28–1.40): the bar plus a round eye of radius 1.6 r, concentric with the pin. The pin position and length are unchanged. Brown draws no bracket; it was kept, minimal, because the caption's tipping pin needs a carrier.
- **Tests:**
  - movement-441 has a new test: the arm outline lies at least 1.5 r from the pin axis.
  - movement-441, persian-bucket-trip and water-lifting-441-443-solids pass (23 in total), including the bucket-versus-fixed-part solid checks.
- **Screens.**
  - Edge-mount: the tipping pin is cleared.
  - Still flagged: the six bucket-suspension pins, each at 0.735 against the thin rim and the float-tip link. These are out of this sub-lane's scope and left as a residual.
  - Coincident faces: 0. Seams: 0.
  - Disconnected parts: 0 detached. The short-of-pin rows are the existing bucket-bail and pin clearances.
- **Proposed ledger row:**
  - assessment: unchanged
  - visibleFlaws: unchanged
  - limits (append): "p92: the tipping-pin arm ends in a round eye concentric with the pin; the bucket suspension pins still nearly fill the thin rim (edge-mount ratio 0.74)."

### 185: reversing-handle fulcrum
- **Before.** The fixed axis (r 0.14) was wider than the 0.105 handle bar, so it stood on the bar's edges. Ratio was 0.375. Brown draws the handle swelling into a round boss at its fulcrum.
- **Change.** A round boss (`reversing-handle-fulcrum-boss`) now turns with the handle, concentric with the axis:
  - radius 0.23, a margin of 0.09;
  - depth 0.19, standing 0.02 proud of each face of the bar, so no face is coplanar;
  - the handle's own material.
- **Tests:** movement-185 passes 5 tests. The new one checks that the boss is in the handle group, sits on the axis, and has a radius of at least 1.5 × the axis radius.
- **Screens.**
  - Edge-mount: still lists axis-versus-bar (0.375), because the screen measures the bar mesh alone and not the boss. It also lists die-pin versus rocker lower arm (0), which was not addressed here.
  - Coincident faces: 0. Seams: 0.
  - Disconnected parts: 0 detached, and the short-of-pin rows are unchanged in kind (existing eccentric-rod and slot-end clearances).
- **Proposed ledger row:**
  - assessment: unchanged
  - visibleFlaws: unchanged
  - limits (append): "p92: the reversing handle carries a round fulcrum boss concentric with its axis, as Brown draws."

No saved validation report fingerprints these files except the gravity-escapement bake, which was regenerated.

### Sub-lane F: 283, 360, 366

Captures are in `/dev/shm/p92/h/F/`. Each `tile-<id>.png` shows the before view in the top row and the after view in the bottom row, beside the plate: default, rotated, and default and oblique zooms on the flagged pin. Before running the "before" screens, the three files were briefly swapped back to their HEAD content and then restored; their diffs are unchanged.

### 283 (`authored-rack-pumps.js`): manual handle knob
- **Before.** The grip was a plain black cylinder (r 0.145, 0.54 long) standing on the end of the tube handle (r 0.095). The edge-mount ratio was 0.
- **Change.**
  - The curved bar now ends in a round eye (`manual-handle-round-end-eye`), a cylinder of r 0.14 and 0.25 deep, concentric with the knob.
  - The knob is now the shared turned handle (`standardTurnedHandleGeometry`, height 0.40, bulb 0.16, foot 0.091). It stands forward from the eye's front face, with its foot sunk `HANDLE_FOOT_EMBED` into it.
  - Plate 283 draws the knob end-on as a round boss on the curved handle, which the turned handle reproduces from the front.
  - The grip's x/y is unchanged, so the kinematic tests still hold.
- **Tests.** movement-283 passes 9/9. The new test checks that the knob is lathed, on the eye's axis, with eye r > 1.4 × foot, and its foot sunk into the eye face.
- **Screens.**
  - Edge mounts: 0 (was 1).
  - Disconnected parts: 0 detached, 0 slivers. There are 2 lips, both present before: the bearing bridge and the tube-into-handle-end lip, which is a 0.026 curvature overhang, unchanged from before.
  - Coincident faces: 0. Seams: 0.
- **Proposed ledger row.** Assessment unchanged. Limits to append: "p92: the curved handle ends in a round eye carrying the shared turned knob, centred with a 1.5× margin."

### 360 (`authored-oscillating-drum-ratchets.js`): beam pivot upright
- **Before.** The upright was a box ending at the beam's pivot axis, so the pin sat on its square top (ratio 0).
- **Change.**
  - The upright is now one flat extrusion in the same plane and depth (z −0.51…−0.17).
  - It is 0.30 wide, and its top is a semicircle concentric with the pin: r 0.15 against the pin's r 0.095. This is Brown's round-topped post.
  - The old box also had rounded joint spheres; these are gone.
- **Tests.** movement-360 passes 9/9. The new test checks that the upright's top is an arc about the pin, with radius > 1.4 × the pin radius.
- **Screens.**
  - Edge mounts: 0.
  - Disconnected parts: 0 detached. Lips went from 1 to 0 (the old box/sphere lip).
  - Coincident faces: 0.
  - Seams: the existing 0.87% mid-cycle motion jump in the pawl/drum is identical before and after, so it is unrelated.
- **Proposed ledger row.** Assessment unchanged. Limits to append: "p92: the pivot upright is one extrusion with a round top concentric with the beam pin."

### 366 (`authored-treadle-drills.js`): treadle and upper-lever left ends
- **Before.** Both levers' boxes ended at the link-pin axis, so the pin sat on the square end (ratio 0).
- **Change.**
  - Each lever's single extrusion now also has a round eye at its left end: r 0.095 about the 0.06 pin. This is Brown's round lever ends.
  - The eye is kept just inside the vertical link's own 0.099 eye, so no orange sliver shows past it.
- **Tests.** movement-366 passes 8/8. The new test checks that the treadle's end is an arc of 0.095 about its link pin.
- **Screens.**
  - Edge mounts: 0.
  - Disconnected parts: 1 near-miss detached group (the crank handle), 4 lips and 3 coincident pairs, all identical before and after.
  - Seams: 0.
- **Proposed ledger row.** Assessment unchanged. Limits to append: "p92: the treadle and upper lever end in round eyes about their link pins."

The camera-catalog test passes for all 507. No saved validation report or bake fingerprints these three files.

### Sub-lane G: edge-mounted pins in 185, 281, 357, 401 and 421

**Claims.** Claimed under p92-h: `authored-dead-center-cranks.js`, `authored-anderson-governors.js` (not edited), `governor-274-357-parts.js`, `authored-grooved-disk-followers.js` and `authored-trunk-engines.js`. `authored-locomotive-valve-gears.js` was already held by p92-h.

**Originals and captures.**
- Originals: `/dev/shm/p92/h/G/*.orig`.
- Captures: `/dev/shm/p92/h/G/tile-<id>.png` (top row before, bottom row after: default view, zoom, oblique zoom; plate beside). All five are stacked in `G/all.png`.

**Fixes.** Each carrying part now has a round end or eye concentric with its pin, made in its single extrusion.

| ID | Part changed | Before | After | File |
|---|---|---|---|---|
| 185 | Rocker's lower arm, carrying the die pin | Box beam (`makeBeam`), 0.12 thick, ending at the 0.085 pin's axis | One flat extrusion with an eye of r 0.14, bored 0.089, round the die pin; its root is buried in the rockshaft. Brown draws the rocker end round. | `authored-locomotive-valve-gears.js` |
| 281 | Offset bracket carrying the groove follower pin | Box beam 0.13 wide, narrower than the 0.075 pin, ending at the pin axis | One flat plate, z ±0.12, with an eye of r 0.13 round the pin. In the default view it is hidden by the pin head, as Brown dashes it. | `authored-grooved-disk-followers.js` |
| 357 | Casing lug under lever N's fixed pivot | Box ending at the pivot pin's axis | One extrusion with a round top, r 0.13, concentric with the 0.07 pin. The lug is built in the 274/357 parts pass, so `authored-anderson-governors.js` is unchanged. | `governor-274-357-parts.js` |
| 401 | Treadle rocker | Tapered plate ending square, half-width 0.065, at the 0.09 pitman pin | Round eye of r 0.14 round the pin, in the same extrusion. Brown's treadle is rounded at the joint. | `authored-dead-center-cranks.js` |
| 421 | Crank throw | Box ending at the 0.085 crank pin's axis | One flat lever: the hull of a r 0.19 boss on the shaft and a r 0.15 eye on the pin, as Brown draws the crank. Same z slab, −0.295…−0.105. | `authored-trunk-engines.js` |

**Tests.**
- movement-185, 281, 357, 401 and 421 all pass (32 tests).
- The solids tests also pass: governor-274-357-solids, movement-274, cam-281-286-solids (18 tests); dead-socket-cradle-solids, engine-guide-solids, steam-engine-working-solids (15 tests).
- No test assertions were added. No saved validation report or bake fingerprints these files: `grep` finds only `scripts/lib/movement-batches.mjs`, which only names the file.

**Edge-mount screen** (`G/edge.json`).
- The targeted pins are now clear: 401, 281, 421, the 357 lever-N pivot and the 185 die pin.
- Two pairs are still flagged, and neither is in this directive's scope:
  - 185 `fixed-reversing-handle-axis` against the handle bar (ratio 0.375). Sub-lane E added a boss here; the screen measures the bar mesh.
  - 357 `tangential-hinge-trunnion-rigid-with-piece-B` against the open hinge frame (ratio 0.548). Not reviewed.

**Other screens.** None of the remaining findings involves a changed part.
- Loop seams: 0 on all five.
- Coincident faces:
  - 281: two brace/bearing pairs.
  - 401: a 1.2e-5 volute-spring/faceplate patch.
  - 185, 357, 421: 0.
- Disconnected parts:
  - 281: two near-miss groups bridged across the lever-pivot and disk-shaft bore clearances (0.012), plus a brace lip.
  - 357: a near-miss on circle G/frame H and a sliver on the casing/foot.
  - 185, 401, 421: 0 detached, 0 slivers, 0 lips.

**Proposed ledger rows.** Keep each ID's assessment. visibleFlaws is unchanged. Append to limits:

| ID | Text to append to limits |
|---|---|
| 185 | "p92: the rocker's lower arm ends in a round eye about the die pin." |
| 281 | "p92: the follower pin's bracket ends in a round eye about the pin." |
| 357 | "p92: lever N's casing lug has a round top concentric with the pivot pin." |
| 401 | "p92: the treadle ends in a round eye about the pitman pin." |
| 421 | "p92: the crank is one round-ended flat lever (boss on the shaft, eye on the pin)." |

**Seen, not fixed.**
- 185 still has a white index sphere on the rocker pin (`white-index-on-die-rocker-pin`) and another on the die. White parts are against the user's rules.
- 421's crank is now the pitman's yellow, as before; the old box was the same colour.

