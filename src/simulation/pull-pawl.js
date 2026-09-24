import * as THREE from 'three';
import profile from '../data/pull-pawl-profile.js';
import {makePullPawlGeometry} from './pull-pawl-geometry.js';
import {samplePullPawlMotion} from './pull-pawl-motion.js';

export function makePullPawlDrive(){
 const model=makePullPawlGeometry(profile.geometry),u=model.root.userData;
 Object.assign(u,{profile,reconstructionStatus:'rebuilt',playbackPeriod:profile.playbackPeriod,
  animationTiming:{authoredCyclePeriod:profile.playbackPeriod},minimumDisplayCycleSeconds:profile.playbackPeriod,
  sampledMotionBounds:profile.motionBounds,stateAtTime:samplePullPawlMotion,
  idealConstraints:'The prescribed rocker drives two independently hinged pulling pawls. Gravity, inertia and inelastic tooth contact determine the wheel and pawl motion. Common density, absolute angular damping and bidirectional dry-friction resistance are reconstruction assumptions. The eight-second physical cycle is displayed in four seconds. Startup settling and its tiny rollback are retained; each steady cycle advances one clockwise tooth. The concentric 26-tooth wheel, repeated spoke openings, hidden contours and rear relief beneath the left hook regularize the engraving. Ratchet teeth retain the source undercuts.'});
 // Frame the motion envelope with a margin like the plate's, so the frame
 // feet and lever tip do not run to the viewport edge.
 {const {min,max}=profile.motionBounds,pad=.06*Math.max(max[0]-min[0],max[1]-min[1]);
  u.cameraFitBounds=new THREE.Box3(new THREE.Vector3(min[0]-pad,min[1]-pad,min[2]),new THREE.Vector3(max[0]+pad,max[1]+pad,max[2]));}
 model.update=time=>{const state=samplePullPawlMotion(time);model.setState(state);Object.assign(u.kinematics,state);};
 model.update(0);return model;
}
