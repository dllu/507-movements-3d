# Bayonet, union and spherical tube couplings: 245, 248, 249

The [245](https://507movements.com/mm_245.html),
[248](https://507movements.com/mm_248.html) and
[249](https://507movements.com/mm_249.html) captions and engravings were reviewed
2026-09-15. All three official pages mark animation unavailable and contain no
canvas model. Their assembly/articulation schedules remain illustrative analytical
motions rather than measured source timing.

## Changes

- **245:** Retained its genuinely open curved L-slot. The locking pose now uses
  the finite pin shaft's angular envelope at the inner socket wall; the larger
  external head does not falsely determine its end stop. Corrected the winding
  of the slot's horizontal thickness faces. The sequential turn/withdraw/insert/
  lock law is unchanged.
- **248:** Replaced detached tubular helix decorations with closed complementary
  square-thread solids connected to the screw core and nut cavity. The existing
  three-turn axial/rotational law and captive flange sequence are unchanged.
  Extended the fixed thread core beneath the entire male thread. Replaced the
  thick toroidal seat, which intruded into the flange, with a flat annular seat.
  Closed the lathed pipe/nut meridians so the inner walls exist, and corrected
  the second cutaway face's winding.
- **249:** Reconstructed a spherical internal chamber, matching the hollow ball
  in the source section. Its upper and lower port throats connect to that chamber;
  the old cylindrical bore liner no longer obscures its interior. Added real
  clamp-ear and hex-nut holes, and brought the nut faces onto the ears. Closed
  the lathed meridians and corrected cut-face winding. The fixed spherical center,
  tilt limit and exact articulation transforms are unchanged.

The three models use sampled full-cycle bounds and source-facing views, with
material fog and generic ground disabled. The construction reuses finite plates,
bored box geometry, closed thread geometry and the existing framing helper.

## Validation

`node --test tests/movement-245.test.mjs tests/movement-248.test.mjs tests/movement-249.test.mjs tests/pipe-coupling-solids.test.mjs`

24 existing analytic/source checks and five new finite-solid checks pass. The
actual bayonet pin/head/plug clear the slot through 129 poses. The union's male
and female thread surfaces are checked in both directions at 65 poses, alongside
flange/shoulder/seat/spigot clearance. The ball chamber and necks clear both
socket halves and lower tube through 65 poses; ray inspection verifies the
spherical internal cavity, and the clamp shanks clear their ear and nut bores.
These bounded triangle-surface samples are regression evidence, not exhaustive
collision proofs.

Chrome source/default/front/advanced review found no browser errors or clipping
over 17 poses. Maximum absolute projected coordinates were .860, .810 and .858
for 245, 248 and 249 respectively. Captures and downloaded source pages remain
in `/dev/shm`.

## Remaining assumptions

Dimensions, running clearances and assembly timing are reconstructed. The union
uses a square-thread section; sealing compression, thread friction and tightening
load are not simulated. The spherical joint retains a small illustrative socket
split gap, and its static clamp hardware does not model bolt preload, a gasket
or a pressure-tight seal. The bayonet demonstrates geometric retention without a
spring detent or locking force. No dynamic or pressure capability is claimed.
