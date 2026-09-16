# Drawing instruments 406–407

This pass preserves 406's exact ideal parabola constraint and corrects the selected arch and finite working interfaces of 407. It adds no live physics or per-frame GPU geometry allocation.

## Sources and motion boundary

The primary [406 page](https://507movements.com/mm_406.html) specifies a sliding square against the directrix and a pencil in the thread bight; [407](https://507movements.com/mm_407.html) specifies a slotted base, adjustable cord pin, elastic wooden bar, fixed tangent at the jamb and pencil at the cord connection. Both pages explicitly mark `Animated` unavailable. The local engravings were reviewed alongside the caption; there is no official animation oracle for these two instruments.

406 retains the exact point-thread relation `|FP| + |PA| = blade length` and `y = -x²/(4f)`. Its sweep now reaches both endpoints of the given base, rather than stopping short. The physical blade bears on the side of the pencil, rides above the fixed focus pin, and has a connected deeper stock. The two finite cord legs meet tangent wraps around the focus and pencil; the vertical leg remains visible beside the blade. Their planes are separated by 0.08 units (cord diameter 0.05), and a shallow helical pencil wrap joins them with zero depth slope at each end, clearing the projected cord crossing. These finite wraps add a visible thickness allowance to the ideal point-thread law; their total finite-radius length is not claimed constant.

407's former circular half-arch overshot above its apex because its prescribed span exceeded its rise. The replacement retains those source proportions and uses a unit-speed curve with `theta(u) = phi (2u-u²)`. Its curvature tapers to zero at the free tip, and `phi` and material length are fitted to the given span and rise. The selected tip angle is about 73.1 degrees from vertical, so the whole working edge rises monotonically to the crown. Fixed eight-point quadrature supplies the profile and analytical derivatives; the original smooth take-up/reset timing remains.

The base now has an actual through-slot with a bored slide and retaining cheeks. Its relief block follows the maximum-bend envelope, while a fixed root tab retains the jamb tangent. The strip stops short of a separate bored pencil eye, avoiding a pencil through solid wood. The finite cord ends at the outside of the attached pin and pencil loops. Both pencil cones now face the correct way, and their tips touch the board instead of penetrating it.

## Checks

`tests/drawing-template-working-solids.test.mjs` sweeps selected actual rendered surfaces in both directions over 33 poses: the pencil, blade, focus pin, finite cords (including both legs against each other and their changing helical wrap), slot/slider, moving strip, fulcrum and tip eye. Deforming strip and bight surfaces are rebuilt per pose in the independent audit. Positive inside/outside tests guard against incorrect surface winding or merely painted holes. Independent sampled arclength, monotone apex, complete parabola travel and retained GPU geometry are also checked.

The existing movement tests retain the exact analytical constraint and derivative checks; obsolete assertions requiring finite cords to penetrate pin centers or requiring the incorrect circular arch were replaced. The combined test command is:

```
node --test tests/drawing-template-working-solids.test.mjs tests/movement-406.test.mjs tests/movement-407.test.mjs
```

Initial browser default/front/advanced source captures passed without errors or clipping (maximum projected coordinates 0.837 and 0.871). The final 406 cord visibility adjustment also passed a repeat source/front/advanced capture, with maximum projected coordinate 0.837 and no browser errors. Ground/fog are disabled and minimum display periods are eight seconds for 406 and six seconds for 407. A warm local CPU sample measured median update costs of about 0.18 ms and 0.25 ms, respectively; this is a local timing sample, not a device-independent performance guarantee. Artifacts remain in `/dev/shm/drawing25-*`.

## Residuals

Both displays prescribe manual operation. Thread tension, finite-radius string-length correction, friction, pencil force and elastic hysteresis are unsolved. The raised square, separated cord planes and helical wrap, small cord clearances, tip eye, slide cheeks and relieved fulcrum are inferred constructions; the engraving does not dimension their depth or fastening detail.

407 is a setup demonstration of a selected flexible template. Its intermediate tapering-curvature shapes are not a solved elastic equilibrium under the changing cord direction. The pencil tip's setup trajectory is not the entire final arch; the opposite half is a reference mirror. This pass qualifies selected working interfaces, not every illustrative mark, board/support junction or elastic material stress.
