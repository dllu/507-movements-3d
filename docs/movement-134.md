# 134: rope wound on an eight-beam cage

The [source engraving and caption](https://507movements.com/mm_134.html) show
one rope or band wound round a drum, turning uniform rotation into linear
travel. Brown draws the drum as a cage: eight radial blocks between his inner
and outer circles, with the rope as eight straight hatched chords between them.
The rope is therefore octagonal, not round.

Pass 97 rebuilt the model this way (`src/simulation/octagonal-rope-cage.js`):

- **End wheels.** Two wheels, each with the four traced spokes and a large hub.
  - The rear wheel's flange runs from Brown's inner circle (r 151 px) to his outer circle (r 181 px). Its rim is the outer circle seen round the rope.
  - The front wheel has a narrow rim, 0.035 deep, whose inner edge is Brown's inner circle. It stops below the rope, which Brown draws in full on the front face.
  - The spokes are trimmed to end inside that rim.
- **Beams.** Eight beams, 18 px wide as drawn, run parallel to the axis from inside the rear flange to 0.012 proud of the front rim. Their ends are Brown's eight blocks. Each beam has flat sides and a semicircular nose, and the rope bends over the noses.
- **No core.** Nothing fills the annulus under the rope except the beams.
- **The rope.** One laid rope, radius 0.05, in the shared hemp brown.
  - It runs from a far guide on the left, once round the eight beam noses, and away to a far guide on the right.
  - The guides lie on Brown's ground line (rope centre at r 173 px when a beam is at the bottom), 1.0 beyond each crop edge and out of the default view.
  - Round each nose the rope follows an arc 0.002 clear of the beam. Between noses it runs as a straight chord.
  - Its axial position follows a stationary helix with a lead of 0.14, so the two passes at the bottom stay 0.05 clear of each other.

## Kinematics

The cage turns uniformly at 0.72 rad/s. The rope does not slip on the noses, so
every point of the wound rope keeps its material coordinate. Each span runs from
its fixed guide to the tangent point on its current nose, so:

- The rope speed through the guides pulses eight times a turn, between 1.159 and 1.246 (mean 1.217, a 7.1 % swing). This matches the octagon's effective radius, which varies between r cos 22.5 deg and r.
- The spans tilt by up to 2.05 degrees as each beam passes the bottom.
- The feed is continuous when the contact moves to the next beam, because the span is then collinear with the chord.

One turn draws eight nose pitches (10.616 units) of rope. The lay is set to a
whole number of lays per turn (0.2413, against a nominal 0.2437), so the loop
has no seam.

## Reconstruction assumptions

- The depths, beam cross-section, guide positions and helix lead are reconstructed.
- The rope's axial walk across the noses is kinematic. Tension and friction are not solved.
- Brown's radial blocks reach his outer circle. Here the beam noses end under the rope at r 1.678, and the rope's outer edge reaches r 1.78.
- The pedestal and bearing behind the cage are removed in the source presentation, as before.

```sh
node --test tests/single-wrap-drum.test.mjs tests/rope-drum-hardware.test.mjs
node --test --test-name-pattern='movement 134' tests/models.test.mjs
```
