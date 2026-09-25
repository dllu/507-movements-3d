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
  // right. Those are drawing conventions, so the rope, band, remote pulley
  // and pump hardware stay whole; the default view frames Brown's window and
  // lets them run off its lower and right edges.
  const plinthBottom=(u.source.center[1]-u.source.base.bottom)/u.source.scale,plateRight=2.1;
  u.cameraFitBounds=new THREE.Box3(new THREE.Vector3(-2.31,plinthBottom,-1.43),new THREE.Vector3(plateRight,2.25,.6));
  // The engine fits the plate window edge to edge; this scale on its generic
  // distance keeps the overhead beam and left post clear of the view edges.
  u.cameraDistanceScale=6;
  model.update=time=>{const state=motion.sample(time);model.setState(state);Object.assign(u.kinematics,state);};
  model.update(0);return model;
}
