# Release mechanisms 247 and 278

Reviewed the [247 sounding-weight caption and engraving](https://507movements.com/mm_247.html) and [278 Otis safety-stop caption and engraving](https://507movements.com/mm_278.html). On 2026-09-16 both actual page responses mark `Animated` unavailable and contain no inline motion-model registration. The engraving/caption, rather than a timing oracle, therefore determines this reconstruction.

## 247: useful finite support and withdrawal

The previous solid guide intersected the probe; the pivot passed through solid arms, and the generated catch penetrated the bored weight. The correction uses a real guide passage, bored catch arms, an axled rounded probe follower, and a short finite capsule-shaped support land. The guide includes material around the off-center probe. The inferred depth offsets are stated in the viewer.

The weight follows the support envelope of the complete finite land, including its rounded ends and depth. Its conservative bore radius accounts for the actual polygonal weight mesh. This is a load-bearing seat, not a clearance-only cut: selected actual normals have upward component at least 0.95358, the greatest actual surface gap at sampled loaded poses is 0.00005548, and lowering the weight by 0.01 intersects actual nose material.

After seabed contact, a one-dimensional unilateral law releases the vertically guided weight when envelope acceleration reaches minus gravity. It inherits the support velocity and then falls ballistically:

- release: 4.4149845076 authored seconds;
- inherited velocity: −0.0195454342 model units/second;
- gravity: 2.3944145574 model units/second²;
- ground impact: 5.3183626654 seconds;
- geometric withdrawal completes at 4.5125510524 seconds.

The ballistic weight stays above the support envelope while the nose remains inside the bore. Release position, velocity and acceleration agree across the branch within numerical tolerances, including samples only 1e−10 seconds from release. A fixed derivative stencil avoids cancellation at that boundary. The initial lowering stage now lasts 2.8 seconds, reducing its downward acceleration below gravity; subsequent authored events shift by 1.1 seconds and the full cycle is 11.1 seconds. Public state/contact release and impact times match this law; the former point-support law is explicitly retained only as `nominalKinematics247` for regression/reference.

Limits: the catch motion, detent, vertical guidance, lowering/recovery and external manual reload remain prescribed. This is a vertical support/flight calculation, not a general frictional or fluid dynamics solution. Water resistance, loaded ground impact and detent forces are not simulated. The public viewer note states these limits. No MuJoCo solve was needed for the determinate vertical release.

## 278: finite eye, elbow joints and rack seats

The previous inner lever arms occupied the same layer and crossed a solid eye and rope pin. Separate lever layers now run in two through-slots in a common eye. The fulcrums and pawl joints have actual bores, while the vertical pin terminates at the eye bridge. Flat finite pawls retain useful outer toes; the rack top faces agree with the authored arrest-seat height. This preserves the source's shared eye, opposed elbow levers, spring and hooked racks.

The initial arrested pose and broken rope are intentional: they reproduce the source state after rope failure. The viewer now says so. Normal lifting, failure, one-pitch descent, arrest and manual reset retain the existing analytic schedule. The two arrested pawls meet actual upward rack seats within 1e−6 model units. Spring force, running clearance/lost motion in the eye, loaded arrest and manual reset remain prescribed rather than passively force-solved.

Both models hide the decorative ground, disable material fog, retain shadow flags and geometry buffers, and specify a minimum eight-second display cycle. Movement 278 uses a more frontal source view.

## Focused evidence

Run:

```sh
node --test tests/release-mechanism-working-parts.test.mjs tests/movement-247.test.mjs tests/movement-278.test.mjs
```

21 checks pass. Selected bidirectional actual rendered-solid sweeps cover 67 poses for 247 and 65 for 278, with 7,912,834 and 2,067,512 surface queries respectively. Minimum sampled signed gaps are positive (3.73e−9 and 3.58e−9). Pairs cover the guide, catch pivot/arms, probe follower, nose/weight, crossing levers/eye/rope pin, lever pivots, pawl joints and neighboring rack teeth. These are bounded checks of working interfaces, not an exhaustive global collision or force certificate. Loaded support witnesses use denser triangle samples so a narrow bore-edge contact cannot pass only because coarse vertices miss it.

Root's final full-cycle browser review, including the timing/release corrections, reported no errors or clipping, with maximum normalized screen extents 0.86945 (247) and 0.80101 (278). Both packaged desktop/mobile playback checks pass. RAM captures: `/dev/shm/family45-final-{247,278}-{default,oblique}.png`; final focused log: `/dev/shm/release45-final.log`.
