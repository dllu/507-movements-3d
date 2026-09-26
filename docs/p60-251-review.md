# Pass 60, lane p60-251: movement 251 rebuilt as a pliers releasing hook

## User finding
The old model worked but did not follow Brown's drawing. It hung the two hooks on pivots in a yoke on W and had them grip a rope-carried head. In the plate, W is a plain block with a T head. The hooks A are a pair of pliers or tongs pivoted on the rope block, and their jaws grip that T.

## Reading of the plate (mm_251.png, measured in pixels)
- Jaw pivots are at (237.5, 214) and (297, 214). The jaws were traced from the ink using a flood-filled interior, a closing operation and marching squares, then smoothed and made mirror-symmetric (right jaw traced, left jaw mirrored).
- The T bar runs 253–281 × 240–251. The stem runs 259–271 down to W's top at y 284. W spans 186–344 × 284–478 and has rounded side lugs at about y 320 and y 447.
- The top beam spans y 11–41. Slot B is 38 px half-width at the top and 49 px at the bottom. The rope block's bar spans 198–335 × 110–120 and carries the rope eye, the stepped central web, the curved stirrup and the lower block that holds both pivots.
- Caption: "the upper ends of the hooks, A, … are pressed inward by the sides of the slot, B". Pressing the horns inward turns the jaws about their pins and opens the feet.

## New construction (`src/simulation/authored-pile-drivers.js`)
- **W** is one solid block with a fixed T head (bar and stem) and Brown's rounded side lugs. It has no pins, bearings or hooks. The lugs ride in front of plain guide battens on the two posts.
- **Rope block** is one casting hung from the laid rope by an eye: bar, stepped web, stirrup straps, and a lower block with pivot ears. It also has stop lugs that come forward into the jaw plane.
- **Jaws A** are the traced plates, bored on dark pins with heads. Each pin passes through its jaw into the ear of the casting.
- **Grip:** each foot has a 35° barb that seats face-to-face under the undercut T bar. The load's reaction passes outboard of the pivot, so the load presses the jaws shut. The claw shanks seat on the stop lugs with a 0.005 gap. When unloaded, the jaws' own weight closes them.
- **Release:** the rounded lips of slot B press the horns' outer flanks. The opening angle at each rope-block height is solved as the smallest angle at which the jaw outline does not penetrate the cheek (exact bisection).
  - The jaws start opening at a rope-block height of 34.6 px.
  - W is released when the foot tips pass the ends of the T bar (φ = 0.113 rad), at t = 3.309 s in the canonical cycle.
  - After release W falls ballistically: it keeps the block's upward speed at release, then accelerates downward at a constant 280 px/s², and lands inelastically at 4.150 s.
  - The jaws finish at φ = 0.135 so the falling T bar has clearance.
- **Re-catch:** the block descends onto the resting T. Once the horns leave the slot, the jaws close. The chamfers on the feet then ride the T's chamfered top and cam the jaws open (continuation-solved table, refined so it never penetrates). The feet slide down the ends of the bar. Below the bar corner (0.5 px of overtravel), gravity swings the jaws shut through angles that are all clear. The block then takes up 2 px and reseats the barbs.
- **Loop:** the cycle is seamless at 10 s. Display time 0 is offset by 1.984 s so that it shows Brown's drawn pose: W hanging in the closed jaws with the horns below B.
- The laid rope, the sheave and the winding drum are kept. The drum sits 1.5 behind the sheave so the coil clears the sheave flange. The winch cheeks stand on the two halves of the beam, and a small shelf behind the beam carries the drum.

## Reconstruction assumptions and deviations
- Brown draws the tops of the feet flat. They are given a 35° barb, with a matching undercut on the T, so that the load holds the jaws closed. With flat feet, the contact inboard of the pivot would open the jaws.
- The T bar overhangs the stem by 5 px, not the drawn 6–10 px. The horns can only turn about 0.14 rad before meeting the rope. The mouth half-width of slot B is 50 px; the drawn value is 49.
- Brown shows the bar ends touching the arms. The casting sits behind the jaw plane, so the arms pass in front of the bar as they close. The stirrup is modelled as rigid.
- Brown's horizontal line at y 232, running between the posts, is not modelled; its meaning is ambiguous.
- The pile head and anvil lie beyond the plate's crop, and are only partly visible at the bottom of the default frame. Posts, battens, beam and a winch shelf are the only supports.
- Hoist motion, contact forces, friction and the jaws' swing-shut timing are prescribed. The jaw laws are quasi-static and geometric. There is no production MuJoCo.

## Intersections
Command: `node scripts/screen-body-intersections.mjs --ids=251`.

| | Result |
|---|---|
| Before | 7 bodies; worst solid 3.9e-8 (shelf/toe seat); open meshes 0 |
| After, default spacing (65 samples) | 7 bodies; coaxial 0 |
| After, fine spacing (0.025, 129 samples) | Same result |

Solid pairs remaining after the change are all seated contacts:

| Pair | Depth | What it is |
|---|---|---|
| Beam halves / jaw horns | 4.7e-5 (0.001 px) | The lip in contact with the horn |
| Jaws / T head | 2e-7 | The barb seat |

Two problems appeared during the work and were fixed before the final screens:
- **Stop lug overlapping the jaw bosses** (coaxial 0.048). The lug top was lowered to −14.
- **Rope touching the sheave flange** (deforming 0.021, seen at the drum coil). The drum was moved back.

The rope eye was also moved so the rope ends on top of it.

`tests/lifting-check-hook-working-parts.test.mjs` runs a solid-surface audit over 3.35M queries:
- jaw against the T: at least −1e-7;
- jaw against fixed parts: at least −1.4e-7;
- pins in the bores: 0.0057 clearance.

## Captures
All captures come from a freshly restarted non-watching server on port 44515. They are saved in `/dev/shm/y6/f`.
- `default.png`: the render beside the plate. Proportions, jaws, T and W match. The winch above B and the anvil below the crop are extra.
- `rot.png`: oblique, side, rear and far zoom-out views. The jaw plane sits in front of the casting, the battens behind the lugs, and the beam halves are carried on the posts. Nothing floats.
- `strip.png`: motion strip with canonical times 0 (gripped at the bottom), 2.0 (lift), 3.1 (squeeze), 3.3 (release), 3.5 (fall), 4.4 (landed), 6.0 (descent), 7.45 (cam over), 7.9 (sliding down the bar ends), 8.5 (below the bar), 8.8 (swing shut) and 9.9 (take-up).
- Zoomed crops `/dev/shm/y6/z1/squeeze.png` and `/dev/shm/y6/z1/feet.png` show the lip-on-horn contact and the foot/T states.

## Tests
- `tests/movement-251.test.mjs` was rewritten with six tests:
  - topology: pliers on the rope block, W solid;
  - plate measurements and the source pose at t = 0;
  - penetration-free grip, seat, closing load moment and stop over 2000 samples;
  - slot opening, the release point and ballistic fall;
  - cam-over and re-catch;
  - seamless loop and renderer bindings.
- In `tests/lifting-check-hook-working-parts.test.mjs`, the three tests for the old toe, shelf and pin design were replaced by a mesh audit of the jaws against the T, the slot, the lugs and the casting, and by a pin/bore test. The shared 251/253 buffer-and-fit test now handles the jaw bodies.
- Also run and passing: `authored-loader`, `reviewed-cycle-timing`, `rotation-indicator`, `source-presentation` and `movement-252` (33 tests).
- The display profile for 251 was re-measured with `node scripts/measure-display-profiles.mjs 251`.
