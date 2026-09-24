import profile from '../data/eccentric-two-stop-profile.js';
import {makeEccentricTwoStopCenteredCandidate,THREE} from './eccentric-two-stop/centered-geometry.js';
import {makeEccentricTwoStopMotion} from './eccentric-two-stop-motion.js';

export function makeEccentricTwoStop() {
  const model=makeEccentricTwoStopCenteredCandidate(profile.options),u=model.root.userData,motion=makeEccentricTwoStopMotion(profile);
  // Enclose every rotation, including the finite stop blocks.
  // The camera need not guess the envelope from the initial source pose.
  const bounds=new THREE.Box3();
  for(const [name,mesh]of Object.entries(u.parts)) {
    const family=u.families[name],p=mesh.geometry.attributes.position;
    if(family==='fixed'){bounds.union(new THREE.Box3().setFromObject(mesh,true));continue;}
    const center=family==='wheel'?u.geometry.O:[0,0];let radius=0,low=Infinity,high=-Infinity;
    for(let i=0;i<p.count;i++){radius=Math.max(radius,Math.hypot(p.getX(i),p.getY(i)));low=Math.min(low,p.getZ(i));high=Math.max(high,p.getZ(i));}
    bounds.expandByPoint(new THREE.Vector3(center[0]-radius,center[1]-radius,low));
    bounds.expandByPoint(new THREE.Vector3(center[0]+radius,center[1]+radius,high));
  }
  const update=time=>{const state=motion.atTime(time);model.setCoordinates(state.inputAngle,state.outputAngle);u.kinematics=state;};
  // Brown leaves a clear margin round disk B; framing the tight envelope
  // alone lets its rim run to the viewport edges.
  const pad=.08*Math.max(bounds.max.x-bounds.min.x,bounds.max.y-bounds.min.y),
    framed=bounds.clone();framed.min.x-=pad;framed.min.y-=pad;framed.max.x+=pad;framed.max.y+=pad;
  Object.assign(u,{profile,motion,stateAtTime:motion.atTime,cameraFitBounds:framed,
    fidelity:'authored',mechanism:'eccentric-center-two-stop-half-turn-cam-index',reconstructionStatus:'under-review',
    playbackPeriod:profile.displayPeriod,minimumDisplayCycleSeconds:profile.displayPeriod,
    animationTiming:{authoredCyclePeriod:profile.displayPeriod},
    qualification:'Source-traced spiral cam with finite stepped stops and contact-integrated output motion. The hidden output-axis inference and resulting rim-center shift remain reconstruction assumptions.',
    idealConstraints:'A continuous motor drives cam A. Finite contact, wheel inertia, gravity and a dry bearing brake determine output rotation and dwell. Inelastic contact impacts and a small coast after release are retained in playback.'});
  update(0);return {...model,update,motion};
}
