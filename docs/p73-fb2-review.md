# Pass 73, lane fb2: 438, 440, 463, 472, 476, 482

Reviewer: Claude Opus 5.5 (pass-73 lane p73-fb2). The findings came from the pass-73
audit (`/dev/shm/audit73/b/findings.json`). Each fix was checked against
`public/engravings/mm_NNN.png`.

Captures were taken on a private non-watching vite server with
`/dev/shm/p73-fb2/views.mjs`, a copy of the audit view script. Each set has five phases
(p0, 0.25, 0.5, 0.75, 0.97) plus views at -60° and +60° about vertical, from the top and
from the back. The captures are tiled beside the plate:

- before: `/dev/shm/p73-fb2/before/tile-NNN.jpg`
- after: `/dev/shm/p73-fb2/after/tile-NNN.jpg`
- zooms: `/dev/shm/p73-fb2/z/`

## 463: self-acting weir (was FLAWED)

**How it works.** Two leaves pivot below their centres. The large upper leaf turns
downstream; the small lower leaf turns against the stream. The upper leaf's bottom edge
bears on the lower leaf's face, so a rising head turns the pair open and scours the bed.
The ordinary flow spills over the upper leaf.

**Wrong:**
- A deep rectangular notch was cut into the middle of the upper leaf's top edge (0.70
  wide and 0.78 deep). Brown draws none.
- The overflow was a narrow round nappe through that notch.
- Both fixed pivot pins stuck 0.275 out past the leaves, and one rear stub bearing on
  each ended in open air.

**Changed** (`src/simulation/authored-self-acting-weirs.js`):
- The upper leaf is a plain full-width plank with no shoulders.
- The ordinary sheet spills over the whole crest: `notchWidth = gateWidth`,
  `notchDepth = 0`.
- The head stands 0.14 over the crest ordinarily and 0.26 at flood. It is capped at the
  flood head over the turned leaf's crest, so the level falls with the crest as it opens.
- The head water's section runs up the leaf face to the crest and then straight up to
  the surface. It no longer overhangs the turned leaf.
- The sheet's thickness equals the head. The sheet leaves along the crest slope and falls
  on a parabola that lands inside the drawn tail water. Its spray flare stays within the
  channel width.
- The pins end flush with the leaf ends, and no stub bearings are shown. The channel walls
  that would carry the pins lie in front of and behind Brown's section plane; the water
  ends on the same planes.

**Plate and caption conflict.** Brown's caption says ordinary water "flows through notch
in upper leaf". The plate draws no notch; in the left figure the water leaves the leaf
below its drawn top. A full-width notch with narrow end cheeks was tried first: it
matched the section but read as two horns in rotated views. The audit's instruction
(plain leaf, full-width sheet) was followed instead. The ordinary head now stands 0.14
over the crest, where Brown shows the water surface below the leaf top.

**Captures.** `after/tile-463.jpg`, plus zooms `z/463-p0-c.png`, `z/463-p0.5-c.png` and
`z/463-p0.75-c.png`. Phases 0, 0.25, 0.5, 0.75 and 0.97 show ordinary overflow, the peak
head, the open scour and the reclosing.

**Intersections:**
- Screen: `--spacing=0.01 --samples=129` (needs `--max-old-space-size=12000`; the default
  heap runs out of memory).
- Solid pairs: none. The screen reports 5 bodies and no open meshes.
- Fluid pairs: schematic water volumes against the leaves and bed. The largest are lower
  leaf × head water 0.16 and plank × head water 0.03.

**Tests.** `tests/movement-463.test.mjs` was rewritten where it pinned the notch:
- It now requires a plain plank that reaches the crest and spans the channel.
- It requires pins as long as the leaf width, with the bearings hidden.
- It requires the head to stand over the crest and never exceed the flood head.

## 472: Grimshaw's compressed-air hammer (was FLAWED)

**How it works.** Shaft E drives pump D by a crank. A wheel on E bears on the underside
of the horizontal disk M on top of the frame, and M's crank pin works the slide valve on
cylinder B. This is the "variable friction disk" of the archetype, a right-angle friction
drive: moving the wheel along E changes the contact radius and so the hammer rate.

**Wrong.** The drive was already modelled. Its wheel sits at `frictionDiskCenter.x +
contactRadius`, its rim is tangent to M's underside, and there is no slip, so M is
kinematically driven. But the wheel was plain black like the collars beside it and half
hidden by the frame column, so M looked undriven.

