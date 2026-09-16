# Hammer working interfaces: 470–472

Primary references: [470 steam hammer](https://507movements.com/mm_470.html), [471 atmospheric hammer](https://507movements.com/mm_471.html) and [472 compressed-air hammer](https://507movements.com/mm_472.html), captions and engravings. All three pages mark animation unavailable. There is no official 2D oracle for this family.

## Corrections

All three finite striking faces previously extended 0.0225 below the nominal impact plane. Their lower surfaces now meet the actual anvil top, including at the exact authored impact event. Head/anvil bodies terminate at their face interfaces, eliminating the formerly coincident exterior surfaces and visible z-fighting. Cylinder skins are replaced with finite annular walls; lower heads have real rod bores. Oversized decorative piston-seal tori no longer penetrate the bore. The source-facing cameras, material fog settings and minimum display cycles are explicit.

470's visible piston and pressure-area radius now both use 0.337, within the 0.34 cylinder bore. Its lower-cylinder port connects to the admission pipe, and the valve chest has an actual spool bore. Frame columns reach the crown, and the two floating decorative brace rods are hidden. The authored pressure-supported lift, exhaust transition and analytic gravity fall remain intact. Minimum cycle: 5.2 seconds.

471's original head entered the cylinder end by up to 0.481 model units during the cycle. A longer piston rod and lower anvil keep the head below the bored lower cylinder head. The front crank depth is separated from the hammer rod; the fixed shaft no longer crosses that rod. The crank disk, connecting-rod eyes, cylinder drive lug and shaft bearing have actual bores. A front cylinder joint pin and rearward cantilever bearing connect those parts. The atmospheric port is hollow and aligns with the wall opening. Minimum cycle: 5.6 seconds.

472 likewise needed a longer hammer rod to clear its fixed lower cylinder head through the full 1.35-unit stroke. Its pump connecting rod has bored eyes and a raised, bored wrist-pin fork. A rearward crank web clears the other eye. The piston and barrel shift together by the fixed 0.21 wrist offset, preserving stroke and chamber volumes. The friction roller and pulley fit the drive shaft; the raised friction-track torus that entered the roller is hidden, leaving the actual flat disk face. The valve chest admits the sliding valve through an actual rectangular passage. Minimum combined 2-drive/3-hammer cycle: 9.6 seconds, preserving the authored speed ratio.

## Evidence

```sh
node --test tests/hammer-working-interfaces.test.mjs tests/movement-470.test.mjs tests/movement-471.test.mjs tests/movement-472.test.mjs
```

39 tests pass. Finite tests sample 65 cycle poses plus each exact impact event. They check piston/rod/head against the cylinder walls and heads; finite hammer/anvil faces; repaired shaft, disk, connecting-rod and lug interfaces; steam pipe/barrel port; pump rod/cylinder, piston/fork/crank-web clearances; and friction roller/disk and slide/chest interfaces. Roughly 4.43 million selected surface queries pass a 1e-5 penetration tolerance. Minimum hammer/anvil gaps are within 1.5e-9 of zero from float geometry precision. The tests also check material fog, stable geometry identities and enforced minimum display duration.

Observed local CPU construction/update costs were 58 ms / 0.005 ms (470), 37 ms / 0.018 ms (471), and 31 ms / 0.028 ms (472). These are measurements on this machine, not performance guarantees. Final serialized Chrome source/default/front/advanced review found no errors or cycle clipping, and confirmed that face flicker is gone. Maximum absolute full-cycle screen coordinates were 0.798, 0.803 and 0.834. Rendered geometry including shadows was 28,928 / 17,936 / 34,872 triangles and 50 / 57 / 109 draw calls. Captures and logs remain in `/dev/shm/hammer-final-*`.

## Limits

These are bounded interface corrections, not a new validated passive hammer simulation. 470 uses an imposed lifting pressure/trajectory and an analytic gravitational descent; its impact is an ideal instantaneous inelastic stop. Deformation, restitution, rebound and tool/workpiece response are not solved. 471 and 472 retain prescribed hammer trajectories and pressure demonstrations; their motion has not been obtained by integrating the actual gas forces against a moving mass. They must not be described as force-validated merely because the finite striking surfaces meet.

The pump's swinging connecting rod in 472 retains an open trunk-piston entrance. A pressure-tight upper gland, crosshead, detailed check-valve/slide port network and reservoir seals require a separate reconstruction. The finite roller/disk pair demonstrates the center-radius speed ratio; distributed friction, slip and available torque are not validated. Steam-valve linkage joints and port switching in 470, and the auxiliary slide-valve linkage in 472, are not part of the finite joint qualification. Transparent gas volumes remain explanatory graphics.

Support depth layers, longer rods, inferred gland clearances and frame extensions are reconstruction assumptions. No impact contact bake, MuJoCo result or native dynamics validation is claimed by this pass. Such a solve is warranted if later work claims a passive blow trajectory or loaded rebound, rather than the explicitly prescribed illustration delivered here.
