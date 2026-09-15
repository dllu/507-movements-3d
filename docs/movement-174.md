# Movement 174: twin-jaw bench clamp — review open

The [original engraving](https://507movements.com/mm_174.html) shows a board
pushed between two jaws turning on fixed screws. The original page has no
enabled animation. The current browser model still prescribes both jaw angles;
its mechanical reconstruction is unfinished.

## Baseline defects and rendering increment

The [baseline audit](validation/174-existing-contact.json), against commit
f748df7, samples 129 poses of the physical bench, jaws, board and screw hardware.
It finds seven interfering pairs, including both jaws against the board,
jaw-to-jaw overlap and pivot hardware penetrating the jaw plates. In 46 poses,
the upper jaw moves despite the legacy model's own positive nominal contact
gap. Its circle-based contact calculation does not describe the visible outline.
The jaw outlines and pivot openings also require a fresh source reconstruction.
Decorative outlines, white indices and contact markers were excluded from this
physical audit and are not proposed for the replacement.

The browser now uses a near-orthographic top view, ignores scene fog, hides the
scene ground and supports exact Restart. The scoped legacy model test, build
and desktop/mobile browser checks pass. These rendering checks do not resolve
the baseline contact defects or validate its inherited 9.4-second motion law.

## Passive contact study

The [new jaw trace](../src/simulation/mujoco-bench-clamp/profile.js) is decomposed
into finite triangular prisms for an offline MuJoCo study. Only the board's X
translation is actuated. Both jaw hinges are passive, and the board can shift
in Y while its orientation is held. A sideways guide in the first study
incorrectly allowed the lower jaw to carry the clamp alone; removing that
constraint establishes contact with both jaws.

A four-second push with an inferred 10-unit force limit settles with the board
at X=0.035193 and Y=0.004082 model units. Both jaws contact the board, and the
board's forward speed tends to zero while the push remains applied. Runs at
0.0005 and 0.00025 seconds reach the same final configuration. Their maximum
sampled transient differences are 0.00273 radians at the upper jaw, 0.00369 at
the lower jaw, 0.000331 in board X and 0.000485 in board Y.

The frictionless, normal-contact-only control also holds the board. The source
jaw shape can therefore form a geometric stop; friction at the front lobes
alone is not an adequate model of this mechanism. Disabling contact leaves both
jaws at their initial angles and lets the board reach its commanded X=-0.2.
No negative contact distances were recorded in the current four runs, with a
small contact margin enabled.

See [native results](validation/174-native-study.json). The lower outline is an
approximate reflection with a separately measured pivot. Masses, damping, force,
board orientation and axial layers are assumptions. The study omits the bench,
finite screw hardware and jaw pivot bores. It is not yet a qualified motion bake.

## Next work

Refine the lower-jaw asymmetry and validate release/reinsertion, timestep
convergence and the contact locations. Build matching visible jaws with proper
bores and hardware clearances, remove decorative stand-ins, and validate the
whole assembly and its source fit before registering baked playback. Continue
with 174; the full review remains active.
