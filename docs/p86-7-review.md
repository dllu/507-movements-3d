# Pass 86 lane 7: sliver joints

Reviewer: Claude Opus 5.5, lane p86-7. Date: 2026-09-27.

This lane fixes the sliver and lip joints that `docs/p86-5-sliver-screen.md` found in 154, 159, 167, 276, 312, 347, 361, 385 and 400. Each fix changes only the join: a sunk shank, a bored or bedded seat, or a pad under a stem. No drawn outline changed, and no new visible part was added.

## Where the fixes went

For three IDs the brief named files that the browser does not load. `model-loader.js` routes these IDs elsewhere, and the sliver screen measures what the browser loads:

| ID | File named in the brief | File the browser loads (edited) |
|---|---|---|
| 154 | `authored-stud-drives.js` | `baked/weighted-bell-crank.js`, the presentation layer over the baked bundle |
| 159 | `authored-cranks.js` | `baked/cord-treadle.js` |
| 167 | `authored-groove-drums.js` | `reversing-groove-drum.js` |

Consequences:
- The authored registry versions of 154, 159 and 167, used by `engine.js` and the offline reviews, are unchanged.
- For 154 and 159 the change is presentation only, so there was no rebake. The bundles, the physics and the provenance are untouched.

## Evidence

**Screens** (outputs in `/dev/shm/p86/p86-7/`):
- Before: `before/ID.json`. After: `after/ID.json`.
- Each came from `node scripts/screen-disconnected-parts.mjs --ids=ID --out=…`.
- `summ.py` lists the flagged rows; `nmdiff.py` diffs the near-miss pairs.

**Captures:**
- `caps-before/b-ID-*-tile.png` and `caps-after/a-ID-*-tile.png` repeat the p86-5 tiles: default view, zoom, and two rotated zooms at phase 0.035.
- `caps-cust/{b,a}-ID-joint-tile.png` are tight joint zooms from 4–5 angles. They include back views, and for 276 the cam is hidden.
- The "before" set was made from the HEAD versions of the edited files, on a restarted dev server.

**Other checks:**
- Intersections: `isect-after.json` / `isect-361.json`.
- Loop seams: `node scripts/check-loop-seams.mjs --ids=154,159,167,276,312,347,361,385,400` found 0 seams. 347's steam-volume pop was already there and is unrelated.
- Camera fit: the catalog camera-fit test, restricted to the nine IDs (`camera-mine.test.mjs`), passes.

## Per movement

### 154 — weight eye on the ball
- **Before:** flagged `cap` (score 0.60). The baked eye's lower rim (y 0.504) stood on the crown of the 0.504 ball (`b-154-joint-tile.png`).
- **Change:** in `sinkWeightEye`, a lathe shank in the eye's material. It rises from 0.10 inside the ball (0.40), with a fillet at the crown, into the eye rim (0.545). The eye and the cord attachment are unchanged.
- **After:** no sliver (`a-154-joint-tile.png`).

### 159 — cord pin on the treadle
- **What the screen actually measured:** the black cord pin standing on the bar's front face by its flat end (r 0.055).
- **The lower ring:** it is not tangent. The bake already carries it on a 0.13-wide neck, merged into the treadle mesh; the back view in `a-159-joint-tile.png` shows it.
- **Change:** the pin shank continues back through the bar, z 0.06–0.30 (`cord-pin-shank-through-treadle`). It is hidden inside the bar, and nothing visible changes.
- **After:** no sliver.

### 167 — stud seat on the rod
- **Before:** `narrow-neck` (0.69). The flat seat touched the round rod along one line.
- **Change:** the seat box now runs from 0.742 to the rod axis (1.05). The rod passes through its back, and the seat's corners stay inside the rod.
- **After:** no sliver. From the front the seat overlaps the rod's left edge by about 0.06 (`a-167-joint-tile.png`; the top view shows the rod passing through it).

### 276 — rod lip on the yoke
- **Before:** lip. The 0.56 round run entered the 0.25-thick yoke plate and overhung both faces by 0.155 (`b-276-joint-tile.png`, cam hidden).
- **Change:** the yoke plate is now as deep (`yokeDepth` = 0.56) and as tall as the rod, so each run's end sits wholly inside the yoke section. It is still hidden behind the cam in the plate view.
- **After:** the rod-run lip is gone.
- **Residual:**
  - Two small yoke-into-run lip rows remain, at 0.06–0.086. They were present before at 0.05–0.074. They are the eye capsule's rounded end (0.34 radius) standing just proud of the 0.28 rod, a boss shoulder.
  - The cam hub now clears the thicker yoke by 0.068, a new near-miss pair between running parts.

### 312 — pallet-face stems
- **Before:** both stems met their arms at a corner (0.44). The crosspiece stroke ended butt-square through the stem centre.
- **Change:**
  - Each arm gets a round pad (r 0.095) under the stem.
  - The stem's z0 goes from 0.05 to 0, so it is sunk into the arm.
  - The swept-cut outlines were rebaked with `node scripts/generate-gravity-escapement-plates.mjs 312`. Only the 312 entry changed; 309–311 are byte-identical.
