# Lane m12-forced-mixed: forced minor residuals (76, 84, 184, 195, 208, 261, 269, 271, 277, 299, 304, 384)

Pass-51 minor-residuals lane. Earlier lanes judged these residuals forced. This lane looked for a
new construction for each one. Captures were taken on a non-watching dev server (port 44336) with
`review-movement-source-views.mjs`, and phase captures were taken through the production engine.
Intersections were screened with `show-body-intersections.mjs ID --spacing=0.01 --samples=129`
(257 samples for 271).

## Changed

### 299: hatched band, Brown's small journal, pallets exposed (`authored-escapements.js`, 299 only)

- **Band:** it carries 132 thin light rules round its outer face (`crown-band-vertical-hatching`).
  These are presentation-only and sit on the crown rotor. Seen edge-on, evenly spaced rules crowd
  toward both ends, which is how Brown hatches the band.
- **Journal:** it was a 0.18 collar round a 0.11 staff. It is now Brown's small ring: a 0.115 collar
  with a 0.042 pivot standing proud (`verge-journal-pivot`), on a 0.07 staff that ends inside the
  collar. The journal used to hide the root of both pallets. The strips now show about 8–12% short
  of Brown's measured from the journal centre, where before they showed about 20% short.
- **Rejected:** a longer pallet with a bevelled tip. The pallet's release edge is where the tooth
  tip escapes, so any strip beyond it keeps the tooth in contact:
  - a 0.02 bevelled extension still penetrated 0.016;
  - a 0.2 extension penetrated 0.10.
- **Rejected:** a later release, which would give longer pallets. At the current law the drop is
  only 2.6°. A 28° release pushes the contact advance past half a pitch (negative drop).
- The far teeth stay faded. Brown draws them too, as light outlines behind the near strip.
- Intersections: 0.0000 → 0.0000 (only tangent tooth/pallet working contact).
- Tests: movement-299, verge-crown-working-solids, 234, 238, 298, 300, 301, 302, seven-tooth-238
  (contact and working parts), crown-gear-contact and debaufre-300-301-working-solids all pass.

### 271: in-view return instead of a periodic wrap; no pawl shadow (`authored-ratchet-bars.js`)

- **Display loop:** 12.5 s, where it was 5 s with a two-pitch render wrap.
  1. The loop opens at Brown's pose (phase 0.5) and drives through two vibrations, from the bar's
     rightmost position (clear of the post) to four pitches left.
  2. The bar is then returned in view (2.5 s):
     - The long pawl lifts first, because it still has its 0.05 pickup clearance.
     - The lever eases forward 0.15 rad so the short hook backs off its face, and then the short
       pawl lifts.
     - With both hooks at least 0.12 above the crests, the bar slides back four pitches.
     - The pawls drop back in reverse order onto exactly the start pose.
  - Nothing jumps: the largest per-frame step is 0.007.
  - While the bar moves, both hooks clear the crests by more than 0.1.
  - No hook crosses a face while below the crests (tested).
  - The pulley now turns with the displayed bar.
- **Shadows:** the pawls and lever no longer cast a dark wedge across the table face.
- The return is a prescribed demonstration reset.
- Intersections: 0.0001 → 0.0001 (cord seated on the pulley only).
- Tests: movement-271 was updated (closure over the loop, a no-jump check and return clearance
  checks) and passes. ratchet-bar-finite-contact passes; its phase helper now samples the first
  vibration of the new loop, and it has a new whole-loop check that the bar end clears the pulley
  and the post. alternating-drive-solids also passes.

### 184: plate 184 is plate 183 flipped top to bottom (`authored-quadrant-catches.js`)

- **The finding:** flipping plate 183 top to bottom lays its parts over plate 184.
  - The ball lever runs horizontal to the left from the upper shaft.
  - The hook sits below-left of that shaft, and the sector hangs under it.
  - The hatched tappet sits by the upper shaft.
  - The pointed-window wing hangs from the lower shaft.

  No pose of the upright gear does this: it would need both handles about 80° further, with the ball
  lever and hook exchanged. 184 therefore now shows the same solved gear reflected top to bottom
  (`plate-184-top-to-bottom-reflection`, scale y = −1) at 183's pose. In that view the tappet stands
  at the top and descends onto the upper (ball) handle, as the 182/184 caption describes.
- The relative motion and contacts are exactly the 183 solve.
- The back-weight rods follow the reflection, so they rise from their eyes.
- **Residuals:**
  - Brown's lower wing is turned about 60° anticlockwise from ours.
  - Brown hangs his rods down from pins at mid height (right) and behind the rod (left, dashed).
    Our arms end in eyes at the top-left and bottom-right.
- Intersections: 0.0005 → 0.0005 (the seated stud/lip, as in 183).
  `docs/validation/183-current-solids.json` was regenerated: 183 and 184 are both 0.00055.
- Tests: movement-184 was rewritten for the reflected presentation. movement-183, movement-185 and
  quadrant-catch-finite-interfaces pass.

### 384: 80° swing on the plate side (`authored-helicographs.js`, source-presentation note)

- **The sweep:** the arm now swings 80° away from the viewer and back, where it made 1.5 turns
  round the point. It never crosses the point, so the view frames only the plate side. The figure
  is now about 1.8× larger and sits like Brown's: point at left, screw right, wheel near the outer
  end.
- **Why 80° and not 90°:** at the end of the swing the wheel is broadside on. At 80° its rim still
  stays right of the point.
- **Motion:** the wheel still rolls and screws itself about 0.9 turn inward along the arm on each
  swing. The cycle is 8 s (was 12).
