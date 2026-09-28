# Pass 88 lane s: steam seams and flicker in 347, 418 and 425–429

Reviewer: Claude Opus 5.5, lane p88-s. Date: 2026-09-27.

Scope: the coincident-face findings in `docs/p87-z-coincident-screen.md` for 418 (valve seat against the port steam), 427 (cylinder against the steam), and the steam seams in 425–429 and 347. Scratch files and captures are in `/dev/shm/p87/p88-s/` (outside Git).

## What the screen was measuring

Most of the seam area the screen reported for 425–429 and 347 came from stale buffers, not from what is drawn. `steamVolume` (and 347's own cell builder) writes each frame's triangles into a fixed-capacity buffer and shortens `drawRange`; triangles from earlier, larger frames stay in the buffer past the draw range. The screen snapshots the whole position buffer (`snapshotGeometry` ignores `drawRange`), so it compared the current volume with leftovers from earlier phases. That produced most of the large "same-mesh" seams: 426 `lower-chamber-...-A-1` alone was 0.12 × diag², and 425 `D-to-the-contact-line` / `contact-line-to-D` was 0.113.

The visible defects under that noise were real, and are what this lane fixed:

| ID | Visible defect | Cause |
|---|---|---|
| 425, 426, 427 | A steam sheet across each neck or channel mouth | The working-space steam and the channel steam were separate closed volumes, each with a wall on the shared bore arc. |
| 428 | Denser steam in both admission mouths, and a folded sliver | Near each clamp, the sampled span ring folded over itself and out into the channel, overlapping the channel volume. |
| 429 | Two sheets 0.012 apart across each throat | The working space is shrunk 0.012 from the bore, and the channel volumes ended at the bore. |
| 347 | Each side's steam split into live and eduction cells across its widest section, with a sheet there; double sheets lying on the cones | The pinch azimuth was assigned to the wrong side of the disk (half a turn out). The collapsed cells near the pinch emitted coincident disk and cone faces. |
| 418 | Stair-stepped flicker at the three port mouths (screenshot x-418) | The port steam's top face lay on the seat's top face in front of the ports (z 0.30–0.47). |
| 427 | Flicker at the inner corner of each neck mouth, and along the crescent tips at the contact line | Cutting the casing by the channel polygons, which share the bore's edges, left a zero-area spike along the bore chord at each mouth. The crescent tips thin to nothing against the bore. |

## Fixes

### Shared kit (`src/simulation/steam-section-kit.js`, additive only)

- **`steamVolume(role, z0, z1, { sealed: true })`.** Opt-in. After each `setRegion` it zeroes whatever earlier frames left past the draw range, so the buffer holds only the drawn volume.
- **`steamEdgeIndex(regions)`.** A grid index of region boundary edges, each oriented with its region on the left. `uncovered(a, b, ring)` returns the stretches of edge a–b that no other ring runs back along (tolerance 1e-5). Partial overlaps are handled: a bore chord that is half inside a channel mouth keeps only its uncovered half.
- **`setSteamRegions(entries)`.** Sets several volumes in one pass and drops the side walls shared with an abutting region. Each connected body of steam is then bounded by one closed surface. The pieces' shades meet edge to edge on the front and back caps, so pressure colouring per piece is unchanged. Regions too small to draw (area < 1e-4, or visibility ≤ 1e-3) do not open their neighbours' walls.
- **`setRegion(multi, pressure, visibility, { shared })`.** Takes the index. Without it, the wall loop is the old code path.

**Other kit users are byte-identical.** 421–424 are the kit's only other users. I hashed every mesh's attributes, index, draw range, groups, world matrix and material state at 12 phases, before and after (`fingerprint.mjs`):

| ID | Hash, before and after |
|---|---|
| 421 | `93f653415c0ef887` |
| 422 | `4a64e5e3f7f33ef0` |
| 423 | `3d43c734cd1cf83b` |
| 424 | `77745c57708a1dfd` |

### 425 (`authored-eccentric-rotary-engines.js`)

- All four volumes are sealed.
- The necks are set with the crescent pieces through `setSteamRegions` each frame. Before this they were set once at build.

### 426 (`authored-radial-piston-rotary-engines.js`)

- All eight volumes are sealed.
- The channel regions are kept in `userData.steamChannel` and set each frame, together with the chamber bodies.

### 427 (`authored-eccentric-shaft-radial-piston-engines.js`)

- **Seal.** Sealed and set together, as in 425.
- **Casing spike.** The casing is now cut by the whole channel rectangles (the same cavity). Before, it was cut by `rect − bore`, which left the zero-area spike at each mouth's inner corner.
- **Crescent tips.** The tips are cut at |x| = 1.45, where the hub-to-bore gap is 0.025 (about 1e-3 × diag). The old cut was a 0.015 half-width splitter at the contact line. The steam's hub-side face therefore never lies within the depth tolerance of the bore.

### 428 (`authored-rubber-lined-rotary-engines.js`)

- **Span outline.** Each span's sampled ring is now resolved (`union`), clipped to the cavity outline (the star region), and cleaned of pieces under 1e-6 in area. The span no longer folds into the channel or counts area twice.
- **Channels.** The channels are sealed and set with the spans each frame.
- **Area change.** The span areas in `steamReport` change slightly where the fold used to subtract area. For example, at phase 0.3 the roller-2 span went from 0.1359 to 0.1398.

### 429 (`authored-double-elliptical-rotary-engines.js`)

- **Throat.** The channel steam now runs down to the working space's own outline (`rect − workingSpace`), across the 0.012 strip in each mouth, so a throat piece and its channel share an edge and are sealed. The casing (`portChannels`) is unchanged.
- **Validation report.** `docs/validation/429-mating-contact.json` was regenerated with `scripts/export-holly-contact.mjs` and `scripts/review-holly-contact.py`. The pose count stays at 1025 and every metric is identical; only this file's source hash changed.

### 347 (`authored-disk-engines.js`)

- **Pinch assignment.** Side +1 is now pinched at φ = ψ + π and side −1 at φ = ψ. I measured the cells' thinnest azimuth at 8 phases: before the fix it was always `pinchU + 180°`; now it equals `pinchU` (`dbg347b.mjs`). The live/eduction split, and the 24° blowdown after the pinch crosses the diaphragm, now happen at the pinch, as the file's own comment describes.

  The disk's motion is unchanged. Which cell shows live steam at a given phase has changed, correctly.
- **Collapsed faces.** Disk- and cone-face triangles whose three corners have collapsed onto the cone are dropped. They bounded nothing and were drawn twice.
- **Stale buffer.** The cell buffers are cleared past the draw range each frame.

### 418 (`authored-valve-relief-guides.js`)

- The port columns' steam now stops at `seatTop − 0.01` (1e-3 × diag). It no longer lies on the seat's top face.
- The 0.01 step between the chest steam and the port steam sits inside the port mouth. It is not visible at any capture zoom.

## Screen before and after

Command: `node scripts/screen-coincident-faces.mjs --ids=347,418,425,426,427,428,429`. Areas are × diag². The "after" column is the same at `--phases=16`.

| ID | Before: fights | Before: seams | After |
|---|---|---|---|
| 347 | 0 | 3 (0.039 same-mesh, 0.0097, 0.0096) | 0 fights, 2 seams (2.4e-4 each, see below) |
| 418 | 3 (seat / left port 6.1e-4, seat / right port 6.1e-4, seat / exhaust port 4.2e-4) | 0 | 0 |
| 425 | 0 | 3 (0.113, 0.0048, 0.0048) | 0 |
| 426 | 0 | 5 (0.24, 0.12, 0.092, 0.059, 0.0195) | 0 |
| 427 | 3 (cylinder / steam-ahead 5.4e-4, cylinder / steam-behind 2.8e-4, cylinder / eduction neck 2.5e-4) | 5 (0.061, 0.047, 0.022, 0.012, 0.0046) | 0 |
| 428 | 0 | 6 (8.8e-4 ×2, 6.3e-4 ×2, 8.3e-5, 6.1e-5) | 0 |
| 429 | 0 | 5 (0.055, 0.053, 0.051, 0.028, 0.0011) | 0 |

The raw outputs are `/dev/shm/p87/p88-s/before.json`, `after.json` and `after16.json`.

**Remaining 347 flags: a false positive.** Each is 5 opposite-facing triangle pairs on one cell, beside its pinch. They are the disk face and the cone face of the closing wedge, where the cell is thinner than the screen's 1.6e-3 tolerance. The two faces bound a real, tapering volume: they are its front and back, not a duplicate sheet. Exact duplicates are now zero; the new test asserts it.

## Captures

Tiles are in `/dev/shm/p87/p88-s/cmp/`, each with before (HEAD) on the left and after on the right. They were rendered from two dev servers: HEAD on 5882 and the working tree on 5881 (`shots.mjs`, `jobs.json`).

- **Default views** (phases 0.05, 0.3, 0.55, 0.8) and a rotated view for every ID: `ID-dNN.png`, `ID-rot30.png`. The views are unchanged apart from the steam fixes.
- **425:** `425-zin*.png` and `425-zed*.png`. The bright sheet across the inlet mouth is gone and the steam runs straight up the neck.
- **426:** `426-zli*.png`. There is no sheet where the bent induction channel meets the chamber.
- **427:**
  - `427-zed05.png` / `427-zin*.png`: the mouths.
  - `427-ztop30.png`: the crescent tips at the contact line now end short of it.
- **428:** `428-zrl*.png`. The double-density patch in the right-lower admission mouth is gone.
- **429:** `429-ztop*.png`. The sheet across the top throat is gone. At zoom 5, a hair-thin edge shows at each mouth corner where the 0.012 strip ends. That strip is the steam's standing clearance from the bore, as elsewhere in this engine.
- **347:**
  - `347-zrot*.png`: the live and exhaust cells now meet at the pinch.
  - `tile-before-347.png` and `tile-after-347.png`: the default views.
- **418:** `418-zseatL*.png` and `418-zseatR*.png`. The stair-stepped streaks at the left and right port mouths are gone.

## Tests and screens

- **New test file: `tests/steam-seams-p88-s.test.mjs`** (9 tests, all pass). It covers:
  - the kit's wall dropping and tail clearing;
  - for 425–429 at 24 phases:
    - no two steam walls face each other on one line (no internal sheet);
    - no point is covered by two front caps (no double density);
    - no stale triangles are left past the draw range;
  - 427: no zero-area spikes in the casing outline, and no steam where the hub lies within 0.025 of the bore;
  - 418: the port steam stops more than 5e-4 × diag below the seat top;
  - 347: no duplicated faces, and each cell is pinched (latitude span < 0.02) at its split.

  Run against a HEAD copy with the new kit, 8 of the 9 fail on the old engines. The 429 throat's double sheet (0.012 apart) is not coincident, so there 429 fails on its stale buffer instead.
- **Targeted suite, all passing (331 tests).** These are the 35 files covering the steam engines, the rotary engines, the valve families, 418–430 and 347/348, `models`, loop-seams, the screens, `holly-mating-profile`, sliver and faces.
- **`check-loop-seams --ids=347,418,425-429`.** Unchanged from HEAD: 1 above tolerance (428's existing `periodMismatch` 0.059), with the same mid-cycle steam pops.
- **`screen-disconnected-parts`.** Identical to HEAD for all 7 IDs: no detached parts, slivers or open ends, and the same near-miss counts. 347's one lip is the same as before.
- **`screen-body-intersections`.** Worst solid depth is 0 for all 7 IDs. At HEAD, 425 ran out of memory and 429 timed out; they now complete.

  The open-mesh lists grew only by steam volumes, as intended: each sealed volume is open where it joins another. The screen treats fluids as non-targets.

## Proposed ledger rows

Every assessment stays `reasonable` and `visibleFlaws` stays empty. The fixes removed visible flaws the ledger had not recorded, and added none.

| ID | Append to limits |
|---|---|
| 347 | p88: the live and eduction cells now split at each side's pinch (it was half a turn out). Faces collapsed onto the cones are dropped. The coincident-face screen leaves only the closing wedge beside each pinch, below its tolerance. |
| 418 | p88: the port steam stops 0.01 below the seat's top face, so it no longer flickers on the seat in front of the ports. |
| 425 | p88: the crescent and neck steam are sealed into one volume at each mouth, with no sheet across it. |
| 426 | p88: the chamber and channel steam are sealed into one volume at each mouth, with no sheet across it. |
| 427 | p88: the neck and crescent steam are sealed at the mouths; the casing's zero-area spikes at the mouth corners are removed; the crescent tips stop where the hub-to-bore gap is 0.025. |
| 428 | p88: the spans are clipped to the cavity, so steam no longer folds into the admission channels and is not drawn twice; the spans and channels are sealed at the mouths. |
| 429 | p88: the channel steam reaches the working space's outline across the 0.012 mouth strip and is sealed to it. A hair-thin edge shows at each mouth corner at close zoom. |

Reviewer attribution: Claude Opus 5.5 (p88-s). No production MuJoCo use; the steam remains scripted display. Intersection scope: the coincident-face, body-intersection and disconnected-parts screens for these 7 IDs.

## Not fixed / noted

- The same stale-buffer artefact affects the coincident-face screen for 421–424, which use the unsealed `steamVolume`. They were kept byte-identical as required. Opting in is one flag each, plus `setSteamRegions` where their volumes abut.
- An alternative fix is for the screen itself to honour `drawRange`. The screen is outside this lane.
- 429's induction and eduction channel steam still ends 0.01 above the neck tops, which is pre-existing and was not changed.
