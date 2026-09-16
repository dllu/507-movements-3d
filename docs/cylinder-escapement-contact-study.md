# Cylinder escapements 294–295: bounded contact-branch study

This follows [the support review](cylinder-escapement-family-review.md). Primary sources remain [294](https://507movements.com/mm_294.html) and [295](https://507movements.com/mm_295.html); their caption requires alternating inner/outer rests and two opposed impulses. No registered original animation is available. The source uses three plan outlines to show successive states of one cylinder.

**No replacement contact mechanism was accepted in this pass.** The production geometry and timing remain unchanged. Viewer text now explicitly discloses finite tooth/shell intersections and unvalidated loaded locking/impulses. Runtime contact metadata identifies a prescribed reference point rather than a validated finite surface. This is evidence and qualification progress, not a completed mechanical correction.

## Independent finite witnesses

The nominal contact reference lies **0.01678716 model units inside the actual tooth solid** at both rests and the entry/exit impulses (`q=.1,.205,.48,.705,.86`). Consequently, the existing zero point residual and analytic normal do not identify any real tooth surface or normal cone. They cannot qualify loaded transmission.

Selected actual-solid checks include all 15 teeth, rather than only the nominal active index:

| Cycle phase | Actual surface | Sampled penetration |
| --- | --- | --- |
| 89/128 | Working cylinder shell | 0.08128915 |
| 98/128 | Exit lip, preceding tooth 0 while nominal active tooth is 1 | 0.02588553 |
| 95/128 | Entry lip | 0.02382578 |

These are retained unresolved defects. Tests preserve the witnesses and disclosure together; a future real correction should replace their assertions with actual clearance and opposing load-normal checks, not retain a false residual after fixing the mechanism.

## Rejected first-contact candidate

The bounded alternative used a genuine upper 180° annular shell, reversed 44° balance motion, and an asymmetric closed triangular tooth with vertices `(3.05,0)`, `(2.67,.10)`, `(2.67,.35)` in wheel coordinates. Shell radii were 0.47728751 and 0.63434920. At each of 513 imposed balance poses, a clockwise first-obstacle search stopped the wheel against the complete finite profile with 0.0005 model-unit clearance. All 15 teeth were then checked against the unexpanded shell.

It achieved zero sampled overlap area and a 24.000028° net advance, but this does **not** constitute a working escapement. At phase **0.755859375**, essentially the entire **3° exit advance** occurs in one 1/512-cycle interval: the wheel is released instead of sustaining the required opposite-sense impulse. The entry-side free drop likewise needs a finite flight/landing schedule; its largest step was 18.406° at phase 0.255859375. Interpolation, passive balance dynamics, impact and force transmission are unqualified. The experimental schedule was therefore not baked into production.

A longer trailing-edge variant retained the missing exit impulse. A source-shaped trailing triangle under the unchanged production law also left a preceding-tooth shell penetration of about 0.077535 at phase 0.203125 and about 0.062731 during the later nominal outer lock. Those quick RAM-only variants were not retained as additional production profiles. The next study must jointly change the actual exit-working edge, the inner-rest branch and adjacent-tooth transfer. A clearance sweep alone will not solve that requirement.

## Reproduction and validation

The retained experiment requires Python 3, NumPy and Shapely 2.0.3. It writes only to RAM and labels its output rejected and force-unvalidated:

```sh
python3 scripts/studies/cylinder-contact-branch.py /dev/shm/cylinder43-study.json
node --test tests/movement-294.test.mjs tests/movement-295.test.mjs tests/cylinder-escapement-support-solids.test.mjs tests/cylinder-escapement-contact-limits.test.mjs
```

**23/23 tests pass** in 1.34 seconds, including the prior 21 support/nominal-law checks and two independent finite-witness/disclosure checks. Logs: `/dev/shm/cylinder43-tests.log`, `/dev/shm/cylinder43-study.log`. No browser or MuJoCo study was run in this lane. Native dynamics should follow a coherent two-impulse contact geometry, not be used to conceal this rejected release branch.
