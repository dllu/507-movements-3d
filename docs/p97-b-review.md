# Pass 97, lane p97-b: 126 eyes, 127 lever balls, 134 rope cage

Reviewer: Claude Opus 5.5, lane p97-b. Date: 2026-09-28. The findings came from the user's own review (screenshots 90, 91 and 96). Scratch and captures are in `/dev/shm/p97/b/` (outside Git).

## 126: eyes concentric with their pins
- **Finding.** The rope-end eye's pin sat off-centre in its round boss (user image 90).
- **Cause.** `mujoco-bell-crank/geometry.js` drew each eye, and the pivot boss's inset, at its own traced circle centre. Those centres are 0.65 to 2.4 px off the traced pins:
  - input eye 2.4 px;
  - pivot eye 1.9 px, and its inset 1.0 px;
  - output eye 0.66 px.
- **Change.** Every eye circle in the lever silhouette, the two cord eyes, and the pivot boss with its inset are now centred on their pin. Only the traced radii are kept. The pins, arms and physics are unchanged.
- **Other eyes checked.**
  - The pulley's rim, inset, hub and shaft were already one centre.
  - The ink cord grips were already centred on their pins.
- **Bake.** `src/simulation/baked/assets/mujoco-126.json.gz` was re-baked with `node scripts/bake-mujoco-movement.mjs 126`, because the module folder is hashed for provenance:
  - loop 12.000 s (3 × 4 s from 92 s, 750 samples);
  - raw seam 0.171 px;
  - round trip 0.156 px (limit 0.271).
- **Captures.**
  - Before: `before/126-tile.png` and the user's image 90.
  - After: `after/126-tile.png`, plus close-ups in `after/zooms.png` (input eye, pivot and output eye), or singly as `after/126-zin.png`, `126-zpiv.png` and `126-zout.png`.
- **Tests.** A new test in `tests/mujoco-bell-crank.test.mjs`, "126 eyes and the pivot boss are concentric with their pins", checks each eye and the pivot boss:
  - its bounding centre is within 2e-4 of the pin (the old eyes failed at 0.024);
  - its outer radius is the traced radius.

  `mujoco-bell-crank`, `mujoco-baked-loops` and `baked-motion` all pass (123 tests).
- **Screens.**
  - Disconnected parts: 0 detached. The near-misses are the existing bore clearances.
  - Coincident faces: one existing cord/lead pair of area 6.6e-8, unrelated.
  - Intersections: solid clear.

## 127: lever balls on the rod axis
- **Finding.** The balls at the ends of the handle sat 0.085 behind the rod's axis, so the rod ran into the ball off its centre (user image 91).
- **Change.**
  - Each ball's centre is now the rod's end, on its axis.
  - Each arm leans back 2.6° in depth, from z −0.145 at the pinion rim to z −0.235 at the tip. This cannot be seen from the front. It is needed because the lever swings up behind the right rack at the top of its stroke, and a ball on the old arm axis would cut the rack by 0.075.
  - The balls stay where they were, and the rod now meets each one at its centre.
- **Captures.**
  - Before: `before/127-tile.png` and the user's image 91.
  - After: `after/127-tile.png`, plus close-ups `after/127-zball.png` and `127-zball2.png`.
- **Tests.** A new test in `tests/opposed-pump-racks.test.mjs`, "127 lever balls are centred on the rod axis at the rod ends", checks two things:
  - each ball centre is at the rod's end, on its axis (to 1e-12);
  - the balls clear the rack and gear faces at 241 poses.

  The file's 3 tests pass. The display profile for 127 was re-measured and is unchanged.
- **Screens.**
  - Intersections: clear. An intermediate version with the ball on the old axis showed the 0.075 cut, which is why the arm leans back.
  - Coincident faces: clear.
  - Disconnected parts: only the existing piston-rod gland clearance beyond the crop.
  - Seams: clear.

