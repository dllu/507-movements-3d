# Pass 92, lane c: 181–184 rebuilt from the plates

Reviewer: Claude Opus 5.5, lane p92-c. Date: 2026-09-28.

The user's complaint: 181–184 were full of extra pins and 3D protrusions that
the engravings do not show, messy geometry, pins on the edges of parts, and
parts merged into one plane that Brown puts on different planes (183's top
right: Brown dots the rod, so it lies behind the wing).

Captures are in `/dev/shm/p92/c/` (outside Git):
- `before/tile-ID.png` and `after/tile-ID.png`: the plate, then phases
  0/0.25/0.5/0.75, ±60°, back and top.
- `a2/t183tr.png`, `a2/t183bl.png`: 183 zooms of the top-right eye and rod and
  the bottom-left lever, tappet and weight arm, at 0°, 160°, 40° and −45°.
- `a3/t181.png`: 181 zooms of the upper horn and the lower beak.
- `d/o18x.png`: the new 181/182 plate outlines drawn over plates 181 and 182.
- `seq183.png`: the 183 cycle in plate coordinates (plane colours), 11 phases.
- `q/d*.png`: the 183 design study (rejected variants included).

## 181, 182: diagonal catch (baked MuJoCo)

**Before.** Each handle reached the catch through a finger on a separate rear
plate, joined to the finger by an axial web, plus a bored offset sleeve.
Round pin heads stood proud of the catch, and a long sleeve ran behind the
lower handle. The playback also built an undrawn engine frame: a bar, stays,
flanges, rod guides and a strap tying the catch stud to the upper shaft.
Source presentation removed the frame from view, but it was still built.

**Why the earlier web removals failed.** The failures came from plane
assignment. The fingers were the only parts in the catch's plane, and the
handle bodies lay in the lever planes. With the webs removed, a finger had
nothing in its own plane to join it to the boss. I computed the region the
catch (with its eye boss and 0.015 of clearance) can reach in each handle's
frame, over the handle's full range and the catch's 0–0.057 rad. That shows
the hull of each face and its boss is free: one piece in the catch's plane
joins the face directly to the boss. So the catching faces can be the ends of
ordinary castings in the catch's plane. The baked motion is unchanged. The
qualified contact profiles (catch outline, both faces, both working arms)
are untouched, and the bake's `inputHash` is identical.

**After** (`mujoco-diagonal-catch/assembly.js`, rewritten; the scaffold is
now read only for its fitted data). Every part is one plain extrusion in one
plane. Back to front:
- **W:** the lower weight arm, dashed behind the piston rod.
- **R:** the piston rod and tappet.
- **U:** the upper working arm, dashed behind the catch.
- **L:** the lower working arm.
- **C:** three parts:
  - the catch, one plate with its eye boss;
  - the upper horn and weight arm, one plate like Brown's 182 outline;
  - the lower beak, Brown's crescent.

The carve takes these from the catch sweep at build time.

Each casting has a bored boss (r 0.40) running through its planes, and a
fixed shaft (r 0.20, Brown's hatched section) fills the bore flush. There
are no pin heads. The rods are flat bars with a round eye concentric with
the pin, hanging just behind their arm's eye. The pins run from the rod's
back face to the arm's front face.

Brown dashes the upper arm behind the catch, so the catch uses the shared
see-through style (`diagonal-catch-playback.js`). The undrawn frame and the
cast weights are no longer built. The 2D overlay (`d/o18x.png`) matches both
plates' arms, horn, crescent and catch.

**Rebake and provenance:**
- `node scripts/bake-diagonal-catch.mjs` gives 9001 keys and 777 compact keys.
  The input hash is unchanged.
- `docs/validation/181-projected-contact-motion.json` stays valid: none of the
  files it fingerprints changed.
- `review-diagonal-catch-assembly.mjs` rerun: 19 meshes, 150 cross-family
  pairs, 13.06M queries, **0 intersections**.
- `docs/validation/181-browser.json` has no generator and was already stale
  (p81); it is not regenerated.

## 183, 184: two-quadrant hand gear

**Before.**
- **Hidden latch features.** Two studs (pins), a rear lip behind the band, and
  a catch boss standing from the wing's face to the front.
- **The weight eye.** The rod eye sat on a neck added to the wing tip, in the
  wing's plane. Brown dots that rod and its arm behind the wing (the user's
  71/72.png).
- **The rods.** Their square top ends were centred on the pins, so each pin
  sat on the rod's edge.
- **Shafts.** They ran 1.12 long, past both faces.
- **Supports.** An undrawn back bar, guide and cylinder were still built.
- **The old "solve".** It was reversible, and the tappet never truly struck
  the upper handle.

