import profile from '../data/selector-rack-profile.js';
import {makeSelectorRackGeometry} from './selector-rack-free-geometry.js';
import {sampleSelectorRackMotion} from './selector-rack-motion.js';
import {Box3, BoxGeometry, Group, Mesh, Vector3} from 'three';
import {supportMaterial} from './back-plate-support.js';

export function makeSelectorRackDrive() {
  const model = makeSelectorRackGeometry(), u = model.root.userData;
  // Reviews and screens sample the whole walking demonstration, not one cam turn.
  u.geometry.mechanismCyclePeriod = profile.duration;
  Object.assign(u, {profile, fidelity: 'authored', reconstructionStatus: 'rebuilt', mechanism: 'single-cam-governor-selected-double-rack',
    playbackPeriod: profile.period, minimumDisplayCycleSeconds: profile.period,
    animationTiming: {authoredCyclePeriod: profile.period}, sampledMotionBounds: profile.motionBounds, stateAtTime: sampleSelectorRackMotion,
    cameraFitBounds: new Box3(new Vector3(...profile.motionBounds.min), new Vector3(...profile.motionBounds.max)),
    qualification: 'Measured rack contours, real suspension slots and a single projecting cam follow the engraving. The complete curved-spoke rear wheel, axial layers, pin heads, guide passages and rear bearing reconstruct hidden details. The fork of A is widened (1.5x) so its pins sit near the slot middles, the lower teeth are set to a uniform pitch, and the end rods run past the guides, so the rack can walk about four teeth.',
    idealConstraints: `The cam turns clockwise continuously during the demonstration. Raising and lowering rod A selects the lower or upper rack. Gravity, inertia, viscous resistance and finite frictionless contact determine both rack translations and its slight tilt. Uniform density, load values and governor pulses are reconstruction assumptions. The cam turns in three seconds; the governor holds each selection for two turns, so the cam walks the rack two steps right, two left to the slot end and two right again. After one opening turn in neutral, the four-turn span from the first right stroke closes on itself exactly and repeats without end.`});
  // Brown's two bearing posts and the end guides run down past his crop to a
  // floor: the posts stand on a sill, and each guide on a plain post and foot.
  const floorY = -1.85, supports = new Group(); supports.name = 'floorSupports';
  const box = (sx, sy, sz, x, y, z, name) => {const m = new Mesh(new BoxGeometry(sx, sy, sz), supportMaterial());
    m.position.set(x, y, z); m.name = name; supports.add(m);};
  const standard = new Box3().setFromObject(u.parts.rearBearingStandard);
  box(standard.max.x - standard.min.x + .24, standard.min.y - floorY, .4, (standard.min.x + standard.max.x) / 2,
    (standard.min.y + floorY) / 2, (standard.min.z + standard.max.z) / 2, 'bearing-post-sill');
  for (const name of ['rackGuide0', 'rackGuide1']) {
    const g = new Box3().setFromObject(u.parts[name]), x = (g.min.x + g.max.x) / 2;
    box(.12, g.min.y - floorY - .1, .12, x, (g.min.y + floorY + .1) / 2, 0, `${name}-post`);
    box(.5, .1, .4, x, floorY + .05, 0, `${name}-foot`);
  }
  supports.userData.beyondPlateCrop = true;
  model.root.add(supports);
  model.update = time => {const state = sampleSelectorRackMotion(time); model.setState(state); u.kinematics = {...state, ...u.state};};
  model.update(0); return model;
}
