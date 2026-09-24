# Lane m15-final: last minor residuals (208, 384, 504, 269, 277)

Pass-51 minor-residuals lane. For each ID this lane tested the fresh idea from the brief, plus other
constructions, against the notes of m8, m9, m12, m13 and m14. Captures came from a private
non-watching Vite server (port 44339) using `review-movement-source-views.mjs`. They are kept in
`/dev/shm/m15` and are not in Git. Intersections were screened with
`show-body-intersections.mjs ID --spacing=0.01 --samples=129`.

**Outcome: no production file changed.** Each idea either does not help or is blocked by
geometry. The reasons are measured below. One 208 experiment was built, measured and reverted.

Baseline screen (unchanged):

| ID | Result |
|---|---|
| 208 | known: middle-ring pin × pinion web 0.0523 (also 0.0344, 0.0160; outer-ring pin 0.0124) |
| 269 | clear (2 bodies) |
| 277 | clear (5 bodies) |
| 384 | clear (3 bodies) |
| 504 | clear (6 bodies) |

Default-view extents (`maxNdc`): 208 0.84, 384 0.91, 504 0.90, 269 1.16 (the rod Brown breaks off
leaves the view, as intended) and 277 1.15 (the cylinder is broken off at the left edge, as on the
plate).

## 208: closing the slot ends (tried, reverted)

- **Experiment:** the pinion was split into axial bands, each cut by its own pin envelope. The
  outer 0.04 band (−0.055…−0.015) was cut only by the engaged ring's pins. This used a band-aware
  `export-208-pin-envelope.mjs` and `generate-208-pin-envelope.py`, and the web was a merged
  extrusion per band.
- **Result:** even in that band the engaged pins cut straight slots through the slot mouths, so the
  ends did not close. All the edits were reverted.
- **Why, measured with dense points along the pin surface** (not just the cap vertices), inside the
  tip circle (r ≤ 1.002) and near the slab:

  | Pins | Axial reach (pinion z; + toward the wheel centre) |
  |---|---|
  | Engaged ring, on the centre line | −0.082…+0.082 along the pin's whole length through the mouth (the pin stands radially in the slot) |
  | Engaged ring, off the centre line | drift inward to +0.30 (outer ring) and past +0.40 (inner ring) at the mouth |
  | Outer neighbouring ring | up to +0.089 when the inner ring is engaged; −0.014 when the middle ring is engaged |
  | Inner neighbouring ring | never inside +0.23 |

- **Outer end:** a closed outer end needs solid material at z < −0.09. The outer neighbouring ring
  sweeps through that region (−0.40…+0.09), and it already clips the present −0.055 face (the
  known 0.052).
- **Inner end:** a closed inner end needs solid material past +0.40. The inner neighbouring ring
  sits at +0.23.
- **Conclusion:** at every slot mouth, both ends lie in a pin path. Closed ends are impossible on
  these rings. This confirms m12 with measured reach, not the vertex-only estimate.

## 384: higher camera or a tighter fit (not changed)

- **Higher camera:** the arm's 1.5 turns sweep a horizontal circle of radius 5.03 about the point.
  From any direction, that circle projects to an ellipse whose major axis is its full diameter,
  drawn horizontally. Raising the camera shortens only the height. In the square source stage the
  width already sets the fit: the sweep is 10.06 wide, while the height is about 5.3 even at 20°.
  The frame therefore cannot get smaller.
- **Padding:** the fit box is the authored box intersected with the sampled sweep (x ±5.03,
  y 0.008…2.008, depth proxy ±1.05). Beyond the engine's generic 1.08 margin there is no padding
  (maxNdc 0.91).
- **Other options:**
  - A shorter screw would depart from Brown's proportions.
  - Turning the paper instead of the arm would lose the caption's wheel "revolving about the fixed
    central point".
  - An arc sweep was already rejected.

  Forced.

## 504: rest pose toward the viewer, or a wider fit (not changed)

- **Rest pose:** the fit covers the whole cycle, so a different t = 0 pose leaves the frame
  unchanged. With the arm toward or away from the viewer, B and E/F/G stack over A in the pure side
  elevation. The train reads as an overlapping jumble and loses Brown's pose. Rejected, since
  Brown's pose matters most.
- **Aspect:** the fit box already follows the swept silhouette (x ±4.07, y −1.59…0.70, depth proxy
  ±1). The stage is square and the silhouette is wide and short, so the width sets the fit (maxNdc
  0.90). No square box pads it.
- **Why no view helps:** the arm's full turn is a horizontal circle of radius 4.02, so no view
  direction narrows it (the argument given for 384).