**Why no drawn-only design works exactly as drawn.** I checked this against
the plate:
- Brown's two rims are true arcs: the band about the lower shaft (r 134.5 px)
  and the wing about the upper shaft (r 137.5 px).
- The wing's toe rests on the band's rim near its right end.
- Brown dashes the C-arm behind the whole lower quadrant.

So the only coplanar latch pair is the wing and the band. The band must turn
about 75° before its left end passes the toe. The tappet can lift the ball
lever only about 54.7° before it runs off the lever's end. Any latch at the
C-arm needs a hidden lip plus a stud or a joggle, which are the features the
user rejected.

**After** (`quadrant-catch-finite-parts.js`, `authored-quadrant-catches.js`,
both rewritten). Every part is one of Brown's outlines, extruded flat.
Back to front:
- **W:** the lower weight arm, dashed behind the rod and the crook.
- **R:** the rod.
- **B:** the upper weight arm, dashed behind the wing. Its rod hangs behind
  it, so both lie behind the wing.
- **A:** the upper C-arm and hook, dashed behind the lower quadrant.
- **F:** the band and web, and the wing.
- **H:** Brown's ball lever and crook, retraced.

There are no studs, lips, bosses or necks. Hubs are bored bosses through
their casting's planes, and shafts are flush. The rods are flat bars with
eyes concentric with their pins. Both front quadrants use the see-through
style, because Brown dashes working parts behind each.

The two quadrants latch only through the drawn rims:
1. The toe rests on the band's rim, which is concentric, so the band slides
   freely under it.
2. As the tappet runs off the lever end, it throws the lower handle on to 76°.
   The caption says "throws the catches and handles".
3. The band's left end passes the toe. The upper weight drops the wing onto
   its valve stop (10°), and the lower handle falls back against the wing's
   tip, held at 74.6°, clear of the tappet's path.
4. Coming down, the tappet strikes the hooked C-arm (plane A), turns the upper
   handle back and throws it clear.
5. The lower handle falls onto the tappet, rides it down, and the band slides
   back under the toe.

Tappet contacts are solved from the outlines. The drops, the stops and the two
throws are timed laws, so this is a kinematic approximation and forces are not
simulated. It is documented in `reconstructionNote`. 184 remains the 183 gear
reflected top to bottom. Its weight arms are plain tangent levers in W, behind
the rod and the wing, as Brown dots them.

**Bake.** `node scripts/bake-quadrant-catch.mjs` gives 721 rows. The worst
plate-plane overlap is 0.0025 px². Rerunning `review-quadrant-catch-solids.mjs`
on all 16 meshes at 65 poses gives a worst penetration of 0.00018; the only
contact is the wing on the band.

## Screens (181–184)

| Screen | 181 | 182 | 183 | 184 |
|---|---|---|---|---|
| Coincident faces | 0 | 0 | 0 | 0 |
| Loop seams | 0 | 0 | 0 | 0 |
| Edge mounts | 0 flagged (6 pins) | 0 flagged (6 pins) | 0 | 0 |
| Floating parts | 0 | 0 | 0 | 0 |
| Slivers | 0 | 0 | 0 | 0 |

Disconnected-parts screen, other findings:
- **181:** three "detached" components. They are whole moving bodies (the
  released upper handle with its shaft, the piston group) separated by motion
  gaps in two phases, not broken joints.
- **183/184:** the screen reports one "lip" of about 0.07 where the C-arm
  plate meets its boss. That is 0.6 % of the part size.

## Tests

These pass:
- `movement-183`, `movement-184` and `quadrant-catch-finite-interfaces`, which
  were rewritten to assert:
  - one plane per plate, with no studs, lips or bosses;
  - the planes follow Brown's dashes;
  - the rods lie behind their arms;
  - the see-through quadrants;
  - the transfer sequence, including the tappet bearing on the C-arm;
  - no penetration of the rendered solids.
- `diagonal-catch-baked`. Its envelope test now requires the working arms,
  catch and shoe to stay inside the qualified envelopes (bosses and eyes
  excepted), and the horn and beak to meet the catch only at the faces.
- `movement-181`, `movement-182`, `diagonal-catch-assembly`,
  `source-presentation` and `mujoco-baked-loops`.

`camera-catalog` and `authored-loader` fail only on movements 403 and 64,
outside this lane.

## Not done

- `src/data/display-profiles.json` still holds the old motion bounds for
  181–184. Regenerate it centrally with
  `node scripts/measure-display-profiles.mjs 181 182 183 184`.
- The unqualified 183 native study (`mujoco-quadrant-catch/`) still models the
  obsolete stud design. It is not the production design.
