# Pass 72 lane p72-a: 37, 195, 204, 208, 216, 71, 206, 211, 225

Each ID was compared with `public/engravings/mm_NNN.png` in fresh production-route captures:
default view at four phases, ±60° about vertical, back and top.

- Before and after tiles: `/dev/shm/p72-a/{before,after}/NNN.jpg` (plate at top left).
- Side-by-side and zoomed comparisons: `/dev/shm/p72-a/c225a.png`, `c204a.png`, `c216v.png`,
  `z37ba.png`, `o206ba.png` and `o206z.png` (the plate traced in red over the render at the
  fitted wheel scale), `cmp225.png`.
- Probe scripts: `/dev/shm/p72-a/probe/`.

These are scratch files and are not in Git.

## 225: vibrating carrier with one hinged pawl — fixed

The bar used to be one arc of sagitta 0.44 (17% of its length) of constant width. Earlier lanes
found that a flatter bar hits the tooth behind the nose. The new approach changes invisible
parameters: the nose, the return solve and the taper.

- **Where the collision came from.** I mapped the wheel outline into the pawl's frame over 1,025
  phases and recorded, along the bar, the highest point the teeth reach. With the old nose
  (radius 0.09, 58% up the steep face), the tooth behind the nose rises 0.055 above the
  hinge-nose chord during the drive. On the nose-only return solve it rises 0.089 above the
  chord, because the nose drops into each gap and takes the bar down onto that tooth.
- **Return solve.** The return now also lifts for the bar itself. `carrierPawlBarLiftLimit225`
  maps every densified wheel point into the hinge's polar frame and bounds the pawl angle, so the
  bar's wheel-side edge rides 0.003 clear of the tooth tips. This costs 0.6 ms per frame. The
  whole-outline bisection that p65 dropped cost about 50 ms. The pawl angle is the smaller of
  the nose solve and this bound, so only the drive stroke constrains the bar's shape.
- **Nose.** The nose is now a slim rounded point: radius 0.06, bearing 80% up the steep face.
  The drive envelope then stays at or below the chord (worst −0.003), so the bar's wheel-side
  edge need only rise 0.07 over the last 0.4.
- **Bar.** The centre line is one arc of sagitta 0.17 (6.4%; Brown about 4.8%). The bar tapers
  from 0.12 at the point to 0.33 at the hinge eye, as Brown's does (0.14 to 0.33 measured square
  to the bar). Most of the taper is on the outer edge, so the upper edge is the more convex one,
  as drawn.
- **Measured.** Whole-outline clearance over 257 phases: minimum 0.00020, the designed nose
  running gap. The bar alone clears the teeth by 0.0074 through the drive. The largest nose lift
  on the return is 0.096 (the bar rides the tooth behind). The face moment is now 1.46 or more
  (test threshold 1.39).
- **Tests.** Tolerances on the drive-stroke contact travel and on the pawl length were
  loosened, and they are round-off only: 2.2e-15 and 1e-15 were measured. The sliding sanity
  bound is now 0.012, from 0.022: the slim nose slides 0.0153. The return test now measures the
  whole-outline ride clearance (about 0.003) instead of the nose-only clearance.

## 204: skew hyperboloid rollers — improved

- Brown's axles are plain stubs at all four ends: about 0.13 of the end diameter across,
  standing about a third of it clear of each face. The upper roller's left stub and the lower
  roller's right stub show beyond the bodies. Ours were thin 0.095 shafts with short 0.2 hubs,
  and the far-end stubs were hidden.
- The end hubs are now plain bored stubs, radius 0.21, standing 1.1 beyond each face
  (`stubRadius` and `stubLength`). The internal shaft ends flush with them. All four stubs now
  show, as on the plate (`c204a.png`).
- **Residual (unchanged, forced).** The end ellipses measure about 0.38 against Brown's 0.43 on
  the upper roller and 0.49 on the lower. For equal hyperboloids seen square to the common
  perpendicular, the ellipse ratio is e = sin α. The projected centre-to-end length over the
  end diameter is at most cos α·√(1−w²)/tan α, where w is the waist ratio. For Brown's waist
  (w ≈ 0.55), e = 0.46 would give L/D ≈ 1.1, against his roughly 1.7 (front roller) and
  2.3 (back roller).
- Brown also draws the front roller 1.28 times the size of the back one. Only a wide lens gives
  that, and a wide lens closes the side end faces further (e = sin(α − θ)).
- Moving to α = 27° would trade ellipse error for length error at about equal size (e +9%,
  L/D −8%), so the 25° setting stays.

## 216: mutilated external/internal gear reverser — fixed

- Brown's ring teeth are about 0.45 of the pitch wide at mid-depth (measured by angular scan:
  pitch 7.2°, teeth 3.0–3.5° wide) and about as deep as they are wide. Ours were 0.38 pitch
  wide with parallel flanks and 0.72 pitch deep, so they read as slender slivers.
- The working flanks are now short conjugate involutes: 14.5° pressure angle and 0.015
  backlash. Depth is 0.2 (0.51 pitch): pinion and sector 0.875–1.075, ring 2.925–3.125. Widths
  are 0.189 at the pitch circle (0.48 pitch) and 0.144 (external) or 0.155 (ring) at the tip.
  Beyond its pitch circle the ring tooth keeps its pitch-circle width, so it reads square and
  not as a wedge.
- The pinion motion is the prescribed exact 1:1 and 3:1, so the involutes are conjugate. The
  16,385-state polygon test is clean, including the source handoff teeth (unchanged, scale 0.8).
- The inactive-sector radial margins are now 0.05 and 0.05 (were 0.059 and 0.025).
- Tests: the pinned radii and the square-width checks were rewritten for the new profile.

