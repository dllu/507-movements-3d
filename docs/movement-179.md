# Movement 179 — single-engine reversing gear

The [source caption](https://507movements.com/mm_179.html) describes lifting the
eccentric rod, working the valve by hand, and allowing half a turn of shaft
motion relative to the loose eccentric before lowering the rod again. The page
has no enabled 2D animation. The current model scripts an ideal 24-second
forward/reverse/operator sequence; it does not simulate the engine's response,
operator forces, friction or impact. That distinction remains relevant to its
final mechanical review.

## First assembly repair

The baseline finite-solid sweep found 34 intersecting pairs. Solid stuffing-box
sleeves and collars crossed the spindle; the bearing ring and pedestal crossed
the shaft. Guide and pivot bores are now open. The spindle runs in front of the
rod and lever, with extended connecting pins and revised support geometry.
The reversing link has flat bored eyes and beam ends outside the pin bores.

The old stop sector and round end pads overlapped the shaft lug. The nearly
semicircular sector now allows for the lug's finite width at both ends. Its
trim angle is `asin(lugHalfWidth / stopInnerRadius) + 0.002`; the ideal relative
shaft travel remains half a turn. End pads and penetrating contact markers are
removed. A separate finite-surface test checks both driving configurations and
bounds their small working gap between 0.0005 and 0.003 world units.

Ground is hidden, fog remains disabled, Restart restores the source pose, and
the whole operator sequence retains its 24-second display duration.

## Evidence and remaining work

- [Historical baseline](validation/179-existing-solids.json): 62 meshes,
  1,460 cross-body pairs, 129 poses and 34 intersecting pairs.
- [Current assembly](validation/179-current-solids.json): 63 meshes,
  1,439 cross-body pairs, 129 poses and 23,297,716 finite-surface queries,
  with no sampled intersections. Same rigid-family joins are excluded.
  This is sampled evidence, not continuous collision proof.
- Existing full-sequence motion tests and the new actual-bore/stop-gap test pass.
- Production build and packaged desktop/mobile playback checks pass, including
  Restart, orbit/reset, no overflow, no WASM request and no page errors.

Movement 179 is still under review. The default view is oblique and includes
substantial inferred framework. The gab and lifting handle need quantitative
source-contour comparison, and pin retention/attachment needs a complete review.
The programmed release, manual valve motion and stop take-up also need review
against the caption before deciding whether native contact validation is needed.
Continue with those items before advancing to 180.
