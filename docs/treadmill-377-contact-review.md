# Treadmill 377: finite board and foot placement

The [primary engraving and caption](https://507movements.com/mm_377.html) show a person stepping on peripheral boards. The official page has no animation. The previous tangential boards presented almost vertical faces on the descending side, and the sinusoidal legs penetrated them by about 0.0525 model units.

The boards are now radial steps. Each planted sole follows a specific moving board for 60% of its gait cycle; the other foot travels outside the intervening board and lands on the next one. Cubic Hermite endpoints match tread velocity at lift-off and touchdown. Asymmetric outward/upward clearance arcs keep the complete shoe outside the boards during swing. Two-link inverse kinematics positions the knees and ankles without stretching the legs; the feet rotate independently to lie flat on their boards.

The inferred person station and leg lengths are adjusted together to give adequate reach and keep both shins clear of the next higher board. These dimensions, fourteen-board count, gait timing and smooth swing arcs are reconstruction choices, not measurements supplied by Brown. The mechanism retains steady clockwise rotation, seven gait cycles per wheel revolution, a minimum twelve-second display period, its source-facing camera, and the earlier bored journals/attached frame. There is always at least one planted foot, with brief double support.

## Verification

`tests/treadmill-gait-solids.test.mjs` uses an exact separating-axis check on the actual finite boxes over 1,401 wheel poses. Both soles, both upper legs and both shins clear all fourteen boards. Minimum separation is about 0.0005000. Actual sole corners lie within each planted board's radial/axial boundaries and 0.0005 above its face. Further bidirectional rendered-triangle checks cover the feet and shins against the torso and handrail at 281 poses. Limb lengths stay constant. Touchdown/lift-off position and angular velocity remain continuous in forward and reverse time; existing derivative and repeated-cycle tests pass.

The earlier independent surface checker could return NaN for collapsed capsule/sphere pole triangles. Its triangle extraction now discards zero-area faces, with a regression checking finite signed distances inside and outside both shapes. Distance assertions explicitly reject non-finite results.

The three new gait checks, eight existing 377 checks, seven neighboring runner/treadwheel checks and one surface-helper regression pass. Source/default/advanced browser views are reviewed as part of the integrated family pass.

## Remaining limits

Foot placement is prescribed, not a human dynamics simulation. Muscle forces, balance, friction limits, load distribution between hands/feet and reaction forces are unqualified. The mean weight-torque calculation is an explanatory steady-load assumption. This correction resolves the previous finite foot/board collision; it does not validate 376's separate horse gait.
