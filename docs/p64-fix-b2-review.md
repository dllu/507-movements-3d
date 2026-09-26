# p64-fix-b2 review (pass 64: 223, 259, 299, 372)

Lane: p64-fix-b2. Input: audit findings in `/dev/shm/audit64/b/findings.json`.
Each change was checked against `public/engravings/mm_NNN.png`. Captures were
taken from the production route (`scripts/review-movement-source-views.mjs`)
plus a local rotated/phase capture script. They are kept under
`/dev/shm/p64-fix-b2` and are not committed.

## 223 four-plane stepped sector gears (`authored-stepped-sector-gears.js`)

Audit: the upper sector stack had no hub collar, and a bright seam line
crossed the lower sector.

- Brown draws a round hub collar around the hatched shaft in front of each
  arbor. It is about 0.5 of the four-unit shaft spacing in radius. Both
  arbors now carry a bored collar of radius 0.5 and depth 0.12, seated on the
  front sector face and turning with its rotor. The shafts, which used to
  stick out 0.36 beyond the stack, now end 0.02 proud of the collar. This
  reads like Brown's end-on shaft section.
- The seam was not a shading fault. `scan-bad-faces` reports 223 as clean.
  It was a real see-through slit. Sectors that abut at a common radial edge
  (for example output planes 1 and 2 at 120 degrees) lie in different planes
  0.2 apart, so an oblique line of sight passed between them to the
  background. The zoomed front and back captures showed it as a cream line.
  Each rear sector's web now laps 8 degrees behind its front neighbour, with
  radius limited to 0.08 inside both root circles. From the front the front
  sector hides the lap, and the mating sector in that plane never reaches it,
  since tip plus root is less than the centre distance. There are 8 laps.
  Each lap abuts its sector edge without overlapping it. A first version
  overlapped by 0.01 rad, and `scan-bad-faces` flagged 4 coplanar
  same-material faces. After the fix the scan is clean.
- Fresh captures: `after/223-default.png`, plus `c/223a-*` (front zoom, back,
  plus or minus 60 degrees, phases 0.3 and 0.6). The seam is gone, and both
  collars show in every view.
- The same-colour sectors of one arbor still read as one orange mass where
  they overlap. They are one rigid part, so they keep one colour.

## 259 notched V pulley (`src/data/rotation-indicators.js`, 259 entry only)

Audit: the flat faces had no quadrant rotation cue, unlike 255, 257 and 258.

- 259 is added with the body `true-periodically-notched-v-grooved-pulley-body`
  on an explicit geometry X axis. The notches break exact revolution
  symmetry, so the auto axis picks X only with a score of 0.086, above its
  tolerance. `notched-v-pulley-hub` is also added.
- Captures `c/259a-*` (default, +60, +60 at phase 0.1, -70) show the
  quadrants turning on both faces. The default edge-on view is unchanged
  apart from the cue on the rim.

## 299 verge and crown-wheel clock escapement (`authored-escapements.js`, 299 only)

Audit: the crown teeth were tall curved blades showing through as X shapes,
and the pallets were much smaller than drawn.

Plate reading (pitch = 245 px between the near tooth tips):

- Tooth height is 0.57 pitch.
- The leading-face rake is 0.35 pitch.
- The concave backs are gentle arcs. At mid-span the back stands at about
  0.36 of the tooth height, which fits a power law of about 1.6.
- The pallet strips are about 0.60-0.65 pitch long and 0.09 pitch thick.
- The journal centre sits about 0.11-0.16 pitch above the tooth tips.
- Brown also draws far-side teeth crossing behind the near ones: the X at the
  left and the line through the middle. The crossing itself is Brown's. It
  looked worse because the very deep backs (exponent 2.3) made every tooth a
  thin hooked blade.

Changes:

- Tooth backs use exponent 1.8, down from 2.3. Mid-back height is now 0.29 of
  the tip height, against 0.20 before and Brown's 0.36.
- The pallets are longer: release distance 0.64, which is 0.60 pitch, up from
  0.50 (0.47 pitch).