## 37: conical stud gear — improved

- The stud heads now stand about half as proud: mean 0.048 and maximum 0.053 above the body in
  the same probe that gives 0.095 and 0.114 for the pass-65 state.
  - **Head face parallel to the cone.** The uncut head face was a fixed step past the stud's
    centre pitch radius. On a cone of slope 0.42, that made the upper edge of each round head
    stand 0.42 × 0.055 = 0.023 higher. The face now runs a fixed step past the local pitch cone
    (`conicalStudCut`), so engagement is uniform across the head.
  - **Shorter teeth.** The toothed cone's stub addendum is now 0.15 module (was 0.45), and
    `studFront` is 0.025 (was 0.03). The body still clears the tips by 0.012.
- The clearance cut was rebaked (`scripts/bake-conical-stud-profile.mjs`). The clearance test
  gives stud/tooth 0.00019 and tooth/body 0.0120.
- On the face the heads now read as flat dots (`z37ba.png`).
- **Residual:** at the silhouette the top one or two heads still show as small bumps, about
  0.05 proud. The engagement past the tooth tips is the protrusion less the 0.012 body relief,
  now 0.036. Any stud that drives must stand proud by at least its engagement.

## 206: shared-pivot double-stroke ratchet — improved slightly, still minor

- An overlay of the plate on the render at the fitted scale (`o206ba.png`, `o206z.png`) shows
  what really differs at the right pawl. The end taper is not the issue: Brown's end is also an
  oblique cut to a point.
- The issue is that his right band runs about 0.3 closer to the teeth over its lower half, and
  his point reaches deep into a tooth space. That point is at 39° about the wheel centre and
  radius 166 px; our finger bears at 35.6° on the tips, from the fitted anchor (408, 193).
- The right band's centre line now rises by smoothstep instead of a sine ease: it stays near
  the end radius longer, then rises in its middle. The whole-outline probe (800 samples per
  cycle, points more than 0.45 from the nose) gives band clearance 0.104 (was 0.179). The only
  contacts are the designed nose contacts.
- The visible gain is small. Moving the right pawl's anchor into the tooth space would change
  the solved lever and contact geometry, and I did not attempt it in this pass.

## 71, 195, 208, 211 — forced, with quantitative reasons

- **211 cut arc.** The plate fixes the pitches: wheel 8° (11 teeth over 88°) and pinion tips
  20° apart. The ratio is therefore 2.5, and one pinion turn needs 360°/2.5 = 144° of wheel.
  - The plain rim can lock only while the pinion's 100° concave lock sector faces the wheel. The
    wheel must be relieved wherever a pinion tooth passes, which gives the 137° measured.
  - Brown's 95° arc would need a ratio of about 3.8, which his own tooth pitches contradict.
    Leaving the relocking relief uncut would make the pinion teeth strike the plain rim.
- **71 slits.** The p64 analysis stands: the 55° push is set by Brown's 0.662 D orbit and his
  0.34 D struck-stud radius. Two alternatives were checked:
  - Displaying B 30° later aligns the slits but moves the tappet 30° and C's studs about 15°
    off the plate.
  - A slit wide enough to cover both Brown's static crossing and the working crossing would be
    about 35–40° wide, against Brown's narrow notches.
  Neither reads closer.
- **208 slot ends.** Closed ends fail even without shifting. While running, the engaged pins
  drift −0.082 to +0.40 along the shaft at the slot mouths, beyond the pinion's faces.
  Shifting also moves the in-slot pin out through an end.
- **195 slots.** The worm axis lies in the wheel's face plane at 1.14 from its axis. The
  visible face contour is therefore the envelope of the worm's axial rack section rolling on
  the 0.98 pitch circle, plus the helix offsets below the face.
  - A radial straight slot that clears the thread over the engagement arc spans about 77% of
    the pitch, against Brown's roughly 43%.
  - Brown's rectangles are not generated by any worm of his drawn lead.

## Checks

- **Intersections** (`show-body-intersections`, spacing 0.01, 129 samples), after:
  - 225, 204, 216 and 37: none. Before, these were also clear.
  - 206: the same two 0.0001 designed nose/tooth contacts as before.
  - 71, 195, 208 and 211 were not changed.
- **Faces** (`scan-bad-faces`):
  - 37, 206 and 225: clean.
  - 204: clean. The 4 end-face/hub coplanar overlaps are gone, because each stub starts 0.001
    off its face.
  - 216: 48 same-look tooth/root overlaps, unchanged in kind.
- **Loop seams** (`check-loop-seams --ids=37,195,204,206,208,211,216,225,71,63,235,236,240`):
  0 seams, 0 pops, 0 errors.
- **Source views** (`review-movement-source-views`): all nine are framed (maximum NDC 0.91)
  with no page errors.
- **Tests** (all pass):
  - movement-063, 071, 195, 201, 202, 203, 204, 205, 206, 207, 208, 211, 215, 216, 225, 235,
    236 and 240;
  - alternating-pawl-236-contact, ratchet-stop-240-working-parts, carrier-pawl-225-contact,
    skew-friction-working-solids, conical-stud-clearance, feed-worm-assembly and
    feed-worm-wheel;
  - models.test (movement 37);
  - bevel-200-226-solids, irregular-gear-family and special-worm-solids.
- **Regenerated reports:**
  - `review-200-226-bevel-solids`;
  - `review-special-worm-solids` (POSES=33);
  - `review-irregular-gear-contact` (JS and Python);
  - `review-variable-face-contact` and `save-variable-face-contact-report`;
  - the conical stud cut (`bake-conical-stud-profile`).
