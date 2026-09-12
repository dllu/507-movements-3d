import profile from '../data/pump-catch-profile.js';
import {makePumpCatchGeometry} from './pump-catch-geometry.js';
import {indexPumpCatchHardware} from './pump-catch-indexed-hardware.js';
import {makePumpCatchPlayback} from './pump-catch-motion.js';

export function makePumpCatchDrive(){
  const model=makePumpCatchGeometry(),u=model.root.userData,motion=makePumpCatchPlayback(profile);
  indexPumpCatchHardware(model);
  Object.assign(u,{fidelity:'authored',mechanism:'cam-latched-loose-wheel-pump-drive',reconstructionStatus:'rebuilt',
    profile,motion,playbackPeriod:motion.displayPeriod,animationTiming:{authoredCyclePeriod:motion.displayPeriod},
    minimumDisplayCycleSeconds:motion.displayPeriod,stateAtTime:motion.sample,sampledMotionBounds:profile.motionBounds,kinematics:{},
    qualification:'Source-traced loose wheel, hooked catch and cam with complete winding, rear input and guided pump hardware. Motion follows the reviewed finite-contact trajectory.',
    idealConstraints:'The input shaft alone rotates continuously. Gravity, inertia, unilateral cam/catch/stop contact, a fixed-length massless rope and the guided load determine capture, lift, trip and return. The rear band, hidden winding width, head thickness, heel stop, bearing resistance, normalized load and output guides reconstruct details omitted by the engraving. The slack bow is an explicit massless display shape. Startup is retained before an eight-second physical cycle repeats in four display seconds.'});
  model.update=time=>{const state=motion.sample(time);model.setState(state);Object.assign(u.kinematics,state);};
  model.update(0);return model;
}