**Changed** (`src/simulation/authored-compressed-air-hammers.js`):
- The wheel is now an orange driving wheel (the shaft's driver colour), bored on E.
- It carries a brown leather tyre (role `leather-face-of-friction-wheel-N-bearing-on-disk-M`)
  whose rim, at the same 0.43 rolling radius, bears on M.
- The shared quadrant cue from `rotation-indicators.js` still applies to the wheel group.

**Captures.** `after/tile-472.jpg`, plus zooms `z/472-p0-c.png` and `z/472-m60-c.png`. The
tyre's contact under M's rim is visible in the default and rotated views.

**Intersections.** `--spacing=0.01 --samples=129`. The only solid pair is tyre × disk M at
0.0000, the seated friction contact. Fluid pairs are unchanged.

**Tests.** A new test in `tests/movement-472.test.mjs` checks that the tyre is on the
friction wheel and that its radius equals the rolling radius.

## 482: Powers's gas regulator (was minor)

**Wrong.** The cover is a vault extruded from the arch section, and both of its ends were
open. From the front, cut on the section plane at z = 0.29, it read as a thin arch with the
background showing beneath it.

**Changed** (`src/simulation/authored-mercury-gas-regulators.js`, `addDomedCover`): solid
end plates, 0.18 thick, now close both ends of the lid using the full outer arch profile.
The cutaway removes the front one, and the rear one shows as the inside of the cover.

**Captures.** `after/tile-482.jpg`. The default view shows the interior under the arch;
the back view shows the closed end.

**Tests.** A new test in `tests/movement-482.test.mjs` checks that the rear end plate is
present.

**Residual (not in scope).** The overall case layout still departs from Brown's section,
which has a round case with the mercury channels in the walls.

## 440: tipping water meter (was minor)

**Wrong.** The pooled water used a matte fluid material at opacity 0.5. Blue over the
orange trough mixed to a dull grey slab.

**Changed** (`src/simulation/authored-tipping-water-meters.js`):
- Both cell waters now use the shared `waterVolumeMaterial`: glossy, depthWrite false,
  renderOrder 1.
- It uses a clearer blue (0x3aa6c8) at opacity 0.78. Orange is complementary to the
  water's blue, so a thin tint over it mixes to grey.

**Captures.** `after/tile-440.jpg`. The zoom `z/440-p0.75-c.png` shows teal water that
matches the flume's stream.

**Tests.** A new test in `tests/movement-440.test.mjs` checks the material.

## 476: Lansdell's steam siphon pump (was minor)

**How it works.** The steam jet A enters at the fork of the two suction legs B and points
up C. Its entrainment draws water up both legs, round A, and out of C. Brown draws the
fork in section, with A turned up inside it.

**Wrong:**
- The fork was opaque, so nozzle A and the rising water were hidden.
- A's tip stood at y = 0.91, barely past the crotch wall.

**Changed:**
- `src/simulation/cutaway-presentations.js`: a new 476 entry cuts the fork wall on z = 0
  and cuts the water on the same plane.
- `src/simulation/authored-steam-siphon-pumps.js`:
  - The factory now applies `applyCutawayFor`.
  - The nozzle tip rises to (0, 1.40, 0), well inside the fork and short of C's neck, as
    Brown draws it.
- `src/simulation/ejector-trap-working-parts.js`, 476 branch only:
  - One water body fills the bore. It is `mirroredForkWall(halfCurve, .004, .372)`, the
    same mirrored sweep as the wall, so there are no internal faces where the legs merge.
  - It uses 475's water tint.
  - Its level is a second clipping plane that follows the shared start, run and stop
    `levelFraction`: empty below B's mouths, rising to C's mouth, full while
    discharging, and falling back.
  - The discharge crown at C's mouth is cut to the rear half, as in 475.
- A still runs behind the right leg B (Brown dashes it there), passes under the crotch,
  and rises through the wall port into the fork.

**Captures.** `after/tile-476.jpg` (p0 empty, p0.25 rising, p0.5 and p0.75 running,
p0.97 falling back), plus zooms `z/476-p0-c.png` and `z/476-p05-c.png`.

**Loop seams.** At first the water's visibility toggle registered as a pop at phase
0.082. The water is now always drawn and the level plane clips it away when empty. Result:
0 seams, 0 pops.

**Tests.** A new test in `tests/movement-476.test.mjs` checks:
- the cut report;
- the nozzle inside the fork;
- that the level follows `levelFraction` and only rises during start-up;
- the two clipping planes.

## 438: Barker's mill (was minor)

**Wrong.** Orange torus collars sat on every nozzle mouth. Brown draws plain pipe ends.

**Changed.** The `src/data/source-presentation.js` 438 entry now removes
`tangential-outlet-collar-\d-of-four`. The factory keeps them for its geometry tests. The
arm pipes are already hollow walls, and the jets issue from their open ends
(`z/438-p0-c.png`).

**Tests.** `tests/movement-438.test.mjs` now expects the collars to be removed by the
presentation.

## Checks run

- Tests, 134 passing and 1 failing:
  - `movement-438`, `movement-440`, `movement-463`, `movement-472`, `movement-475`,
    `movement-476`, `movement-477`, `movement-482`
  - `chain-weir-interfaces`, `ejector-trap-working-solids`, `gas-meter-working-solids`,
    `hammer-working-interfaces`, `fluid-rotor-436-438-solids`,
    `water-mechanism-439-440-444-solids`, `source-presentation`, `rotation-indicator`
  - The one failure is `source-presentation`, on another lane's entry for 481
    (`visible-index-on-front-face-of-drum`). The entries for 438 and 476 come before it and
    pass.
- `scripts/check-loop-seams.mjs --ids=438,440,463,472,476,482`: 0 seams, 0 pops.
- `show-body-intersections --spacing=0.01 --samples=129`, run one ID at a time:

  | ID | Solid pairs | Fluid pairs |
  |---|---|---|
  | 438 | none | 2 |
  | 440 | none | 3 |
  | 463 | none | 8 |
  | 472 | tyre × disk M at 0.0000 (seated contact) | unchanged |
  | 476 | none (A clears its wall port) | water × discharge at 0.04 |
  | 482 | none | mercury envelopes only, as before |

- `scan-bad-faces --ids=438,440,463,472,476,482`:
  - No inward, shading or mixed-winding faces.
  - Degenerate slivers (none visible):
    - 463: 4 in the head-water section, at the 2 mm step over the crest.
    - 476: in the water, which uses the same mirrored-fork generator as the wall; the
      wall already had 458.
  - The z-fight and back-to-back findings in 472 and 482 are in parts this lane did not
    change.
