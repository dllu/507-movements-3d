# 238: finite B-flank impulse branch

This follow-up closes the specific B contact/velocity mismatch recorded in [the previous review](seven-tooth-238-contact-review.md). The [official caption and engraving](https://507movements.com/mm_238.html) show wheel D, pallets B/C and their common axis A. The fetched HTML explicitly marks animation unavailable and contains no registered inline model. There is no official motion oracle for this instrument.

## Corrected constraint

The former point law made a star tip slide along B's long plane, although the actual nearer pair was B's inner corner against an existing wheel flank. The new branch constrains that finite corner to the actual flank. At each carrier angle its distance from D selects an edge of the radial-monotone flank; an analytic line/circle intersection fixes the wheel angle. The actual edge normal resists the counterclockwise wheel drive and supplies positive B-carrier impulse. The reaction also lies inside the two incident faces' normal cone at the pallet corner.

The solver reads the cleaned contour used by the rendered extrusion. This matters because the existing plate helper removes nearly collinear baked vertices. Using the uncleaned bake left a measurable normal-velocity error even when geometric distance was tiny. Seven small per-sector branches account for the rendered Float32 contours; reported edge indices identify the actual supporting contour edge in the physical wheel. Playback uses a binary edge lookup and analytic formulas, with no polygon cutting, collision search, or native solver.

For the first cycle, B lock begins at wheel angle **0.000130408848 radians**. B releases at wheel angle **0.087709420975 radians**, with carrier angle **0.069763986156 radians**. This is only 0.000049184 radians below the former carrier maximum. Release occurs at the existing star tip. The prescribed first drop joins the unchanged C lock while the carrier finishes that small remaining travel. The second drop joins the next physical B flank. Scheduled lock, impulse and drop boundaries retain continuous position and velocity, including repeated cycles. Tiny velocity changes at individual faceted flank joints remain prescribed impacts.

No visible working profile, depth, pallet support or journal was changed. The complete seven-tip baked wheel remains byte-identical, including its previously disclosed 13.1381% area reduction and shortened B face. Existing nominal point kinematics remain separately available for historical reconstruction and deterministic profile regeneration; rendered state and public current-state methods use the new finite branch.

## Focused evidence

```sh
node --test tests/seven-tooth-238-contact.test.mjs tests/seven-tooth-238-working-parts.test.mjs tests/movement-238.test.mjs
python scripts/generate-seven-tooth-238-profiles.py --check
```

**16/16 tests pass**, in approximately 2.8 seconds. The regeneration check reproduces all 45,702 bytes. SHA-256 of the unchanged profile module: `f88a28f97752d24289c049354ed742f6ea0e29cb9ed8691586c1e81d08147fc4`.

- Actual rendered triangle contact and normals at 513 poses across the first and fourth cycles: maximum gap **1.88e−13**, maximum relative normal velocity **4.94e−14**. The minimum resisting wheel moment is **0.71723**, and minimum positive pallet moment is **0.52137**. The least-negative pallet-corner cone projection is **−0.0093584**.
- Full-cycle bidirectional working-body/mount/carrier sweep: 4,444,180 signed-distance queries, minimum separation **−9.79e−14**. Journals retain at least **0.00397169** clearance.
- A 2,049-pose flank sweep is monotone, and analytic derivatives match finite differences. Attempted wheel advance at selected B lock/impulse poses penetrates the actual corner: this is a load-bearing obstruction, not simply a clearance route.
- Scheduled handoffs remain continuous from cycles −1 through 9. The wheel advances one complete revolution every seven oscillations; rendered/public state agrees and GPU buffers remain unchanged.

Logs: `/dev/shm/238-final-tests.log` and `/dev/shm/238-final-bake-check.log`. Central browser review inspected the source-facing and oblique views without errors or clipping; the maximum full-cycle normalized viewport extent is 0.862. The CPU screen reports 122 ms construction, 0.400 ms update P95 and no object or geometry growth (imports and GPU work excluded). Evidence: `/dev/shm/family44-238-browser-review.json` and `/dev/shm/family44-238-screen.json`.

## Remaining qualification

This verifies the selected B finite geometric impulse branch, not a freely running escapement. The oscillator, dwell and drops remain prescribed, as do impacts at faceted joints and capture. Friction, preload, energy transfer and sustained oscillation have not been simulated. C retains the prior supporting-tip geometry with approximately 0.0005 clearance from its nominal contact plane; it was not reconstructed into a new exact contacting branch here. The previous source-fit assumptions—4° half-swing, shortened B and the trimmed but complete seven-tip wheel—remain explicit. The viewer continues to disclose these limitations and does not claim complete dynamically validated transmission.