- **Partial swing:** a partial swing would show the paradox, but the caption says the arm is
  "turned round", and the equivalent 384 arc was rejected.

  Forced.

## 269: tighter framing, closed end (not changed)

- **Fit:** the fit box (x −4.9…6.2, cameraDistanceScale 0.92) already covers only the frame's swept
  silhouette. The frame, 22 pitches long, travels 17 pitches, so the sweep is about 39 pitches
  wide. The rod leaves at the stroke limit, as Brown breaks it off. On screen the pitch is 19.3 px
  against Brown's 20.3 px. The subject is as large as the engraving's; it only fills less of the
  larger stage.
- **Closed end:**
  - Brown's four groups are contiguous from the open left end to 5 px short of his closed end
    (raster 35…335; the inner edge is at 340).
  - To roll the lower pair, the pinion centre must reach the last tooth's end. Its tip then lies a
    tip radius (about 3.1 pitches) beyond that point, while Brown leaves only 0.25 pitch.
  - Stopping the stroke one pitch early would half-use Brown's lower pair. It would gain only 1
    pitch (about 5% of framing), make the motion law asymmetric and need a relief rebake. Not
    adopted.
  - Shifting the teeth left is impossible, because the groups already start at the open end.

  Forced.

## 277: tilting the dog out of the page plane (not changed)

- **Tilt:** the tumbler turns about the page normal, so every dog point moves in a plane parallel
  to the page. A tilt only changes the dog tip's fixed depth d. The m8 bound (h ≤ L/√3 for a
  sixth) already takes the best d. A tilt that the side view cannot see cannot change the tip's
  visible height either.
- **Why Brown's tip cannot drive:** his tip sits (raster 130, 223) 2.66 units from the hammer pivot
  at 135°.
  - A 42.3° cock moves it (+1.75, +0.78): mostly away from the ratchet.
  - Keeping it on the face means the dog must swing back about 50°, which cancels most of that
    0.78 lift.
  - The hook near the dog pivot's height moves nearly vertically, which is why it works there. This
    is also where a Colt hand acts, beside the axis.
- **The only way out:** a dog tip that also travels about 0.7 in depth during the stroke, on an arc
  round the cylinder axis. That needs an undrawn skew hinge, and it would foreshorten the dog by
  about 10% in the side view. Not adopted.
- **Teeth:** deeper teeth still break the ride-back (m12).

  Forced.

## Proposed ledger text

- **208:**
  - (a) Unchanged. Default capture re-inspected: a wide slotted strip with dark slot bands running
    across it.
  - (b) known: the neighbouring-ring pin/web 0.0523 remains.
  - (c) visibleFlaws: "Brown's slots are closed at both ends; ours run open across the strip."
    limits: add "Closed ends are geometrically impossible here. At the slot mouths the engaged pins
    span −0.082…+0.40 along the shaft, so a closed outer end would lie in the outer neighbouring
    ring's path and a closed inner end past the inner ring (+0.23)."
- **384:**
  - (a) Unchanged.
  - (b) sampled-clear (screen: no pairs).
  - (c) visibleFlaws unchanged. limits: add "The 1.5-turn sweep is a horizontal circle, so no
    camera elevation narrows the 10.06-wide frame; the fit box equals the sampled sweep."
- **504:**
  - (a) Unchanged.
  - (b) sampled-clear (screen: no pairs).
  - (c) visibleFlaws unchanged. limits: add "A different rest pose leaves the whole-cycle frame
    unchanged and would stack the train over A. The fit box follows the wide, short swept
    silhouette, so the width sets it."
- **269:**
  - (a) Unchanged. On screen the pitch is 19.3 px against Brown's 20.3 px.
  - (b) sampled-clear.
  - (c) visibleFlaws: "The closed end sits about 3 pitches farther right than drawn, and the subject
    fills less of the stage than the plate does." limits: add "Rolling the last lower pair puts the
    pinion's tip a tip radius past the last tooth, where Brown leaves 0.25 pitch; the fit already
    equals the frame's swept silhouette."
- **277:**
  - (a) Unchanged.
  - (b) sampled-clear (screen: no pairs).
  - (c) visibleFlaws unchanged. limits: add "Tilting the dog cannot help: the tumbler moves it in
    page-parallel planes. At Brown's tip, a 42.3° cock moves the tip mostly away from the ratchet
    (+1.75 across, +0.78 up)."

## Notes for the integrator

- No production, test or generated file changed. The scratch script was deleted, and the reverted
  208 experiment leaves `generated-pin-slot-208.js` byte-identical.
- No display profiles need re-measuring for this lane. Profiles still listed stale by earlier lanes
  (for example 208 from m14 and 504 from m9) remain stale.
