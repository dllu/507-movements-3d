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

The display cycle has an explicit four-second minimum (the native analytical
cycle remains ten seconds and the existing display timing applies a 2.5x
scale). Restart restores the open configuration. The camera is nearly frontal,
explicit full-cycle bounds contain the visible meshes, fog remains disabled,
the scene ground is hidden, and diagnostic indices on
the disk/platen are hidden. Packaged browser checks cover desktop/mobile
animation, pause, exact restart and absence of a WASM request.

```sh
node --test tests/toggle-press-clearance.test.mjs
node --test --test-name-pattern='movement 132 straightens' tests/models.test.mjs
```

This is not a full geometry sign-off. The retained disk sockets are decorative
rings on solid disks, and the collar/top-frame shaft passages require actual
bores. Their joint geometry, other collision pairs, the bell silhouette and
platen/frame proportions remain under review. The workpiece and hidden depth
are reconstructed. No dynamic pressure, material deformation or bearing loads
are simulated.
