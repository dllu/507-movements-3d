# Movement 178 — eccentric circular-guide shaper

The reconstruction now follows the engraving's shaft and wrist centers, crank
outline, inner circular details and visible connecting-rod direction. Selected
rendered boundaries differ by at most 4.33 pixels on the 525-pixel reference.
The fitted joint landmarks agree to numerical precision; those are construction
constraints, not independent evidence of full-contour accuracy.

The [original page](https://507movements.com/mm_178.html) includes a 2D animation.
Its mechanism supplies the same circle/ray intersection and finite rod/guide
constraints used here, but its proportions differ from the engraving. Production
uses a 168-pixel groove-center radius and 76-pixel shaft eccentricity. The groove
edges differ by 2.5 pixels from the approximate measured edges to keep the wrist
on the drawn center. Rod length follows the visible rod slope and the inferred
horizontal guide through the disk center. The full rod and remote guide are
retained beyond the engraving's crop.

This changes the ideal top/bottom crank-radius ratio from the animation's
7.25/3.25 to 244/92. The original 2D dimensions remain available with
`createAuthoredVariableCrankMovement({id:178}, {reference:true})` for regression
comparisons. Both variants use scripted analytical constraints; there is no
claim of simulated friction, backlash, cutting loads or passive contact dynamics.

The fixed guide is one backed disk with a recessed annular track. Its unseen rear
web joins both lands and clears the circular shoe. Bored rod eyes, full-depth
pins and retaining heads replace intersecting solid spheres. Slider, shaft and
cutter depths clear their neighboring parts. Hidden depths, fits, the guide and
rear web remain reconstruction assumptions. Fog and ground are disabled. The
front view uses sampled full-motion bounds, without the old oversized envelope;
all geometry remains available when orbiting or zooming. Restart restores the
source pose, and a display revolution lasts at least four seconds.

## Validation

- [Source comparison](validation/178-source-fit.json): four fitted landmarks and
  four rendered outline bounds; maximum independent boundary difference 4.33 px.
- [Whole assembly](validation/178-current-solids.json): 30 physical meshes,
  336 cross-body pairs, 129 poses and 8,352,038 finite-surface queries, with no
  sampled intersection above 1e-6 units. This is not continuous collision proof.
- Three tests cover the original reference equations, the fitted full-cycle
  circle/slot/rod closure and framing, actual eye bores, concentric full-depth
  pins, retaining heads, shaft clearance and rear-web attachment.
- Production build and [desktop/mobile browser checks](validation/178-browser.json)
  pass playback, exact Restart, orbit/reset, overflow, no WASM requests and no
  page errors. Front and oblique views were inspected.

The [historical baseline](validation/178-existing-solids.json) records 28
interfering pairs before the slot and joint repairs. Movement 178's review is
complete with the assumptions and sampled-validation limits above. Next: 179;
the full 507-movement review remains active.