- **After:**
  - No sliver.
  - Intersections: worst solid 0.
  - The stems stay swept-cut by the pallet wheel, as before.

### 347 — output-shaft bearing on its standard
- **Before:** `small-patch` (0.95). The ring's lowest line sat on the standard's flat top.
- **Change:** the standard's top rises 0.12 into the ring's lower rim and stays 0.07 clear of the shaft. It is now 0.28 × 0.56, within the ring's 0.30 length and its chord at the entry, so no corner or coplanar face stands out (0.30 wide showed z-fighting).
- **After:** no sliver. There is no new lip; the remaining one on the sectioned standard is the known false positive.

### 361 — radial pin on the lower shaft
- **Before:** `narrow-neck` (0.94). The pin's flat end stood on the shaft.
- **Change:** after `correctAxialPinParts` sets the pin's working length, the 361 factory lengthens the pin downward to the shaft axis. Its working tip is unchanged.
- **After:** no sliver. The saddle-shaped intersection is visible (`a-361-joint-tile.png`).

### 385 — weight neck on the pear
- **Before:** `narrow-neck` (0.33).
  - The lathe profile was open at both poles.
  - The 0.09 neck stood on the open 0.09 top rim, and its dark underside showed from below (`b-385-joint-tile.png`, last view).
- **Change:**
  - The profile is closed on the axis, so the bulb is solid.
  - The neck stays centred and is lengthened to 0.23, sinking 0.10 into the bulb.
- **Follow-up (coordinator):**
  - The working-parts pass (`door-closer-working-parts.js`) moves the eye 0.15 along the lower pin, clear of the suspension plate, and the neck 0.13. That left the neck standing half off the bulb, which is the "partly off" step.
  - The 385 factory now centres the bulb, neck and height index under the eye, then refits the camera bounds.
- **After:**
  - No sliver.
  - The weight hangs by a solid chain: link → transverse pin → eye → centred neck → bulb (`caps-cust/a-385-chain-tile.png`, five angles).
  - The link's bored lower end rides on the pin through the eye. Its end sits 0.086 above the bulb top, a running clearance and not a gap in the chain. Joining the link to the bulb would add a load path the pin already provides.
  - The pin retainer clears the bulb by 0.08.
  - Intersections: worst solid 0. Camera fit and seams pass.

### 400 — pad ball under feed bar B
- **Before:** `small-patch` (0.73). The ball's top met the bar's underside at a point.
- **Change:** a 0.055-radius stem (`underside-pad-stem-set-into-bar-B`) runs from the bar's mid-plane down to the ball centre.
- **After:**
  - No sliver.
  - The stem stays inside the ball wherever the cam can reach. The closest approach is 0.041, a new near-miss row with no contact.
  - A dense intersection screen (384 samples) found no solid overlap.
  - A capture with the stem hidden differs only in the short neck band between the bar and the ball (`caps-cust/a-400-phases-*-tile.png`, `a-400-hide-stem-0.png`). The stem never shows below the ball's crown, and the cam cannot reach it without first penetrating the ball.

## Tests

The new file `tests/sliver-joints-p86-7.test.mjs` asserts each joint on the production models (9 pass).

All of these also pass:
- `cam-272-276-solids`, `cord-treadle`, `cord-treadle-baked` and `weighted-bell-crank-baked`
- `door-closer-working-solids`, `four-motion-feed-solids`, `gravity-escapement-working-solids` and `one-way-clutch-working-solids`
- `movement-276`, `-312`, `-347`, `-361`, `-385` and `-400`
- `reversing-groove-drum`
- the `models.test` cases for 154, 159 and 167

No IDs moved between factories, so the routes were not regenerated.

## Proposed ledger rows

The assessment and visible-flaw text are unchanged unless noted. Append to each row's limits:

| ID | Append to limits |
|---|---|
| 154 | "p86: the eye stands on a tapered shank filleted into the ball (presentation layer; bundle unchanged)." |
| 159 | "p86: the cord pin's shank runs on through the treadle (presentation layer); the lower ring hangs on the baked neck." |
| 167 | "p86: the stud seat runs into the rod to its axis, so it overlaps the rod's near edge by about 0.06 in front view." |
| 276 | "p86: the hidden yoke is as deep and tall as the round rod; the eye's rounded ends stand 0.06–0.09 proud of the rod runs." |
| 312 | "p86: each pallet-face stem is sunk into a round pad on its arm; plates rebaked." |
| 347 | "p86: the output bearing ring is bedded 0.12 into its standard's top." |
| 361 | "p86: the radial pin is set into the shaft down to its axis." |
| 385 | "p86: solid bulb, centred under its eye on the lower pin; the neck is sunk 0.10 into it." |
| 400 | "p86: the pad ball hangs on a short stem set into bar B." |

159's existing minor flaw (the slack cord) stays. The others keep "reasonable", with no visible flaw.
