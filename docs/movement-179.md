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
- [Current assembly](validation/179-current-solids.json): 61 meshes,
  1,366 cross-body pairs, 129 poses and 24,337,144 finite-surface queries,
  with no sampled intersections. Same rigid-family joins are excluded.
  This is sampled evidence, not continuous collision proof.
- Existing full-sequence motion tests and the new actual-bore/stop-gap test pass.
- Production build and packaged desktop/mobile playback checks pass, including
  Restart, orbit/reset, no overflow, no WASM request and no page errors.

The lifting handle previously extended to the wrong side of the gab. It now follows the source's leftward profile, with a 0.09-unit forward offset to clear the upright lever during lifting. The gab has a rounded crown and open mouth. Actual rendered grip and gab bounds fit the selected raster measurements within 1.05 and 0.79 pixels respectively. Both reversing-link pins now have retaining heads. Front framing uses sampled full-motion bounds.

[Source diagnostics](validation/179-source-fit.json) still show 10.81-pixel strap and 11.82-pixel eccentric-disk outline differences. The plate depicts perspective and different apparent circle centers, so those features need further reconstruction. The inferred overall framework also needs source review.

The new [native stop study](validation/179-native-stop.json) is **not qualified**. It actuates only the shaft against 64 convex cells approximating the sector, with ideal fixed axes and inferred inertia/resistance. Both 0.2 ms and 0.1 ms runs become unstable around 0.15 seconds, shortly after contact starts. The no-contact control remains stationary. The script detects excessive speed/reset, records the failure and exits nonzero; these results do not validate contact-driven reversal. They are an open solver/model investigation, not browser playback. Production remains the explicitly scripted ideal operator sequence.

Continue with the native contact instability, wheel source contours and remaining attachment review before advancing to 180.
