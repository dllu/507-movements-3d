# Ratchet corrections following user review

The user identified incorrect tooth shape on 073 and 075, thin axial contact
pins and an offset-looking rod joint on 075, a cropped background wheel on
076, and poor pawl engagement with excess travel on 077. The prior reviews
did not resolve these defects. Original sources and review documents are
preserved in [the baseline manifest](073-077-user-correction-baseline/manifest.json).

## Implemented changes

- **073:** replaced the broad, flat tooth crests with pointed, overhanging
  crests and curved backs. Updated the stop contact search to find the free
  pocket under the crest. The broader elastic-spring reconstruction remains
  part of the ongoing review; this pass addresses the tooth profile.
- **075:** reversed the short-face/long-back ordering and rebuilt the teeth
  with the engraving's shark-fin outline. Both full-thickness pawls now work
  in the wheel plane, with their undersides relieved against the relative
  tooth sweep. Removed the thin axial nose pins. The input rod sits behind
  the bar and swings on a fixed circular pin joint. Continuous gravity and
  inertia replace the framewise static-contact selection. Extra bar travel
  lets the right pawl clear the crest and fall before the wheel settles back.
- **076:** the complete background wheel is now the initial view. The
  optional engraving section remains available for comparing the drawing.
- **077:** reduced the hook head radius from 0.10 to 0.09, the lower head
  radius from 0.08 to 0.075, and lever amplitude from 0.26 to 0.245 radians.
  Recomputed the contact dynamics and playback for those solids. Dark pin
  caps make the working contact visible against the brass hooks.

## Contact and geometry evidence

For 075, the user correctly rejected the first shark-fin revision because
its static contact branch could teleport into the next pocket. The slot
was also unnecessary. [The continuous-motion correction](075-continuous-motion-notes.md)
supersedes that revision. All 32,000 interpolated nose-sweep intervals pass,
and 203 full-solid poses contain no intrusion above 1e-6 world units. The
right pawl visibly falls through free space; the rod swings on a round pin.

For 077, the revised simulation repeats with one additional pin pitch per
cycle. Both pawls seat their driving pins inside their hooks. The
[continuous playback contact bound](077-corrected-contact-bounds.json)
covers all pins and both outlines within 1e-6 world units. The
[independent-solid screen](077-corrected-surfaces.json) checked 272 poses
and 112,773,586 surface samples without an intrusion above that tolerance.
The 0.001-second integration step was compared with 0.002 seconds; the
largest conservative pawl-tip discrepancy was 0.56 engraving pixels.
Compression error stays below 1e-7 radians, and repeat-seam corrections
are below 3e-12 radians.

The [before/after playback measurements](077-correction-comparison.json)
show startup travel reduced from 1.3143 to 1.2848 pin pitches. Small wheel
rollback decreased by about 35%; the earlier coarse trial suggested 70%,
which the finer result supersedes. The wheel moves during approximately
82% of the cycle. Display periods are 4 seconds for 075, 12 seconds
for 076, and 4 seconds for 077.

Narrower-stroke and smaller-hook trials that stalled or did not retain
one-pitch indexing were rejected. The very thin-lip trial was stopped after
it produced no progress diagnostics and is not used in production.

## Validation status

Focused tests passed: 073's source/mechanism test, seven tests for 075,
eight for 076, and seven for 077. Final 075 desktop/mobile checks and
076 configuration/playback checks pass; 077's desktop/mobile check passed
in the earlier targeted regression. Final production captures for 075 and
077 are inspected.

The earlier all-507 browser sweep timed out after reaching movement 482;
it did not complete and is not counted as a pass. The preceding broad
browser run was intentionally interrupted after eleven passing tests.
See the preserved browser logs for both outcomes. The current full numerical
regression is recorded in `075-continuous-full-tests.log`.

The all-507 review remains active. The isolated 081 work is preserved at
[its loaded-study checkpoint](081-loaded-study-checkpoint.json).

Final regression: `npm test` passed all 3,094 tests with zero failures;
production build passed. Log: `075-continuous-full-tests.log`.