- A pallet of length L releases where cos(phi) = h/L, with h the staff height
  above the tips. The half-pitch advance per beat then fixes h. So the staff
  is raised from 0.129 to 0.25 (`heightToRadiusRatioOverride`). The pallets
  release 17 degrees past mid-swing and catch at 20.5 degrees, where they
  previously released at 25 and caught at 28.
- The foliot swing (45 degrees), recoil, the 13-tooth crown and a drop of
  2.0 degrees per beat all stay within the tested bounds.
- Before choosing these values, I tried exponent 1.6. It penetrates by
  0.005-0.014 with every staff height tried.
- The display phase is now cycle 207/256. That is just before a release, with
  a tooth tip at the end of the right-hand strip and the strips about 24 and
  56 degrees below horizontal (Brown: 15 and 59). The previous 0.125 phase
  showed the strip level and clear of the teeth.
- Fresh captures: `after/299-default.png`, `c/299v-*` (six phases, +60, and a
  raised oblique) and `c/299t-*`.
- Residuals:
  - The journal stands higher above the tips than Brown's, 0.24 pitch against
    about 0.15. A shorter height cannot give Brown's pallet length and still
    advance half a pitch per beat.
  - The backs still sag a little more than Brown's (1.8 against 1.6).
  - Far-side teeth still show through the gaps, as Brown draws.

## 372 White's dynamometer (`authored-dynamometers.js`)

Audit: the central wheel, which Brown draws with teeth, was a plain band with
no teeth and no rotation cue.

- Plate check: I measured the transverse lines Brown rules across the
  edge-on hoop. They are evenly spaced in angle, about 5-6 degrees once
  unprojected from its 174 px radius, and foreshorten towards the top and
  bottom as edge-on spur teeth do. In the companion plate 368, Brown rules
  only the gear and rack this way and leaves plain pulleys blank. So the hoop
  rim is now a 64-tooth spur rim, with tips on the former outer radius 1.50
  and roots at 1.445.
- The roots stay outside the carrier arms and braces, which are seated 0.07
  into the rim. A first try with 0.085-deep teeth exposed the brace ends in
  the tooth gaps; that was caught in a zoomed capture and fixed.
- Brown draws no mating pinion and nothing meshes with the hoop, so none is
  added.
- The hoop is held stationary by the (undrawn) weighing band. It does not
  turn in the displayed operation, so it carries no rotation cue. The teeth
  are now the visible feature in any case.
- Fresh captures: `after/372-default.png`, `c/372a-*` (back, plus or minus 60
  and 70 degrees, top, zoom) and `c/372z-*` (rim zoom after the fix).
- Faint shadow-map ripple shows on the tooth tops at close zoom.

## Verification

- Intersections (`show-body-intersections --spacing=0.01 --samples=129`):
  - 223: none (2 bodies, 68 meshes).
  - 259: none.
  - 299: only the tangent working contacts, `axial-saw-tooth x
    left/right-pallet-A-contact-face` at 0.0000.
  - 372: none (5 bodies, 90 meshes).
- Loop seams (`check-loop-seams --ids=223,259,299,372`): 0 seams, 0 pops.
- Face scan (`scan-bad-faces`):
  - 223 and 259: clean.
  - 299: the same 7 `zfightSameLook` spoke/band pairs as before this pass.
    They come from the untouched crown body.
  - 372: the same degenerate turned-stretcher lathe as before.
- Validation reports regenerated because their fingerprinted sources changed:
  - `docs/validation/221-222-223-contact.json`: 223 has 0 penetrating poses,
    maximum active gap 0.0067.
  - `docs/validation/368-372-contact-solids.json` (POSES=33): 0 penetrations.
- Tests:
  - movement-223 (the shaft-length bound now allows flush ends; new collar
    and lap test)
  - variable-idler-solids
  - movement-299 (second differences use a 1e-4 step, because the new
    non-0.125 display offset exposed 1/h^2 round-off at 1e-5; new proportions
    test that fails at the old exponent 2.3)
  - verge-crown-working-solids
  - movement-300, movement-301
  - movement-372 (new toothed-rim test)
  - scriber-dynamometer-solids
  - pulley-family-review
  - rotation-indicator "every listed role pattern"
  - All pass.
