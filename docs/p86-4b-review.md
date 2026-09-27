# Pass 86, lane 4b: pawl sweep (181–184, 253, 277, 278, 280, 321, 360, 370, 389, 390, 401, 415, 478, 491)

Reviewer: Claude Opus 5.5, lane p86-4b (with three forked sub-lanes). Date: 2026-09-27.

This lane checked every pawl, click, catch, stop and detent in the IDs above against the pass 86 brief. The brief asks
for simple smooth 2D extrusions with a bored boss. The tip must match the valley and sit in the root at the hold, with
modelled backlash. There must be no extra pins, protrusions or flimsy joints, and the rake and outline must follow the
plate.

Captures are in `/dev/shm/p86/p86-4b/` (outside Git):
- `before/tile-ID.png` and `after/tile-ID.png`: the plate, then phases 0/0.25/0.5/0.75, ±60°, back, top and the seam
  phases.
- `z/`: pawl zooms at several phases.
- `fa/` (280, 360, 390), `fb/` (321, 370) and `fc/` (253, 277): the sub-lanes' before/after captures and 2D contact
  plots.

Contact screens are in the same directories (`278-*.json`, `fa/isect-*.json`, `fa/disc-*.json`, `fb/321-*.json`,
`fc/*.json`).

## Fixed

### 278: the pawls barely entered the teeth, and the guides floated
- **Before** (`z/t278.png`):
  - Each pawl d was a square-ended bar that reached only 0.048 past the tooth tips of a 0.30-deep tooth, so it caught
    almost tip to tip.
  - The teeth were separate black blocks at twice Brown's pitch and three times his depth.
  - The grey pawl guides touched neither the pawl (0.06 each side) nor the platform. The disconnected screen reported
    4 detached parts.
  - The pawl rode 0.037 up and down between the guides as the lever arc moved its pin.
- **Plate:** the upright profile gives a pitch of about 22 px (0.264) and a depth of about 8.5 px (0.10). Each tooth has
  a flat seat under an undercut that slopes back to the root over most of the pitch.
- **Change** (`authored-safety-stops.js`, `tests/movement-278.test.mjs`):
  - The rack is Brown's continuous sawtooth, cut in upright A's material, 24 teeth a side.
  - Each pawl reaches the root (toe 0.004 from the root face, underside on the seat). Its toe is a short square face and
    a chamfer parallel to the undercut above, so the tip has the valley's angle.
  - The pawl now slides level. The lever pin rises in a short vertical slot in the bored eye; no pin was added.
  - The guides are cheeks on each leg's front face with 0.004 running clearance.
  - The spring release lags the free fall (smootherstep over the second 55 % of the drop), so the toe enters only
    below the undercut. A polygon sweep over 1600 poses finds no pawl/tooth overlap.
- **After** (`after/tile-278.png`, `after/zoom-278.png`):
  - 0 detached parts. The worst solid overlap is the spring's own 0.015 self-overlap, as before. 0 seams.
  - The rate test now uses Richardson differences, because the lagged release has a large third derivative.

### 280: ball-tipped rods on a hidden ratchet (sub-lane fa)
- Brown's two straight links are now flat bored holding pawls, as broad as the coupler, with chisel noses fitted to the
  valley of the inferred rear backstop.
- They alternate on half-tooth strokes. Each stroke overshoots 0.0055 rad, and the wheel then slips back onto the seated
  nose.
- Lift comes from a baked least-clearance table (`scripts/generate-friction-windlass-backstop.mjs`).
- Screens are clean. Captures: `fa/after280/`.

### 360: stick pawl that never seated (fa)
- The pawl is one flat bored link with a chisel nose on the radial face. It drives from the root.
- In overrun it rides each tooth back and slides into the root before capture, taken up by the flywheel's coast.
- The baked lift table lives in `oscillating-drum-pawl-data.js`. Captures: `fa/after360/tz.png`.

