# Lane u2-cams: user-reported cam defects (99, 107, 117, 135, 137, 148, 149)

Date: 2026-09-24. Pass-51 user-feedback lane. Each fix was captured on the
production route (`model-loader.js` + `async-engine.js`) and compared with
the plate at eight phases. Motion was sampled numerically where motion was the
complaint.

## 099 — spiral feed loads slowly

The browser load took roughly 20 s. Profiling in Node showed three costs:

| Stage | Before | After |
| --- | ---: | ---: |
| Profile (roller-radius bound) | 0.25 s | 0.03 s |
| Generic convex decomposition of the rail plate | 7.4 s | 0 s |
| MuJoCo model construction with 3,072 rail meshes | 13 s | 0.9–1.4 s |
| Browser `loadMovementModel` total | ~20 s | ~1.2–2.4 s (measured under load from other lanes) |

MuJoCo's per-element cost grows faster than linearly with the number of meshes
and geoms (XML parsing and the MjSpec API both scale this way). The model now
uses 2,048 spiral segments instead of 3,072, and builds its convex contact
cells directly from the strip's inner/outer offset samples instead of merging
triangles. Each cell is still a quad that exactly fills its share of the
rendered strip. The roller-radius bound now skips bisection at pitches that
already admit the current bound.

A tested alternative grouped three quads per contact cell at 3,072 segments.
It loaded in about 1.1 s, but filled 0.02-pixel chord slivers on the concave
working face. The roller's spin then differed by 1.9 rim pixels from the
6,144-segment reference over 120 s. That exceeds the existing 1-pixel
refinement bound, so it was rejected. A baked binary model was also rejected:
the compiled MJB is 11.7 MB. With 2,048 exact cells, the mesh-refinement
differences against 6,144 segments are 0.0055 pixel for the feed and 0.53 rim
pixel for the roller. Physics is still live and all four 099 tests are rerun.

## 107 — serpentine groove was a sawtooth

A first pure-sine groove (11 waves) still read as a narrow V zigzag. The plate
draws a snake instead: about four deep reversals each way across the drum's
front half, each a broad, round U, joined by steep, nearly crosswise runs.
The groove now repeats 8 times per turn, down from the earlier fit's 11. Its
pitch curve is a saturated sine,
`x = middle + (stroke/2)·tanh(c·sin u)/tanh(c)`, where
`u = 8(θ + φ) − π/2` and `c = 1.5`. The curve is smooth everywhere.

- **Shape:** the smallest pitch-curve radius is 10 pixels, up from 1.3 pixels
  in the original groove. `c = 2` flattened the ends too much against the
  plate's semicircular U-bends, so it was rejected.
- **Stroke and start:** stroke and the measured pin start are unchanged. The
  rod keeps 8.03 pixels of guide engagement.
- **Pin and groove:** the working pin radius is 2.5 pixels (the cutter), a
  little under the drawn ink width.
- **Timing:** each stroke takes 3 seconds, a 24-second turn. The runs are
  steep, with a peak slope of 3.5 against the sine's 2.1. At 2 seconds per
  stroke, timestep sensitivity exceeded the 0.2-pixel refinement bound.
- **Motion:** the follower is fast across the runs and eases through the broad
  turns, like a snake. This is not the caption's uniform motion.
- **106 is unchanged:** `profile.js` keeps its own copy of 106's wall sweep.
- **Tests:** they now check the saturated-sine law, its peak slope and the
  minimum 9-pixel turn radius. Speed is compared with the law and normalized
  by the peak speed. The refinement test now runs two full output cycles.

## 117 — jerky cam

The fitted pitch curve had 1st, 3rd, 5th and 7th harmonics. The 7th alone gave
97 pixels/rad² of yoke acceleration, making the yoke surge seven times per
revolution. The cam was refitted to the same ink readings. The fit uses only
the 1st and 3rd harmonics, with the 3rd capped at 2.5 pixels. The initial yoke
pose is still constrained to the measured position, and odd harmonics keep the
opposite rollers conjugate. The largest yoke acceleration is 41 pixels/rad²,
down from about 220. Speed now changes smoothly twice per revolution. The ink
residual rises from 1.7 to 3.7 pixels RMS.

