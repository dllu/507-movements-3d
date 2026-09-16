# Hydraulic force family: 466–467

Primary references: [466 hydrostatic press](https://507movements.com/mm_466.html) and [467 Robertson's jack](https://507movements.com/mm_467.html), with their original engravings. Both official pages mark animation unavailable; no official 2D motion oracle is present. The captions determine the hydraulic arrangement and area/volume relationship, not dimensions, valve timing, force transients, or cycle duration.

## Bounded corrections

Both hand pumps now have longer piston rods so the wide crossheads remain above the narrow pump barrels. The original exact lever/pitman and plunger stroke laws remain. Finite bored levers, pitmans, fulcrum stands and crosshead pins replace solid intersecting joints. The inlet disks fit inside actual finite barrel walls; bored check seats and delivery chambers supply visible inlet/outlet passages. Rendering retains the authored readable cycle duration through `minimumDisplayCycleSeconds`, removes ground/fog, and uses a source-facing camera with full-stroke bounds.

For 466, the large ram is a solid broad shaft in a finite cylinder, matching the caption. Water ends at the piston underside throughout the stroke instead of filling through the solid ram. The narrower platen clears the frame columns, and the columns sit behind the pressure pipe. The pipe has a finite wall and passes through openings in the reservoir wall and ram cylinder.

For 467, the fixed ram and its internal delivery pipe have real axial bores, and the moving outer cylinder has finite wall thickness and running clearance. The pressure chamber stops below the actual top cap. The claw and saddle connect to the moving cylinder. Pump and check-chamber openings pass through the base lid. A closed helical thread replaces the spring-like return screw thread. Its shaft reaches an aligned conical needle and seat at the foot of the internal pipe; one prescribed turn withdraws the needle by the existing thread pitch and opens a real annular gap. The base wall has a corresponding screw bore.

## Evidence

`tests/hydraulic-force-solids.test.mjs` checks selected actual mesh surfaces in both directions at 65 cycle poses: pump joints/plunger, checks and chambers, moving ram/cylinder against neighboring supports, pressure-water port crossings, jack feed through the base lid, and return needle against its seat/passages/base. Additional regressions check actual seated/open/reseated cone geometry, water endpoints at 129 poses, stable mesh storage during playback and readable timing. Existing 466/467 analytic-law, volume, schedule and continuity tests are retained.

Browser source/default/front/advanced views and a 17-pose full-geometry framing sweep had no errors or clipping (maximum absolute screen coordinate 0.877 for 466, 0.876 for 467). Final hidden port-crossing corrections preserve those bounds. Review images and diagnostic reports are kept in `/dev/shm/hydraulic21-*`, outside Git.

## Limits

This is a finite-geometry correction with the existing ideal hydraulic animation. Checks, pressure-driven displacement, load compression and return metering remain prescribed. There is no solution of valve forces, compressibility, seal leakage, pressure losses, load dynamics or structural deflection. The reconstructed check chambers and pipe branches explain the route but are not qualified as a complete watertight, manufacturable manifold. Reservoir water remains an illustrative envelope around immersed machinery rather than a Boolean-subtracted fluid domain. The selected interference sweeps do not claim exhaustive all-pairs collision freedom or a fluid/contact simulation. No MuJoCo study is needed to retain the determinate lever and ideal area/volume laws; passive valve dynamics would be a separate study.
