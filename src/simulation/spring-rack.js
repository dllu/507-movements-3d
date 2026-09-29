import profile from '../data/spring-rack-profile.js';
import {makeSpringRackGeometry} from './spring-rack-geometry.js';
import {makeSpringRackPlayback} from './spring-rack-motion.js';

export function makeSpringRackDrive(){
 const model=makeSpringRackGeometry(profile.geometry),u=model.root.userData,motion=makeSpringRackPlayback(model,profile);
 // p106: playback starts at the settled loop (physical loopStart), so the
 // first display cycle is the repeating one, not the startup from rest.
 const startOffset=profile.loopStart*motion.displayPeriod/profile.parameters.period;
 // The rack-rod runs up through the upper guide plate; its top's highest
 // reach extends the recorded envelope.
 const bounds={min:[...profile.motionBounds.min],max:[...profile.motionBounds.max]};
 bounds.max[1]=Math.max(bounds.max[1],u.geometry.rodTop+profile.range[1]);
 Object.assign(u,{profile,motion,reconstructionStatus:'rebuilt',playbackPeriod:motion.displayPeriod,
  animationTiming:{authoredCyclePeriod:motion.displayPeriod},minimumDisplayCycleSeconds:motion.displayPeriod,
  stateAtTime:time=>motion.sample(time+startOffset),sampledMotionBounds:bounds,startOffset,
  idealConstraints:'Only the mutilated gear rotation is prescribed. Rack inertia, gravity, a compression spring, viscous guide resistance and finite tooth contact determine the lift and return. The six involute gear teeth and seven rack teeth regularize the engraving. The one-piece rack-rod running up through spring C and both guide plates, spring-end shaping, pressure angle and load parameters reconstruct details not specified in the drawing. The two-second physical cycle plays in four seconds. Playback starts in the repeating settled cycle (the recorded startup from rest is not shown). The rest position is the motion lower limit; no stop part is drawn or modelled.'});
 model.update=time=>{const state=motion.sample(time+startOffset);model.setState(state);Object.assign(u.kinematics,state);};
 model.update(0);return model;
}
