# Movement 390: finite opposed pawl contact

This pass supersedes the 390 pawl-interference residual in `alternating-drive-390-391-review.md`. It validates a finite geometric contact path, not passive spring, flywheel or impact dynamics.

## Source and reconstruction

[Brown's caption and engraving](https://507movements.com/mm_390.html) show two opposed pawls carried by loose pulleys, driving ratchets fast on the flywheel shaft. The open and crossed bands make the carriers turn oppositely. The checked source page contains neither `ae.add_model` nor `mm_present`; there is no official inline animation oracle.

The old pawls had length 0.0556 with hinge-pin radius 0.060, identical mounting phases and an arbitrary sine lift. Their rendered bodies penetrated the ratchet by 0.0500. The replacement uses opposite mounting phases, 0.24-long curved pawls, finite 0.018-radius toes, 0.036-radius eyes with 0.021 bores, and separate 0.020-radius carrier pins. The curved arm passes outside adjacent crests instead of cutting through the next tooth. A finite carrier stop limits inward rotation. Both 12-tooth ratchets are closed bored solids with asymmetric long ramps and short working flanks.

The original exact full-wave motion offered no interval for a finite toe to fall behind the crest. Each carrier stroke now has 0.065 radians of extra travel. The old driving pawl releases as its carrier reverses; the opposite toe has already completed its return, and the new carrier takes up the small allowance before locking. One complete oscillator cycle still produces one forward output revolution, with unchanged fixed-band-length and no-slip laws.

The model has a short stationary output interval at each take-up. Brown calls the resulting rotation continuous: an actual flywheel may coast through that interval. The current trajectory omits flywheel inertia, external load, compliance, friction, spring force and pickup impact, so the precise speed through handoff is an explicit remaining dynamics discrepancy. The source does not specify the reconstructed spring bias, inward stop, tooth count, dimensions or input waveform.

## Contact construction and evidence

`dual-band-pawl-contact.js` derives the driving phase from the finite circular toe and actual working flank. The unit reaction normal gives output moment **+0.288703** and pawl seating moment **+0.020986**. A small reverse displacement penetrates the working flank, demonstrating the lock direction; the contact is about 41% along the finite flank, not perched on a crest. The static seat clearance is 0.000040.

`scripts/generate-dual-band-pawl-contact.mjs` bakes one tooth period into 4,097 angle samples. It finds the outer finite-toe contact envelope and adds a continuous prescribed return across the branch change after the crest. Initial release and subsequent carrier take-up preserve the already seated branch. Playback interpolates the compact table; it does not search contacts or run a physics engine in the browser.

A 513-pose full-cycle audit of both actual rendered pawl solids measured minimum pawl/ratchet clearance **+0.0000410**, replacing the old negative 0.0500 penetration. The independent tests also check the bored pin, finite stop and pulley face, every driving contact's forward torque, continuous crest/drop/handoff motion, unchanged scene/geometry identities, and the existing band routing and closure.

The shaft keys, upper-sector band supports and driving loads remain schematic; this pass does not claim their force validation. No MuJoCo study was necessary to establish the geometric collision-free path, and no prescribed motion is labelled as a passive physics result.

## Validation and view

The final scoped run passed **18/18** tests: `movement-390.test.mjs`, `dual-band-390-contact.test.mjs`, and the prior `alternating-drive-solids.test.mjs`. A separate 65,536-sample check bounded pawl angular speed at 32.106 rad/s without jumps. Take-up ends at 2.363792 and 6.363792 seconds in the eight-second cycle; the ideal pickup changes output speed from zero to about 0.354913 rad/s. That unresolved impact is not smoothed away or described as force-validated.

The final source/default/front/rear browser capture reported zero errors or clipped vertices, maximum absolute projected coordinate 0.88327. The rear pawl lies behind the front pulley in the default source view; its distinct axial layer can be inspected by orbiting toward the side. This is a visibility limitation of the reconstructed pulley stack, not a hidden replacement for the second contact. Screenshots are `/dev/shm/dual-band-contact-390-{default,front,rear}.png` and are not committed.
