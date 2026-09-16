# Movement 213: finite split-rim contact reconstruction

This replaces the incompatible radial-tooth playback diagnosed in the
[earlier feasibility study](split-rim-213-feasibility-review.md). It is a bounded
geometric reconstruction, not a validated passive friction or impact simulation.

## Source and reconstruction

The [213 caption and engraving](https://507movements.com/mm_213.html) describe
another winding stop for the purpose explained by [212](https://507movements.com/mm_212.html).
The source shows a face pin, five teeth on a split ring, and uncut terminal rim.
No registered inline animation model was available for this movement. The source
does not dimension a conjugate tooth profile or prescribe a motion law.

The full pin radius **0.191573744**, centers, orbit, five installed teeth,
22 equivalent pitches, split and uncut rim are retained. The original radial
passage could only accept radius **0.173088162** at closest approach. Changing
phase alone could not correct that incompatibility.

The new rounded/scalloped working teeth are **materially shorter than the square-ended
engraving reconstruction**: their radial range is **1.704779–1.869747**, versus
the former 2.124126 tip radius. The uncut outer rim retains radius 2.124126.
This is an explicit source-shape limitation, not an exact superposition claim.
The canonical source pose differs by about **−2.174°** in stop-wheel orientation.

## Profile and motion are generated together

`generate-split-rim-213-contact.mjs` first cuts a periodic trial profile with the
full finite pin. It then solves a clockwise retaining branch: retain the current
output pose while clear, and advance to the first nearby separating contact when
the pin reaches a flank. The opposite retaining face is solved separately for
reverse motion. Local searches reject a disconnected branch or a step exceeding
0.02 radians. A 0.00005-radian bracket increment resolves the narrow feasible
interval near closest approach; the earlier coarser search skipped that interval.

The final five-tooth sector is cut against both retained paths. A 0.0002 radial
allowance accounts for the sampled envelope, tapering to zero at both winding
limits to preserve actual finite terminal contact. The browser uses offline
geometry and four C1 monotone cubic motion tables; no per-frame mesh generation
or live physics is introduced. The trial quintic is not the playback law.

After the first reversal take-up, each complete input turn advances one output
pitch (**0.285599332 radians**). Rest-position take-up is **0.001090497 radians**,
so the first post-reversal stroke advances **0.996182 pitch**, followed by full
pitches. Both hard stops retain the **5.799901908-input-revolution** winding
range. Moving forward and reverse branches differ by up to **0.036192711 radians**
at the same input angle; that face-to-face hysteresis is larger than the rest
position take-up and is not concealed by replaying the forward path backward.

## Measured checks

`node --test tests/movement-213.test.mjs tests/split-rim-213-contact.test.mjs`
passes **10/10 checks** (five updated legacy checks and five finite-contact checks):

- 8,193 poses in each direction: full-circle pin clearance to the actual outline
  is at least **0.0000003293**, and the largest working gap is **0.000656497**.
- 130 indexing poses: rendered pin surface samples against the actual extruded
  stop triangles have minimum clearance **0.000240944**.
- Actual adjacent triangle normals support the circular contact reaction,
  including the normal cone at polygon corners. Sampled driving face moments
  exceed **0.9** with the required sign in both directions; the broader outline
  screen found forward magnitudes **1.01250–1.50369** and reverse
  **1.02848–1.50369**. These are useful moment arms, not solved contact forces.
- Both terminal seats have gap below **0.000001**. Attempting another
  **0.0001 input radian** with the stop wheel held produces more than
  **0.0001** finite-pin overlap at each terminal, confirming real blocking rims.
- Turn boundaries, complete demonstration closure, reversal take-up and scene
  object/geometry identity are checked. The legacy full-cycle screen covers
  **32,769 states**.
- The largest 8,192-step playback increment is **0.016127708 radians**.
  Centered probes around this steep pickup give changes **0.00686135,
  0.000686091, 0.000068609, 0.000006861** as half-width shrinks from 1e−3 to
  1e−6 seconds: continuous motion, not a reset jump. Away from Hermite knots,
  the velocity finite-difference error converges quadratically, reaching
  **2.39e−8** at half-width 1e−5 seconds. Acceleration can change at C1 knots.

`node scripts/generate-split-rim-213-contact.mjs --check` confirms byte-identical
regeneration of the checked-in bake. Root's source/default/oblique browser review
reported no errors or clipping and maximum normalized extent **0.918**. Ground
and material fog are disabled; the display cycle has an 18-second minimum.

The final production build passes in 22.22 seconds and the complete ten-case
packaged pass, including this movement's desktop/playback/mobile case, passes
in 20.8 seconds. Construction measured 144 ms and sampled update P95 0.523 ms,
with no screen flags or object/geometry growth. CPU timings exclude imports,
GPU rendering and browser loading. Source-pose screenshots and logs remain
under `/dev/shm/family43-*`.

## Remaining physical limits

Frictional retention and directional branch selection remain prescribed.
Neither spring/friction forces, passive stability, impacts, inertia nor load
capacity are dynamically solved. The small running gaps mean a nominal active
phase is not proof that separated faces actually transmit force. A loaded
simulation would need a defined retaining torque and contact compliance, then
validate pickup and reversal against these finite profiles. The shortened
scalloped teeth remain an explicit source-fidelity tradeoff requiring a future
joint dimension/profile reconstruction if square-ended source proportions are
required. No MuJoCo force claim is made by these geometric checks.