- **Paper:** the sheets now lie under the smaller sweep. They are still removed in the source view.
- **Trade-off:** the traced spiral is now an 80° arc, not a 1.5-turn volute. Lane m8 rejected this
  for that reason. It is adopted here because the paper and trace are never drawn in the source
  view, and the plate-size figure is the visible gain. It is a single constant (`orbitTurns`) to
  revert.
- Intersections: no pairs. Tests: movement-384 and helicograph-working-parts pass.

### 76: Brown's spoke below D (`jointed-tappet.js`)

- The driver's spokes turn 4.6° below D, where they pointed straight at D. Brown's broad spoke runs
  radially just under D, so D now stands on the rim above the spoke's upper edge, as drawn.
- The spokes are display-only and touch nothing. Rotating them shifts the driver's computed mass
  by about 1e-8, so the motion was rebaked with `scripts/bake-jointed-tappet-motion.mjs`:
  - Only the driver-mass metadata line of `src/data/jointed-tappet-profile.js` changed; the
    trajectory rows are identical.
  - Endpoint: 1 tooth, q back to 0.30. Peak q −0.718; convergence passes.
  - Interpolated gap −4.8e-8, as before.
- Intersections: unchanged. Only the display caps on the driver (0.050, 0.027) and the coaxial dog
  stop (0.0000) remain.
- Tests: jointed-tappet 8/8.
- The struck-arm bend at C and D's outer-edge orbit are unchanged; see the forced reasons below.

### 304: no pin shadow streaks (`authored-stud-escapements.js`, 304 only)

- The thirty pins no longer cast long shadow streaks across the rim face.
- Intersections: none. Tests: movement-304, movement-291, movement-292, annular-stud-working-solids
  and stud-pallet-contact pass.

## Forced, with precise reasons

- **76:** Brown's straight tappet pivots almost on a radius of the coaxial driver. A stud on a
  concentric orbit can pass the struck end only once that end's reach has fallen below the stud's
  inner edge, and a nearly radial bar gets there only at the mirror of its rest angle. Drawn
  straight, with D at mid-rim, the stud flings the tappet about 125° and advances 1.6 teeth.
  Lane u6 ran the dynamics on the alternatives:
  - A lower rest angle leaves the dog folded, so it never resets.
  - A small overlap with D gives a singular impact.
  - A 0.4 rad bend loses the count.

  The 0.3 rad bend with D on the outer edge is the only one that counts one tooth.
- **84:** Brown's drawn slots cap the frame's travel at about 4.6 of the 13 pitches. The pin spacing
  beside his slot bridge caps it at about 2.4 pitches. Every fork width stays within those caps. The
  1.5× fork already reaches the slot cap.
- **195:** a worm lying across the face generates slanted, curved tooth spaces as the wheel turns.
  The opening at the face is that envelope, so it cannot be a square slot. A square slot big enough
  for the worm's sweep would span about 77% of the pitch.
- **208:** a lantern strip needs closed side walls outside a slot wider than the 0.164 pin. The pins
  of the engaged ring lie on a circle, so beside the centre line they drift sideways out of the
  pinion's plane by 1 − cos ψ. They do so inside the slot depth.
  - A pin 17° off the centre line already reaches a wall 0.1 from the plane.
  - The wall would have to stay inside radius 0.78, which is below the 0.83 root.
  - The outer ring also passes under the pinion near y ≈ ±0.8.

  So no web wider than about the pin diameter can run on these rings. Brown's 0.34-wide strip with
  closed slots cannot work.
- **261:** the crank pin and rod C must lie in front of B and the bracket behind it. Rod C crosses
  the hub-drum region every turn, and A is drawn over E. So the cord and its drum must run behind B,
  and the drum-side strand disappears at B's rim.
- **269:**
  - The gear must roll over all 17 rack teeth, so the frame travels about 17 pitches against its
    own 22-pitch length. Framing the whole stroke therefore shows the frame at about half the
    viewport width. A plate-pose crop would cut off the frame, which Brown does not crop.
  - The closed end must clear the gear's tips at the stroke limit.
  - Brown's handoff spacing puts two teeth in mesh at once, so the transition teeth are relieved.
    The official animation also alters those teeth.
  - Squarer rack teeth were not adopted. A small pressure angle undercuts the 18-tooth pinion
    heavily, and the relief would then round the rack tips.
- **277:** a page-plane dog with lift L can turn a six-tooth face ratchet a full sixth only if it
  works within about L/√3 of the axis. With the hammer's lift of about 0.6, that is about 0.35 of
  the axis. Brown's tip is about 0.87 above it, and from there the best any offset achieves is about
  20° per stroke. Deeper teeth break the dog's ride-back.
- **304:** Goodrich's 30 pins give a 12° pitch, which needs a half-pitch (6°) pallet gap. The next
  valid gap, 18°, needs 42 pins. His pin size also leaves no room for the 4°/2° impulse and drop.

## Notes for the ledger owner

- The display profiles (`motionBounds`) of 184, 271 and 384 were measured on the old motion or
  geometry and should be re-measured:
  - 184 is reflected.
  - 271's bar now travels four pitches.
  - 384 sweeps 80°. Its source view intersects the authored box with the old full-sweep box, and the
    result is close to the new box.
- 184 and 183 now share the same solved pose; only the presentation differs.

## Integration note (lead)

The 384 change (arm swinging 80° instead of 1.5 turns) was not accepted: the helicograph exists to trace a spiral, and an 80° arc loses that. 384 keeps the full sweep and stays minor for its framing.
