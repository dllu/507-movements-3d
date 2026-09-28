import * as THREE from 'three';
import profile from '../data/crossed-rack-profile.js';
import {makeCrossedRackGeometry} from './crossed-rack-geometry.js';
import {sampleCrossedRackMotion} from './crossed-rack-motion.js';

export function makeCrossedRackDrive(){
 const model=makeCrossedRackGeometry(),u=model.root.userData,bounds=profile.motionBounds??{min:[-2.6,-4.81,-.5],max:[2.82,1.72,.39]};
 Object.assign(u,{profile,reconstructionStatus:'rebuilt',playbackPeriod:profile.playbackPeriod,
  animationTiming:{authoredCyclePeriod:profile.playbackPeriod},minimumDisplayCycleSeconds:profile.playbackPeriod,
  sampledMotionBounds:bounds,stateAtTime:sampleCrossedRackMotion,
  // Frame Brown's crop: the complete stem runs on below it.
  cameraFitBounds:new THREE.Box3(new THREE.Vector3(...bounds.min),new THREE.Vector3(...bounds.max)),
  qualification:'Measured source contours, joint centers and sixteen teeth per side follow the engraving. Axial layers, the hook webs reaching back into the rack plane, the fitted hook tips and regular pitch reconstruct details absent or irregular in the source.',
  idealConstraints:'Only the lever is prescribed (0.16 rad amplitude, eight-second physical swing played in four seconds). MuJoCo, baked offline, determines rack height and both pawl angles: the rack slides on an ideal prismatic vertical joint under gravity, and each pawl hangs on its lever pin with an assumed light torsional spring and light damping turning its hook toward the rack. Hook webs and rack teeth meet as convex prisms with assumed friction 0.15 and a 0.0015 contact margin, so rendered solids rest just apart. Common density, spring, damping and friction values are reconstruction assumptions; the shaft and slot alone are not claimed to form a complete linear guide. After two swings of ratchet lift, a demonstration reset not in the source (a smoothly ramped rack support and pawl-clearing torques, also simulated) raises the rack off the hooks, swings them clear, lets the rack down four pitches and sets it back on the hooks, so the twelve-second display loop repeats.'});
 model.update=time=>{const state=sampleCrossedRackMotion(time);u.setState(state);Object.assign(u.kinematics,state);};
 model.update(0);return model;
}
