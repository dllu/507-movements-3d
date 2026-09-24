import * as THREE from 'three';
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
  // Brown draws a front elevation cut at the ground line: the rope runs down
  // into the plinth and the input band's two runs leave the plate to the
  // right. Clip the rope at the plinth floor and the band at the plate's right
  // edge, and frame that plate window; the pump hardware below the ground and
  // the remote pulley stay in the model for motion checks but are not shown.
  const plinthBottom=(u.source.center[1]-u.source.base.bottom)/u.source.scale,plateRight=2.1;
  u.parts.pumpRope.material.clippingPlanes=[new THREE.Plane(new THREE.Vector3(0,1,0),-plinthBottom)];
  u.parts.inputDriveBand.material.clippingPlanes=[new THREE.Plane(new THREE.Vector3(-1,0,0),plateRight)];
  for(const name of ['pumpRope','inputDriveBand'])u.parts[name].material.clipShadows=true;
  u.localClippingEnabled=true;
  u.cameraFitBounds=new THREE.Box3(new THREE.Vector3(-2.31,plinthBottom,-1.43),new THREE.Vector3(plateRight,2.25,.6));
  // The engine fits the plate window edge to edge; this scale on its generic
  // distance keeps the overhead beam and left post clear of the view edges.
  u.cameraDistanceScale=6;
  model.update=time=>{const state=motion.sample(time);model.setState(state);Object.assign(u.kinematics,state);};
  model.update(0);return model;
}