## 134: an eight-beam rope cage with an octagonal rope
- **Finding.** Brown's drum is a cage of eight beams, and the rope is wound on it as an octagon. The model had a solid pulley (user image 96).
- **Change.** A new module, `src/simulation/octagonal-rope-cage.js`, replaces `singleWrappedRopeDrumDrive` in `authored-belts.js`. It removes the helical-wrap model, the contact bed, the lagging rings and the invisible markers. Full details are in `docs/movement-134.md`.
  - **End wheels.** Two, each with the traced spokes and a hub.
    - The rear flange runs out to Brown's outer circle.
    - The front rim is narrow and stops below the rope, so the rope reads on the front face as Brown draws it.
    - The spokes are trimmed to end inside the front rim.
  - **Beams.** Eight, parallel to the axis and 18 px wide, with round noses. They stand 0.012 proud of the front rim.
  - **No core.** Nothing fills the space under the rope.
  - **Rope.** One brown laid rope (radius 0.05). It runs from a far guide on Brown's ground line, once round the beam noses on an octagonal helix (straight chords, arcs round each nose), and away to a far guide.
  - **Motion.** The rope does not slip on the noses. Its take-up and pay-out follow the octagon:
    - the speed pulses 7.1 % eight times a turn;
    - each span tilts by up to 2.05° as the beams pass;
    - the feed stays continuous when the contact moves to the next beam.
  - **Loop.** The lay is a whole number of lays per turn, so the loop is seamless and the rope buffers are reused.
  - **Framing.** The camera envelope and framing are unchanged.
  - **Source presentation.** The note in `src/data/source-presentation.js` is updated.
  - **Display profile.** Re-measured for 134. Only the motion bounds changed: x is now ±3.331, which was ±3.354.
- **Captures.**
  - Before: `before/134-tile.png` and the user's image 96.
  - After:
    - `after/134-vs-plate.png` (the default view beside the plate);
    - `after/134-tile.png` (default, yaw ±40, side, pitch-up and a close-up);
    - `after/134-phases.png` (phases 0, 1/32, 1/16 and 1/2, a bottom close-up with both passes, and a nose close-up);
    - `after/134-backs.png`.
- **Tests.** The old helical-wrap assertions were replaced.
  - `tests/models.test.mjs`, "movement 134 winds one rope once round an eight-beam cage as an octagon, with no solid core". It checks, at 257 poses:
    - the rope touches all eight noses and never cuts one;
    - the rope stays between the end wheels and clear of its own other pass;
    - the guides stay fixed, and the tilt stays under 2.5°;
    - the feed is continuous and the length changes smoothly;
    - the speed swing is non-uniform, over 2 % above and 3 % below the mean;
    - the loop is seamless (max 2e-4) and the buffers are reused;
    - there is one brown rope and no markers.
  - `tests/single-wrap-drum.test.mjs` checks the octagonal chords, the clearances to the front rim and rear flange, and the display timing.
  - `tests/rope-drum-hardware.test.mjs` checks that the spokes join the hub and rims with no coincident faces, that the beams join both wheels, and that the support clears the shaft.
- **Screens.**
  - Intersections: 0 (run with a 16 GB heap; the default heap ran out of memory).
  - Coincident faces: 0.
  - Disconnected parts: 0 detached. The only near-misses are between the rigid spokes.
  - Seams: clear.
- **Residuals.**
  - Brown's radial blocks reach his outer circle. Here the beams end under the rope at r 1.678; the rope's outer edge reaches r 1.78.
  - The rope's axial walk across the noses is kinematic. Tension and friction are not solved.

## Claims and deferred
- **Claimed:**
  - `authored-belts.js`;
  - `opposed-pump-racks.js`;
  - `mujoco-bell-crank`, as a directory claim, because the basename `geometry.js` is held by p97-a for a different file;
  - `octagonal-rope-cage.js` (new);
  - `source-presentation.js`;
  - `display-profiles.js` (entries 127 and 134 re-measured only).
- **Deferred:** none.
