import profile from '../data/spring-rack-profile.js';
import {makeSpringRackGeometry} from './spring-rack-geometry.js';
import {makeSpringRackPlayback} from './spring-rack-motion.js';

export function makeSpringRackDrive(){
 const model=makeSpringRackGeometry(profile.geometry),u=model.root.userData,motion=makeSpringRackPlayback(model,profile);
 Object.assign(u,{profile,motion,reconstructionStatus:'rebuilt',playbackPeriod:motion.displayPeriod,
  animationTiming:{authoredCyclePeriod:motion.displayPeriod},minimumDisplayCycleSeconds:motion.displayPeriod,
  stateAtTime:motion.sample,sampledMotionBounds:profile.motionBounds,
  idealConstraints:'Only the mutilated gear rotation is prescribed. Rack inertia, gravity, a compression spring, viscous guide resistance and finite tooth contact determine the lift and return. The six involute gear teeth and seven rack teeth regularize the engraving. The hollow rack, concealed sliding mandrel, rear travel-stop pin and slot, spring-end shaping, pressure angle and load parameters reconstruct details not specified in the drawing. The two-second physical cycle plays in four seconds. Startup motion is retained, followed by the repeating settled cycle.'});
 model.update=time=>{const state=motion.sample(time);model.setState(state);Object.assign(u.kinematics,state);};
 model.update(0);return model;
}
