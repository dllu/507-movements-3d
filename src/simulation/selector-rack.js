import profile from '../data/selector-rack-profile.js';
import {makeSelectorRackGeometry} from './selector-rack-free-geometry.js';
import {sampleSelectorRackMotion} from './selector-rack-motion.js';
import {Box3, Vector3} from 'three';

export function makeSelectorRackDrive() {
  const model = makeSelectorRackGeometry(), u = model.root.userData;
  Object.assign(u, {profile, fidelity: 'authored', reconstructionStatus: 'rebuilt', mechanism: 'single-cam-governor-selected-double-rack',
    playbackPeriod: profile.period, playbackDuration: profile.duration, minimumDisplayCycleSeconds: profile.period,
    animationTiming: {authoredCyclePeriod: profile.period}, sampledMotionBounds: profile.motionBounds, stateAtTime: sampleSelectorRackMotion,
    cameraFitBounds: new Box3(new Vector3(...profile.motionBounds.min), new Vector3(...profile.motionBounds.max)),
    qualification: 'Measured rack contours, real suspension slots and a single projecting cam follow the engraving. The complete curved-spoke rear wheel, axial layers, pin heads, guide passages and rear bearing reconstruct hidden details.',
    idealConstraints: 'The cam turns clockwise continuously during the demonstration. Raising and lowering rod A selects the lower or upper rack. Gravity, inertia, viscous resistance and finite frictionless contact determine both rack translations and its slight tilt. Uniform density, load values and governor pulses are reconstruction assumptions. The cam turns in four seconds; the demonstration pauses after 5.5 seconds for Replay. This endpoint is a pause of the animation, not a mechanical brake.'});
  model.update = time => {const state = sampleSelectorRackMotion(time); model.setState(state); u.kinematics = {...state, ...u.state};};
  model.update(0); return model;
}
