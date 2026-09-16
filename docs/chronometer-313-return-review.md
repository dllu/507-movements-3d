# 313: finite pallet return clearance and bounded passing-spring study

The **return-pallet defect is corrected**. The **one-way passing-spring defect remains open**; no native motion is published as validated playback. This supersedes only the 313 return-pallet item in `free-escapement-291-313-review.md`. Movement 291 is unchanged.

## Geometric cause and correction

The existing radial impulse face works from radius 1.42743 to 1.52790 about the balance axis. Its additional 0.06 outer end allowance extended to 1.58790, with a still larger corner radius after including the jewel's 0.15 transverse thickness. The nearest locked wheel tooth is only 1.56552 from that axis. Because the free balance sweeps through this location again, the extra end material collided on return even though the active point law passed.

The revised outer allowance is 0.02. It preserves **every point of the active sliding face**, the full 0.15 transverse thickness, 0.22 depth and 0.06 inner allowance. The actual outer corner radius is approximately 1.55517, giving over 0.01 clearance from the complete locked tooth envelope. No active face, tooth, or return motion is removed. The source layout, count, active impulse law, drive ratio and spring schedule remain unchanged.

An actual-mesh regression checks the locked wheel envelope against the entire finite pallet corner, then checks 513 active poses to ensure the full working face retains its allowance. The full-cycle finite sweep now finds a minimum pallet/tooth gap of approximately +0.00019993, at active contact, instead of the prior return penetration of 0.02596. The locking-face clearance remains +0.00019994 or greater. Existing reaction-direction and attachment checks still pass.

The source is [Brown's common chronometer escapement, 313](https://507movements.com/mm_313.html); prior caption/engraving review and confirmed absence of an official inline animation still apply. The revised end allowance is an inferred mechanical dimension, not a pixel tracing claim.

## Passing-spring investigation and retained residual

A finite geometric pin/leaf constraint removed penetration in a preliminary trial but produced a discontinuous detent reset when the pin passed the leaf end. That reset could catch the departing wheel. The trial was not integrated.

A two-joint offline MuJoCo study then used a passive spring-biased detent slide and a passive spring-biased leaf hinge with a one-way backing limit. Only the jewel path is driven. Its contact-disabled control remains exactly stationary, supporting actual contact-driven motion in the enabled trial. However:

- Native pin/leaf penetration remains about **0.0159**.
- Coarse/fine timestep differences reach **0.000575** detent displacement, **0.00175 rad** leaf angle and **0.358 rad/s** leaf speed.
- The leaf is a reduced rigid-body surrogate, with inferred stiffness, inertia and damping. The complete escape-wheel/lock handoff is not simulated.

Those results do not qualify a production bake. Reproduction commands and compact results are in `src/simulation/mujoco-chronometer-passing/README.md` and `study-results.json`; the native generator uses the shared MuJoCo runtime and disposes its allocations.

Production therefore still has the prior **V / passing-spring segment 16 penetration of about 0.04487 at phase 0.751953125**, and its detent can separate before the prescribed wheel-release phase. These are explicit remaining contact/dynamic faults. The corrected pallet envelope does not certify the escapement as a whole.

## Checks

```sh
node --test tests/chronometer-return-contact.test.mjs tests/free-escapement-solids.test.mjs tests/movement-291.test.mjs tests/movement-313.test.mjs
```

All 23 checks pass, including unchanged 291 regressions, the full retained active pallet face and transverse thickness, full-cycle finite pallet clearance, and a native contact-disabled control. The native test establishes setup/contact dependence, not solver qualification.

A source/default/front/rear browser review on port 43939 checks the production correction only: no browser errors or full-cycle clipping, maximum absolute NDC 0.8259. Chrome is closed. Artifacts are `/dev/shm/chronometer-return-313-{default,front,rear}.png`; no bulk traces or screenshots are added to Git.
