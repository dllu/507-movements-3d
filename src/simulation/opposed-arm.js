import profile from '../data/opposed-arm-profile.js';
import {makeOpposedArmGeometry} from './opposed-arm-geometry.js';
import {sampleOpposedArmMotion} from './opposed-arm-motion.js';

export function makeOpposedArmDrive(){
 const model=makeOpposedArmGeometry(profile.geometry),u=model.root.userData;
 Object.assign(u,{profile,reconstructionStatus:'rebuilt',playbackPeriod:profile.playbackPeriod,
  animationTiming:{authoredCyclePeriod:profile.playbackPeriod},minimumDisplayCycleSeconds:profile.playbackPeriod,
  sampledMotionBounds:profile.motionBounds,stateAtTime:sampleOpposedArmMotion,
  qualification:'Measured joint centers, rim circles and pawl contours follow the engraving. The 33 regular axial ratchet teeth, axial layers, radial journals and concealed return preload reconstruct details that the source does not fully specify.',
  idealConstraints:'A prescribed horizontal slider drives two fixed-length rods and independent radial arms. Gravity, inertia, ideal torsional hinge preload and finite unilateral tooth contact determine the free wheel and pawl tilts. Common density, damping, output resistance and stroke amplitude are reconstruction assumptions. No detailed spring coil is rendered. The eight-second physical cycle plays in four seconds. Physical startup is retained; the steady wheel advances four teeth clockwise without stopping. One bounded interior pawl-angle correction resolves dense-output interpolation overlap.'});
 model.update=time=>{const state=sampleOpposedArmMotion(time);u.setState(state);Object.assign(u.kinematics,state);};
 model.update(0);return model;
}
