import * as THREE from 'three';
import profile from '../data/crossed-rack-profile.js';
import {makeCrossedRackGeometry} from './crossed-rack-geometry.js';
import {sampleCrossedRackMotion} from './crossed-rack-motion.js';

export function makeCrossedRackDrive(){
 const model=makeCrossedRackGeometry(profile.geometry),u=model.root.userData;
 Object.assign(u,{profile,reconstructionStatus:'rebuilt',playbackPeriod:profile.playbackPeriod,playbackDuration:profile.playbackDuration,
  animationTiming:{authoredCyclePeriod:profile.playbackPeriod},minimumDisplayCycleSeconds:profile.playbackPeriod,
  sampledMotionBounds:profile.motionBounds,stateAtTime:sampleCrossedRackMotion,
  // Frame Brown's crop: the complete stem runs on below it.
  cameraFitBounds:new THREE.Box3(new THREE.Vector3(...profile.motionBounds.min),new THREE.Vector3(...profile.motionBounds.max)),
  qualification:'Measured source contours, joint centers and sixteen teeth per side follow the engraving. Axial layers, concealed hook-toe relief, pin construction and regular pitch reconstruct details absent or irregular in the source.',
  idealConstraints:'Only the lever is prescribed. An ideal prismatic rack constraint imposes the source-described straight path; the shaft and slot alone are not claimed to form a complete linear guide. Gravity, moving-pivot inertia, viscous drag and finite frictionless tooth contact determine rack height and both free pawl angles. Common density, zero extra payload, input amplitude and period are reconstruction assumptions. Startup seating, physical handoff rollback and finite whole-rack lift are retained. The eight-second physical input cycle plays in four seconds. Input stops at a zero-speed reversal after nine display seconds; the ten-second demonstration holds its final pose for explicit replay.'});
 model.update=time=>{const state=sampleCrossedRackMotion(time);u.setState(state);Object.assign(u.kinematics,state);};
 model.update(0);return model;
}