With this smooth motion the yoke never accelerates downward faster than gravity.
The upper roller carries the weight, and the lower roller follows in light
contact and turns slowly. The test that required 20 rad of lower-roller spin
now requires 2 rad. The separate test for either roller carrying the load still
passes. The stroke pin changed from ±24.8 to ±22.3 pixels.
`scripts/audit-roller-yoke-clearances.mjs` finds no unintended penetration;
working contact is at most 0.0003 pixel.

## 135 — nut "teeth" reversed

Each valve rod's attachment had three capsules, rounded at both ends. They
visually hung from the rod toward the yoke. Brown draws a hexagon nut seen
face-on: three flats seated on the yoke, with chamfer arches toward the rod.
Each nut is now one hexagonal solid, flat at the yoke with a cone-cut outer
end, so each flat ends in an arch. `attachmentLugs` now holds two nuts instead
of six capsules, and `tests/models.test.mjs` was updated. The synchronous
intersection screen still shows only the pre-existing invisible stroke
envelope.

## 137 — weird cam that barely touched the lower roller

The traced spline cam could not bear on both fork rollers. The previous bake
moved the rollers 12 pixels apart and let gravity keep only the upper roller
on the cam. Over a loop the lower roller turned 0.001 rad. The cam is now a
smooth six-harmonic radial curve, designed jointly for two things:

- the visible ink landmarks: 4.8 pixels RMS, 11.2 maximum; the drawing's
  dimples cannot be followed by a two-roller fork;
- two-roller conjugacy with the fork pivoting in the drawn eye, and the rollers
  moved only 4 pixels apart.

With the upper roller on the cam, the lower roller stays within −0.04 to
0.65 pixel of it all the way round. In the new bake both rollers turn about
32 rad per 16 s, and the fork swings ±2.1°. Native penetration is 0.022
pixel. `scripts/compare-expansion-eccentric-prototype.mjs` now compares
refinements at equal cam angle. Equal-time comparison had mostly measured the
drive actuator's timestep-dependent lag. The fork-position differences are
now 0.016–0.017 pixel. The asset was rebaked from
`/dev/shm/u2/137-fine.json`. Also copied to `/dev/shm/137-fine.json`.
Loop seam: 0.0014 pixel.

## 148 — the oblong as a groove

The oblong is now a grooved band on the large gear's face. It has two walls and
a working channel, fitted to the traced band's mid-line with a 4-harmonic
radial curve (0.88 pixel RMS). The long lever pivots on the right-hand bracket,
and its pin runs in the channel. As the gears turn, the pin slides once round
the whole groove per revolution. The lever rocks through 0.36 rad twice per
turn: Brown's "alternate circular motion." The short arm and its eye are
carried rigidly by the lever as a bent-lever tail.

The eccentric pin, short crank and 14-pixel joint shift of the old four-bar
are gone. The groove walls sit on the spokes' front face, and the spokes were
thickened forward 0.05. This keeps the walls in front of the pinion's teeth,
which the walls' drawn outer end crosses. The complete assembly check passes:
65 poses, 25 parts, 12.2 M checks, no failing pairs. The pin keeps at least
0.004 clearance to both walls, and the tooth check finds zero overlap.
`docs/validation/148-rocking-frame.json` is the historical study of the
rejected through-shaft four-bar, and its generator no longer applies to
production.

## 149 — cams identical and smoother

Both cams now use one convex three-harmonic egg. It was fitted jointly to both
traced outlines and enlarged 12% toward the rear cam's longer lobe: 113 pixels
at the nose, 33 at the heel and 47 across. The contours are sample-identical,
rotated copies at each cam's drawn lobe direction. Physics starts each lever
resting on its cam, with its rod and guided slider consistent. Both levers now
swing 0.2176 rad. The guided probes, assembly check, bake and baked assembly
check were regenerated. The baked check has 61 poses, no failing pairs and
working contact at most 0.00014.

## Tests run

`tests/mujoco-spiral-feed.test.mjs`, `tests/mujoco-serpentine-cam.test.mjs`,
`tests/mujoco-roller-yoke.test.mjs`, `tests/expansion-eccentric-profile.test.mjs`,
`tests/expansion-eccentric-bake.test.mjs`, `tests/geared-crank.test.mjs`,
`tests/geared-crank-frame.test.mjs`, `tests/twin-cam-physics.test.mjs`,
`tests/twin-cam-baked.test.mjs`, `tests/source-presentation.test.mjs` and the
movement 135 block of `tests/models.test.mjs`.
