import {reed396ContactBake as bake} from './baked/reed-396-contact.js';
import {reed396, reed396Profiles, reed396Pose, rotate396} from './reed-396-contact.js';
import * as THREE from 'three';
import {capsule, circle, poly, plate, ring, polygonClipping as clip} from './finite-plate-geometry.js';
import {markShadows} from './primitives.js';

const replace = (mesh, geometry) => { mesh.geometry.dispose(); mesh.geometry = geometry; };

// Finite working solids use the same simple outlines as the offline contact
// continuation. Playback only interpolates retained arrays; no live search.
export function finishReed396Parts(model) {
  const {root} = model, d = root.userData, b = d.blocks, g = d.geometry;
  const direct = b.chronometerPalletJ, staff = b.balance.userData.hub;
  const collar = clip.difference(clip.union(poly(circle([0, 0], .24, 96)), capsule([0, 0], [.50, 0], .065, 24)), poly(circle([0, 0], .181, 96)));
  const directBridge = new THREE.Mesh(plate(collar, .19, .31), direct.material);
  directBridge.userData.role = 'rigid-collared-attachment-of-chronometer-pallet-j';
  b.balance.add(directBridge);
  b.balance.userData.directContactIndex.visible = false;
  b.lever.userData.palletFIndex.visible = false;
  b.lever.userData.palletGIndex.visible = false;

  // Three curved webs join the existing complete toothed rim to the spindle.
  const webs = [];
  for (const spoke of b.escapeWheel.userData.spokes) { spoke.visible = false; }
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3;
    const at = (r, da) => new THREE.Vector2(r * Math.cos(a + da), r * Math.sin(a + da));
    const points = new THREE.QuadraticBezierCurve(at(.17, 0), at(.68, .38), at(1.12, .18)).getPoints(16);
    const profile = clip.union(...points.slice(1).map((p, j) => capsule(points[j].toArray(), p.toArray(), .06, 8)));
    const web = new THREE.Mesh(plate(profile, -.10, .10), b.escapeWheel.userData.toothedRim.material);
    web.userData.role = 'escape-wheel-A-curved-web';
    b.escapeWheel.add(web); webs.push(web);
  }
  const bearingParts = [];
  const shafts = [b.escapeWheel.userData.hub, staff, b.lever.userData.pivotHub];
  for (let i = 0; i < 3; i++) {
    const boss = b.bearingBosses[i], shaft = shafts[i], radius = [.20, .18, .17][i], front = [.217, .39, .64][i];
    replace(shaft, new THREE.CylinderGeometry(radius, radius, front + .72, 64));
    shaft.position.z = (front - .72) / 2;
    replace(boss, ring(radius + .003, .26, -.08, .08, 128));
    boss.rotation.set(0, 0, 0); boss.position.z = -.60;
    const post = new THREE.Mesh(new THREE.BoxGeometry(.18, 2.43, .16), boss.material);
    post.position.set(boss.position.x, -1.365, -.73);
    post.userData.role = 'rear-watch-plate-bearing-standard';
    b.fixedFrame.add(post); bearingParts.push({boss, shaft, post, bore: radius + .003});
  }
  const index = b.escapeWheel.userData.spinIndex;
  replace(index, new THREE.BoxGeometry(.13, .035, .008));
  index.position.set(.095, 0, .22);
  const balanceIndex = b.balance.userData.balanceIndex;
  replace(balanceIndex, new THREE.BoxGeometry(.045, .18, .008));
  balanceIndex.position.set(g.balanceRadius, 0, -.173);

  for(const spoke of b.balance.children.filter(o=>o.userData.role==='balance-wheel-B-spoke'))replace(spoke,new THREE.BoxGeometry(g.balanceRadius*1.94,.10,.12));
  const profiles = reed396Profiles();
  replace(b.escapeWheel.userData.toothedRim, plate(clip.difference(poly(profiles.wheel), poly(circle([0, 0], g.wheelInnerRadius, 128))), -.14, .14));
  const palletNecks=[];
  for (const [name,pallet] of [['G',b.palletG],['F',b.palletF],['J',direct]]) {
    replace(pallet, plate(poly(profiles.pallets[name]), name==='J'?-.06:-.08, name==='J'?.06:.08));
    pallet.position.set(0,0,0);pallet.rotation.set(0,0,0);
    const center=name==='J'?[.5,-.055]:profiles.pallets[name].reduce((a,p)=>[a[0]+p[0]/4,a[1]+p[1]/4],[0,0]);
    const neck = new THREE.Mesh(ring(0,name==='J'?.021:.025,name==='J'?.06:.08,name==='J'?.25:.40,48),pallet.material);
    neck.position.set(...center,0);neck.userData.role=`pallet-${name}-rigid-depth-attachment`;
    pallet.parent.add(neck);palletNecks.push(neck);
  }
  const crosspiece=b.lever.userData.crosspiece;
  replace(crosspiece,plate(capsule(palletNecks[0].position.toArray().slice(0,2),palletNecks[1].position.toArray().slice(0,2),.06,32),.28,.52));crosspiece.position.set(0,0,0);crosspiece.rotation.set(0,0,0);
  d.workingParts396 = {directBridge, webs, bearingParts,palletNecks,profiles};
  const originalUpdate=model.update, nominalState=d.stateAtTime, count=bake.samples.length-1;
  d.nominalStateAtTime396=nominalState;
  function state(time) {
    const cycle=Math.floor(time/bake.period),phase=time-cycle*bake.period;let lo=0,hi=count;while(hi-lo>1){const mid=(lo+hi)>>1;if(bake.times[mid]<=phase)lo=mid;else hi=mid;}const i=lo,span=bake.times[i+1]-bake.times[i],u=(phase-bake.times[i])/span;
    const a=bake.samples[i],z=bake.samples[i+1],pose=reed396Pose(time),old=nominalState(time);
    const wheelAngle=a[0]+(z[0]-a[0])*u-cycle*reed396.pitch,wheelAngularSpeed=(z[0]-a[0])/span;
    const mode=u<.5?a[1]:z[1],pallet=['G','F','J'][mode-1],stable=(mode===1||mode===2)&&Math.abs(pose.leverAngularSpeed)<1e-8&&Math.abs(wheelAngularSpeed)<1e-8;
    const leverImpulseActive=mode===1&&Math.abs(pose.leverAngularSpeed)>1e-8&&!stable&&wheelAngularSpeed < -1e-8;
    const directImpulseActive=mode===3&&wheelAngularSpeed < -1e-8;
    const impulseActive=leverImpulseActive||directImpulseActive;
    const point=(p,angle,center)=>{const v=rotate396(p,angle);return new THREE.Vector2(v[0]+center[0],v[1]+center[1]);};
    const palletGPoint=point(profiles.pallets.G[0],pose.leverAngle,[2.18,0]),palletFPoint=point(profiles.pallets.F[0],pose.leverAngle,[2.18,0]);
    return {...old,...pose,wheelAngle,wheelAngularSpeed,finiteContactPallet:pallet??null,finiteContactMode:mode,
      activeLockPallet:stable?pallet.toLowerCase():null,stableLock:stable,lockContact:stable?{pallet:pallet.toLowerCase(),stable:true,pointCoincidenceError:null}:null,
      palletGPoint,palletFPoint,balancePinPoint:point([g.rollerRadius*.78,0],pose.balanceAngle,g.balanceCenter.toArray()),chronometerPalletPoint:point([.658,-.0575],pose.balanceAngle,g.balanceCenter.toArray()),
      leverImpulseActive,directImpulseActive,impulseActive,impulseType:leverImpulseActive?'lever-transmitted-impulse-through-g-C-e-i':directImpulseActive?'direct-chronometer-impulse-to-j':null,
      wheelStepProgress:Math.max(0,Math.min(1,((Math.PI/8-old.halfBeatIndex*reed396.pitch/2)-wheelAngle)/(reed396.pitch/2))),unlockedOnceThisHalfBeat:wheelAngle<Math.PI/8-old.halfBeatIndex*reed396.pitch/2-1e-8,relockedOnceThisHalfBeat:stable&&pallet===(old.leverImpulseBeat?'F':'G'),forcePath:leverImpulseActive?['escape-wheel-A-tooth','lever-impulse-pallet-g','crooked-lever-C-and-fork-e','roller-pin-i','balance-B']:directImpulseActive?['escape-wheel-A-tooth','chronometer-impulse-pallet-j','balance-B']:[],
      stage:stable?`finite-lock-on-${pallet}`:impulseActive?`finite-${pallet}-impulse`:mode?'finite-detent-withdrawal':'prescribed-free-drop'};
  }
  d.stateAtTime=state;
  model.update=time=>{originalUpdate(time);const s=state(time);b.escapeWheel.rotation.z=s.wheelAngle;b.lever.rotation.z=s.leverAngle;b.balance.rotation.z=s.balanceAngle;d.kinematics=s;d.contacts={wheelLock:{active:s.stableLock,pallet:s.activeLockPallet,stable:s.stableLock,finiteGeometry:true},leverImpulseG:{active:s.leverImpulseActive,forcePath:s.leverImpulseActive?s.forcePath:[],palletPoint:s.palletGPoint},directChronometerImpulseJ:{active:s.directImpulseActive,forcePath:s.directImpulseActive?s.forcePath:[],palletPoint:s.chronometerPalletPoint},forkEToRollerPinI:{active:false,qualified:false,prescribedPickup:Math.abs(s.leverAngularSpeed)>0,pinPoint:s.balancePinPoint}};};
  d.update=model.update;
  d.motion.finiteWorkingLaw='offline finite-pallet continuation, short contact arcs and bounded prescribed free drop';
  d.nominalDynamics396=d.dynamics;
  d.dynamics={type:'baked finite-pallet kinematic continuation',finitePalletGeometry:true,passiveForcesSolved:false,forkContactSolved:false,detentOnlyFQualified:false,sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces:false,idealizations:['Prescribed balance and lever coordinates','Bounded prescribed free-drop speed','Rigid ideal sharp tooth and pallet faces','F withdrawal can receive work; strict detent-only action remains unresolved','Fork, spring, friction and impact forces not solved']};
  d.timeline.finiteLeverMove=[[.36,.66],[.464,.764]];
  d.transmission.qualification='G/J contact reactions assist their respective coordinates, but F detent-only behavior and the fork force path remain unqualified.';
  model.update(0);

  d.hideGround = true;
  d.minimumDisplayCycleSeconds = 6;
  d.cameraDistanceScale = 1.02;
  model.cameraDirection = new THREE.Vector3(.6, 1.2, 16);
  d.reconstructionNote = 'Attached finite F/G and J pallets now meet the escape wheel through a baked contact continuation: short impulse arcs, free drop and alternating locks. Pallet shapes and event timing are reconstructed. F can receive work during withdrawal, so its strict detent-only action remains unresolved. Balance/lever timing, unloaded drop speed, fork coupling and spring forces remain prescribed; passive dynamics are not solved.';
  root.traverse(o => { if (o.isMesh) for (const material of [].concat(o.material)) material.fog = false; });
  markShadows(root);
  return model;
}
