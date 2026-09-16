# Wind rotor family: 484–486

## Source and scope

- [484](https://507movements.com/mm_484.html) shows a single full-turn spiral wound around a supported cylinder, driven by wind or flowing water.
- [485](https://507movements.com/mm_485.html) shows four oblique lattice sails on a common shaft, a tapered tower, domed cap and rear alignment member.
- [486](https://507movements.com/mm_486.html) is a plan view of six independently pivoted sails. The site's note explains that its animation delays flipping relative to Brown's drawing. Its inline canvas model supplies the radial half-turn, flip over the following 30 degrees, and wind-aligned return; the existing four-second schedule retains that reference with a smooth flip interpolation.

Sources checked 2026-09-16. 484 and 485 have no official canvas model. 486 includes an operative canvas model even though its initial HTML tab has `class="unavailable"`; absence must not be inferred from that markup alone. The existing reference motion and analytical operating points are retained. This is a bounded hardware and presentation correction, not a new aerodynamic simulation.

## Corrections

484 and 485 reuse `finite-surface-shell.js` to give their original analytical blade midsurfaces finite thickness (0.035 and 0.020 scene units). Closed edges and outward normals replace zero-thickness surfaces. Existing exact-profile tests now compare the midpoint between corresponding shell faces, preserving their original helical and twisted-sail equations.

484's shaft journals now have close bores. Its shoulders have real shaft passages, and the uprights stop beneath the rotating shaft. The shoulder width also clears the end collars. The cylinder, collars and load-wheel hub have bores; the original right-handed one-turn geometry and rotation sign are unchanged. The large display slab is hidden, leaving the source's two pedestals visible.

485's journals now have close bores and supporting blocks connected into the tower head. The cap is a closed spherical shell with a genuine front shaft passage, generated offline. The rotor hub has a shaft bore. Sail twist, lattice and fourfold shaft relationship remain unchanged.

486's pins are fixed to the rotating arms, while each sail rotates on a separate bored sleeve. The sail panel and horizontal edge rails leave space for that sleeve; face indexes move away from the hinge. Arms run beneath the sail sweep and connect into a lower central hub. The central bearing, hub, square boss, flywheel and lower supports have actual shaft bores. The lower bearing also clears the flywheel, and the lower fixed support bars are compact enough not to resemble additional rotor arms in plan. The large display slab is hidden; the source circle now passes through the actual sail pivots (radius 1.72) and is explicitly marked as a nonmechanical plan reference. A near-plan default view makes the sail timing readable.

All three models hide the scene ground, disable material fog, and enforce minimum display periods of six, three and four seconds respectively. Their relative motion and phase relationships are not accelerated separately.

## Validation and generation

```sh
node --test tests/wind-rotor-working-interfaces.test.mjs \
  tests/movement-484.test.mjs tests/movement-485.test.mjs tests/movement-486.test.mjs
```

32 tests pass: 26 existing source, motion, continuity, geometry and framing tests plus six focused tests. The focused checks use actual rendered triangles and 33 poses spanning each complete authored cycle. Additional shaft cross-sections catch thin housings positioned between ordinary long-triangle vertices and midpoints. They check selected moving surfaces against journal bores, supports, tower/cap, adjacent sails and hinge sleeves. They also check positive signed shell volume, stable scene geometry and GPU arrays, fog settings and timing disclosures.

Final selected finite audit: 3,646,368 queries for 484; 4,013,196 for 485; 1,257,102 for 486. No penetration beyond the 1e-5 tolerance. Minimum sampled gaps are 0.003842, 0.003872 and 0.003840 scene units. These are sampled interface checks, not exhaustive continuous collision certification.

The 485 cap bake uses `scripts/generate-windmill-cap.py` with `manifold3d==3.5.3` and its numpy dependency in an external virtual environment. Reproduce with:

```sh
python -m venv /dev/shm/wind-cap-venv
/dev/shm/wind-cap-venv/bin/pip install manifold3d==3.5.3
/dev/shm/wind-cap-venv/bin/python scripts/generate-windmill-cap.py
```

The additive output `src/simulation/generated/windmill-cap.js` contains 3,044 triangles and about 84 KB. No CSG or physics solve runs in the browser. Regeneration must preserve the checked finite interfaces; bulk artifacts remain outside Git.

Chrome source/default/front/advanced-phase review found no errors or clipping over 17 full-cycle poses (maximum absolute projected coordinates 0.851/0.810/0.856). Final images and logs remain in `/dev/shm`.

Representative local CPU measurement: construction 59/50/20 ms, mean update 0.015/0.013/0.015 ms over 1,000 calls for 484/485/486. Geometry updates retain their objects and typed arrays; the existing state functions may still allocate temporary vectors or records.

## Explicit limits

The wind/water speeds, efficiencies, torque coefficients and load balances are illustrative prescribed operating points. Fluid forces, losses and passive speed regulation are not validated. 486's sail orientations are prescribed, including a smoothed flip after the source animation's dead line; a passive flap, physical stops, impacts and aerodynamic equilibrium have not been solved. Return-to-power pickup retains the source's ideal velocity change, so the complete hinge cycle is not claimed to be dynamically smooth. The imposed flywheel-buffer torque is bookkeeping for constant-speed playback, not evidence of integrated flywheel regulation.

Most dimensions and shaft clearances are reconstruction assumptions; the source gives no dimensioned manufacture. Decorative flow packets are explanatory markers, not a flow field or collision particles. Fixed/rotating keyed components may meet at intentional bonded surfaces; the focused clearance tests address selected relative-motion interfaces rather than every assembly pair. No MuJoCo validation is claimed.