### 390: wire pawls with an extra stop pin (fa)
- There are now two identical curled bored pawls (arc bands) with chisel noses in the V root. The stop pins are
  removed.
- The drop is finite-rate, and carrier overtravel is the backlash.
- The validation-only MuJoCo study still models the old toe. Captures: `fa/after390/`.

### 321: wire clicks with round tips (sub-lane fb)
- T and R are finite bored plates on saw ratchets, with the nose end cut along the tooth face.
- B's ratchet has Brown's 18 teeth.
- Winding opens with the larger ratchet slipping back 0.08 pitch onto T. B is wound 0.12 pitch past R and drawn back
  onto it.
- The new shared helper is `seated-ratchet-click.js`. The `maintaining-clock-clicks.js` bake was regenerated, and 320's
  entry is byte-identical.
- Captures: `fb/cmp321.png`, `fb/after321/`.

### 370: hidden thin click band (fb)
- The click is a dark bored J-hook on the carrier eye, with its nose turned back into the root of a 12-tooth saw
  ratchet.
- There is 0.12 pitch of carrier backlash.
- The eye sits at the model's carrier pivot, so the hook is shorter than Brown's. Captures: `fb/after370/`.

### 277: Y-shaped dog (sub-lane fc)
- Dog a is one smooth tapered finger with a bored eye. Its flat chisel top is the working face on the radial tooth face,
  and it indexes exactly 60° per cock.
- The square arbor lug became a small round boss.
- The finger ends at the tip, about 67 px short of Brown's upper end. This is the known geometric limit: a page-plane
  dog can turn the face ratchet only near the axis.
- Captures: `fc/t277a.png`, `fc/tile-277.png`.

### 253: hooks read as bars stuck on a big pin (fc)
- Each hook has a visible bored eye boss (eye 0.36, bore 0.155) on a 0.145 pin and is forged-steel coloured.
- The barb moved 0.06 inward, so stud D sits in the crook: it touches the bar face, 0.0055 from the barb.
- Captures: `fc/t253a.png`, `z/t253f.png`.

## Checked, no change

- **183/184:** no ratchet pawl. The quadrants bear on each other through hidden studs and a lip inside the drawn
  outlines. The curl matches the plate (`z/t183.png`).
- **389:** both curved pawls already seat in the tooth roots and follow the plate's outline (`z/t389f.png`). The known
  undrawn rear spine and the eccentric-throw residual remain.
- **401:** the stop is a plain block that the slide end bears on in the dwell (`z/t401f.png`).
- **415:** friction pawls B and C are smooth bored blades that bear on the smooth inner rim when selected
  (`z/t415.png`). Brown draws no teeth.
- **478:** stop screw b bears on stop c (`z/t478.png`).
- **491:** the bored curved dog sits in the root against the steep face at the hold and matches Brown's
  (`z/t491f.png`, `z/plate491.png`).
- **181/182:** the catch body is one smooth extrusion, but the handles meet it through finite fingers on rear plates and
  axial webs (`z/t181r.png`, `z/181upper.png`, `z/181lower.png`). These are depth offsets the brief discourages. The
  catch and handles overlap in the drawing, so they cannot share a plane. Removing the webs would need a new MuJoCo
  transfer study and bake, and earlier trials failed their returns. This is left as a disclosed limitation.

## Tests

- Tests passing:
  - `movement-253`, `-277`, `-278`, `-280`, `-321`, `-360`, `-370`, `-390`
  - `release-mechanism-working-parts`, `lifting-check-hook-working-parts`, `friction-family-working-solids`
  - `dual-band-390-contact`, `polishing-interfaces`, `movement-320`, `camera-catalog`
  - Run by the sub-lanes: `one-way-clutch-working-solids`, `movement-419`, `dual-band-native-study`,
    `maintaining-clock-*`, and the 213/225/233/236 contact tests.
- Loop seams for all 17 IDs: 0 seams, 0 pops, 0 errors.
- `models.test.mjs` currently fails on movement 65, which is outside this lane.
