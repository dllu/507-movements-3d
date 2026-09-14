# 135: Reuleaux valve cam — partial review

The [source engraving and animation](https://507movements.com/mm_135.html)
show a circular carrier rotating a true Reuleaux triangular tappet inside a
positive-return valve yoke. The carrier axis is at a triangle vertex; the
central visible boss fastens the tappet to the carrier. The existing analytic
three-arc profile, dwell intervals and constant-width motion are retained.

The working cam extrusion now has no expanding bevel and uses 96 curve
segments. Its nominal running gap to each liner is 0.001 world units. Actual
rendered mesh extrema over 721 poses give a maximum gap of 0.001006975 units,
without penetrating either liner. Previously the analytic gap was 0.025 and
the beveled mesh did not match the support profile used by the motion law.
The yoke follows the ideal centre trajectory within the small bilateral
clearance; backlash and valve load are not simulated.

The input shaft now ends behind the carrier's front face, keeping it outside
the moving yoke/liner plane. The visible cam fastener extends back into the
carrier disk, connecting the formerly separated bodies. Hidden axial depths
are reconstructed. Tests cover these connections and clearance through a full
turn, along with the existing analytic motion regression.

Default playback takes four seconds per turn. Restart is enabled, diagnostic
markers are hidden, the camera is nearly frontal, and the ground plane and fog
are disabled. Packaged desktop/mobile checks cover play, pause, exact restart,
JavaScript errors and absence of a WASM request.

```sh
node --test tests/reuleaux-valve-clearance.test.mjs tests/reuleaux-yoke-hardware.test.mjs
node --test --test-name-pattern='movement 135 uses' tests/models.test.mjs
```

The yoke now has bowed sides with straight working rails, following the
engraving's outline rather than a rounded rectangle. Valve rods use a 27-pixel
radius and outer endpoints measured 293/197 pixels above/below the yoke centre.
Their collars are enlarged to match the three-lobed attachments. Rods and
collars sit farther forward to clear the carrier disk.

Both guide shoes now have rectangular through-passages, giving 0.005 nominal
clearance per side around their rails. Connecting arms join the shoes to the
yoke. Full-stroke checks verify rail containment, arm connections and clearance
from the carrier, and rod/collar connections. The external guides remain an
inferred support system, not part of the engraving.

The rear bearing, remaining support details and final engraving comparison
still need review. Continue with 135.
