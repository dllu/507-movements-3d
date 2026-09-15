# Movement 144: lazy tongs (review in progress)

The [engraving and animated reference](https://507movements.com/mm_144.html)
show four rhombi, with the third crossing fixed to a pedestal. Equal rigid
members therefore give opposite endpoint displacements in a 3:1 ratio.
The existing analytic construction has that relation, uses measured engraving
pivots, and folds between approximately 7 and 27 degrees from vertical, matching
the animation's range. Its eight-second cosine input is a smooth presentation
choice, not a reproduction of the source animation's interpolation and dwells.
MuJoCo is unnecessary for this constrained linkage.

The ten visible links now have flat, rigid plates with real bored eyes at the
ends and at the six crossing joints. Previously the pins passed through solid
bars and spherical end joints. Geometry is constructed once; playback only
positions and rotates each rigid member, without stretching its bores.
The bore radius is 0.108 world units around a 0.105-radius pin. An independent
triangle-surface test checks the actual bore geometry at 65 orientations, at
three axial depths and 48 circumferential points per pin: clearance exceeds
0.0027 units. It also checks that material surrounds each hole. This is a
link/pin check, not a full-assembly collision claim.

The existing 48,000-sample kinematic test passes with these links. The default
camera now faces the engraving plane, the extra ground is hidden, fog remains
disabled, and restart restores the source pose.
The production build and packaged desktop/mobile playback, orbit and exact
restart checks pass without loading WASM. The packaged frontal view was reviewed.

Still to review: the handle clevises currently contain solid hubs, the pedestal
and fixed-pin support need closer source matching, and all independent moving
parts need a full-cycle clearance check. Do not treat 144 as fully validated yet.
