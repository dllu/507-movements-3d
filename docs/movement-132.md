# 132: two-bar toggle press — partial review

The [engraving and caption](https://507movements.com/mm_132.html) describe a
fixed-height upper disk rotating two oblique bars toward vertical, lowering a
nonrotating platen. No original 2D animation is supplied on this page.

The current analytical linkage retains equal bar lengths and the same platen
stroke, but reverses its spatial handedness. Previously the handle swept behind
the shaft through the right frame column. It now sweeps in front of the frame;
the starting handle pose and its range are unchanged in magnitude. Upper joint
positions, velocities, accelerations, rotor transforms and lever geometry all
use the same reflected convention.

A finite oriented-box test covers every mesh of the lever and grip against
both frame columns at 721 phases. These enclosing boxes stay disjoint, which
also proves clearance for the enclosed solids. Reflecting the lever back to
its former sweep produces a collision, providing a failure control. The
existing full linkage regression still passes, including rod length and
kinematic derivative checks.

The fixed collar and all three overhead frame layers now have actual shaft
bores, with radius 0.21 around the 0.19-radius shaft. Their triangulated surfaces
have at least 0.0198 world units of radial clearance. The frame holes account
for each member's Z offset, so all four openings share the same world axis.
A triangle-level distance test rejects solid replacements. The shaft now
extends 0.55 units above the top frame instead of ending inside it, restoring
the stub visible in the engraving. The shaft's axial restraint remains an
ideal revolute constraint; the bores alone do not model thrust-bearing loads.

The disks now contain two closed spherical seats with flared rod entrances,
instead of decorative rings on solid cylinders. Rod-end balls have radius 0.18;
the seat radius is 0.182. The upper disk is 0.48 units thick and offset upward
relative to its joint centres; the lower is 0.352 units thick and offset downward.
Their projected top/bottom edges match raster Y=208/240 to within 1.5 pixels
and Y=338/360 to within 0.01 pixels, respectively. The shortened lower pedestal
joins the lower disk and platen while clearing the ball ends.

A dedicated socket test checks closed mesh topology, cavity containment with a
solid-disk failure control, triangle-to-ball clearance
above 0.0018 units, and an enclosing oblique cylinder for each square rod through
721 phases. The polygonal flared mouths retain more than 0.01 units of clearance
against that bound. The bell and pedestal also clear the complete ball envelopes.
These sockets reconstruct the unspecified joint detail; motion remains analytical
and does not simulate bearing loads or elastic contact. The visible seats support
compression; positive retention during retraction is supplied by ideal spherical
joints, without a detailed retaining lip.

The display cycle has an explicit four-second minimum (the native analytical
cycle remains ten seconds and the existing display timing applies a 2.5x
scale). Restart restores the open configuration. The camera is nearly frontal,
explicit full-cycle bounds contain the visible meshes, fog remains disabled,
the scene ground is hidden, and diagnostic indices on
the disk/platen are hidden. Packaged browser checks cover desktop/mobile
animation, pause, exact restart and absence of a WASM request.

```sh
node --test tests/toggle-press-clearance.test.mjs tests/toggle-press-bores.test.mjs tests/toggle-press-sockets.test.mjs
node --test --test-name-pattern='movement 132 straightens' tests/models.test.mjs
```

This is not a full geometry sign-off. Other collision pairs, the bell silhouette
and platen/frame proportions remain under review. The workpiece and hidden
depth are reconstructed. No dynamic pressure, material deformation or bearing
loads are simulated.
