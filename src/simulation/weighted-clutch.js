import profile from '../data/weighted-clutch-profile.js';
import {makeWeightedClutchDistributedCandidate} from './weighted-clutch/distributed-geometry.js';
import {makeWeightedClutchMotion} from './weighted-clutch-motion.js';

export function makeWeightedClutch() {
  const model = makeWeightedClutchDistributedCandidate(profile.options), u = model.root.userData;
  const motion = makeWeightedClutchMotion(profile);
  const update = time => {
    const state = motion.atTime(time);
    model.setCoordinates(state.q, state.inputAngle);
    u.kinematics = state;
  };
  Object.assign(u, {profile, motion, stateAtTime: motion.atTime, fidelity: 'authored',
    mechanism: 'weighted-self-reversing-double-clutch', reconstructionStatus: 'under-review',
    playbackPeriod: profile.playbackPeriod, minimumDisplayCycleSeconds: profile.playbackPeriod,
    animationTiming: {authoredCyclePeriod: profile.playbackPeriod},
    qualification: 'Contact-integrated weighted reversal with finite jaws, shaft-key clearance and a rigid four-bar linkage. Two reversals repeat without resetting the motor. Distributed source-fit adjustments and continuous solid clearance remain under review.',
    idealConstraints: 'The motor turns continuously. Gear meshes impose their tooth ratios; integrated gravity, stud contact, lost motion, jaw contact and key friction determine the linkage and clutch motion. Playback interpolates that measured trajectory.'});
  update(0);
  return {...model, update, motion};
}
