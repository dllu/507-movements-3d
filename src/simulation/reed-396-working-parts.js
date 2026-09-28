import {reed396ContactBake as bake} from './baked/reed-396-contact.js';
import {reed396, reed396EngageAngle, reed396Profiles, reed396Pose, rotate396} from './reed-396-contact.js';
import * as THREE from 'three';
import {capsule, circle, poly, plate, ring, polygonClipping as clip} from './finite-plate-geometry.js';
import {markShadows} from './primitives.js';

const replace = (mesh, geometry) => { mesh.geometry.dispose(); mesh.geometry = geometry; };

// Finite working solids use the same simple outlines as the offline contact
// continuation. Playback only interpolates retained arrays; no live search.
export function finishReed396Parts(model) {
  const {root} = model, d = root.userData, b = d.blocks, g = d.geometry;
  const direct = b.chronometerPalletJ, staff = b.balance.userData.hub;
  b.balance.userData.directContactIndex.visible = false;
  b.lever.userData.palletFIndex.visible = false;
  b.lever.userData.palletGIndex.visible = false;

  // Brown's crossing is three slender curved arms: each is a band along a
  // circular arc from the hub to the rim, tapering outward from a broad
  // root, and the whole crossing is one extrusion with the toothed rim.
  const webs = [];
  for (const spoke of b.escapeWheel.userData.spokes) { spoke.visible = false; }
  const crossingArms = [poly(circle([0, 0], .32, 96))];
  for (let i = 0; i < 3; i++) {
    const L = g.wheelInnerRadius + .05, phi = Math.PI / 2 + i * Math.PI * 2 / 3, P = [L * Math.cos(phi), L * Math.sin(phi)], rho = 1.25;
    const h = Math.sqrt(rho * rho - L * L / 4), n = [Math.sin(phi), -Math.cos(phi)];
    const C = [P[0] / 2 + n[0] * h, P[1] / 2 + n[1] * h];
    const a0 = Math.atan2(-C[1], -C[0]);
    let a1 = Math.atan2(P[1] - C[1], P[0] - C[0]);
    while (a1 - a0 > Math.PI) a1 -= 2 * Math.PI; while (a1 - a0 < -Math.PI) a1 += 2 * Math.PI;
    const count = 48, outer = [], inner = [];
    for (let k = 0; k <= count; k++) {
      const t = k / count, ang = a0 + (a1 - a0) * t, half = .135 - .06 * t;
      outer.push([C[0] + (rho + half) * Math.cos(ang), C[1] + (rho + half) * Math.sin(ang)]);
      inner.push([C[0] + (rho - half) * Math.cos(ang), C[1] + (rho - half) * Math.sin(ang)]);
    }
    crossingArms.push(poly([...outer, ...inner.reverse()]));
  }
  const crossing = clip.union(...crossingArms);
  const bearingParts = [];
  const shafts = [b.escapeWheel.userData.hub, staff, b.lever.userData.pivotHub];
  for (let i = 0; i < 3; i++) {
    // Staff b's rear bearing stands behind the balance's hub (z -0.62).
    const boss = b.bearingBosses[i], shaft = shafts[i], radius = [.20, .18, .17][i], front = [.217, .10, .12][i];
    const back = i === 1 ? .80 : .72, bossZ = i === 1 ? -.715 : -.60;
    replace(shaft, new THREE.CylinderGeometry(radius, radius, front + back, 64));
    shaft.position.z = (front - back) / 2;
    replace(boss, ring(radius + .003, .26, -.08, i === 1 ? .055 : .08, 128));
    boss.rotation.set(0, 0, 0); boss.position.z = bossZ;
    const post = new THREE.Mesh(new THREE.BoxGeometry(.18, 2.83, .16), boss.material);
    post.position.set(boss.position.x, -1.565, -.73);
    post.userData.role = 'rear-watch-plate-bearing-standard';
    b.fixedFrame.add(post); bearingParts.push({boss, shaft, post, bore: radius + .003});
  }
  const index = b.escapeWheel.userData.spinIndex;
  replace(index, new THREE.BoxGeometry(.13, .035, .008));
  index.position.set(.095, 0, .22);
  const balanceIndex = b.balance.userData.balanceIndex;
  replace(balanceIndex, new THREE.BoxGeometry(.045, .18, .008));
  balanceIndex.position.set(g.balanceRadius, 0, -.173);

  const profiles = reed396Profiles();
  replace(b.escapeWheel.userData.toothedRim, plate(clip.union(clip.difference(poly(profiles.wheel), poly(circle([0, 0], g.wheelInnerRadius, 256))), crossing), -.14, .14));
  b.escapeWheel.userData.toothedRim.userData.role = 'twelve-tooth-escape-wheel-rim-and-three-armed-crossing';
  // Pallets g and f and the anchor-like cross-piece h are one plate in the
  // escape wheel's plane, as Brown draws it: a bracket round staff c whose
  // two arms end in the pallets. The lever arm, fork and tail sit above it
  // on the same staff.
  const hull = (points) => {
    const pts = [...points].sort((p, q) => p[0] - q[0] || p[1] - q[1]), cross = (o, a, c) => (a[0] - o[0]) * (c[1] - o[1]) - (a[1] - o[1]) * (c[0] - o[0]);
    const half = (list) => { const out = []; for (const p of list) { while (out.length >= 2 && cross(out.at(-2), out.at(-1), p) <= 0) out.pop(); out.push(p); } return out.slice(0, -1); };
    return [...half(pts), ...half([...pts].reverse())];
  };
  // Each arm runs from its pallet's back (the side away from the teeth) to
  // the bar through staff c.
  const {G: gOutlines, F: fOutlines} = profiles.outlines;
  const gBack = gOutlines[0].slice(gOutlines[0].length / 2), fBack = fOutlines[0].slice(fOutlines[0].length / 2);
  const barLeft = -.20, barRight = .12;
  const arm = (back, sign) => {
    const ys = back.map(([, y]) => sign * y), inner = Math.min(...ys) - .02, outer = Math.max(...ys) + .06;
    return {inner, outer, shape: poly(hull([...back, [barLeft, sign * inner], [barRight, sign * inner], [barRight, sign * outer], [barLeft, sign * outer]]))};
  };
  const gArm = arm(gBack, -1), fArm = arm(fBack, 1);
  const anchorShape = clip.difference(clip.union(
    ...gOutlines.map(poly), ...fOutlines.map(poly), gArm.shape, fArm.shape,
    poly([[barLeft, -gArm.outer], [barRight, -gArm.outer], [barRight, fArm.outer], [barLeft, fArm.outer]]),
    poly(circle([0, 0], .27, 96)),
  ), poly(circle([0, 0], .173, 96)));
  replace(b.palletG, plate(anchorShape, -.08, .08));
  b.palletG.position.set(0, 0, 0); b.palletG.rotation.set(0, 0, 0);
  b.palletG.userData.role = 'one-piece-anchor-cross-piece-h-with-pallets-g-and-f';
  b.palletF.parent?.remove(b.palletF);
  b.palletF = b.palletG; d.blocks.palletF = b.palletG;
  const crosspiece = b.lever.userData.crosspiece;
  crosspiece.parent?.remove(crosspiece);
  b.lever.userData.crosspiece = b.palletG;
  // Chronometer pallet j and its arm are one plate on staff b, in the wheel's
  // plane, standing reed396.jOffset behind roller pin i.
  const [[jRoot, jLow], , [jTip, jHigh]] = profiles.pallets.J[0], jMid = (jLow + jHigh) / 2;
  const jArm = clip.difference(clip.union(
    poly(profiles.pallets.J[0]), capsule([0, 0], [jRoot + .05, jMid], (jHigh - jLow) / 2, 24), poly(circle([0, 0], .25, 96)),
  ), poly(circle([0, 0], .183, 96)));
  replace(direct, plate(jArm.map((polygon) => polygon.map((ring) => ring.map((q) => rotate396(q, reed396.jOffset)))), -.06, .06));
  direct.position.set(0, 0, 0); direct.rotation.set(0, 0, 0);
  direct.userData.role = 'chronometer-impulse-pallet-j-with-its-arm-on-balance-staff';
  const directBridge = direct, palletNecks = [];
  d.workingParts396 = {directBridge, webs, bearingParts,palletNecks,profiles};
  const originalUpdate=model.update, nominalState=d.stateAtTime, count=bake.samples.length-1, restAngle=bake.samples[0][0];
  d.nominalStateAtTime396=nominalState;
  function state(time) {
    const cycle=Math.floor(time/bake.period),phase=time-cycle*bake.period;let lo=0,hi=count;while(hi-lo>1){const mid=(lo+hi)>>1;if(bake.times[mid]<=phase)lo=mid;else hi=mid;}const i=lo,span=bake.times[i+1]-bake.times[i],u=(phase-bake.times[i])/span;
    const a=bake.samples[i],z=bake.samples[i+1],pose=reed396Pose(time),old=nominalState(time);
    const wheelAngle=a[0]+(z[0]-a[0])*u-cycle*reed396.pitch,wheelAngularSpeed=(z[0]-a[0])/span;
    const mode=u<.5?a[1]:z[1],pallet=['G','F','J'][mode-1],stable=(mode===1||mode===2)&&Math.abs(pose.leverAngularSpeed)<1e-8&&Math.abs(wheelAngularSpeed)<1e-8;
    // An impulse needs the pallet in contact at both ends of the interval (a
    // landing interval ends in contact but is free drop) and a tooth moving
    // faster than lock-arc creep.
    const held=a[1]===z[1],leverImpulseActive=held&&mode===1&&Math.abs(pose.leverAngularSpeed)>1e-8&&!stable&&wheelAngularSpeed < -1e-3;
    const directImpulseActive=held&&mode===3&&wheelAngularSpeed < -1e-3;
    const impulseActive=leverImpulseActive||directImpulseActive;
    const point=(p,angle,center)=>{const v=rotate396(p,angle);return new THREE.Vector2(v[0]+center[0],v[1]+center[1]);};
    const palletGPoint=point(profiles.pallets.G[0][0],pose.leverAngle,[reed396.leverPivot,0]),palletFPoint=point(profiles.pallets.F[0][0],pose.leverAngle,[reed396.leverPivot,0]);
    return {...old,...pose,wheelAngle,wheelAngularSpeed,finiteContactPallet:pallet??null,finiteContactMode:mode,
      activeLockPallet:stable?pallet.toLowerCase():null,stableLock:stable,lockContact:stable?{pallet:pallet.toLowerCase(),stable:true,pointCoincidenceError:null}:null,
      palletGPoint,palletFPoint,balancePinPoint:point([reed396.pinOrbit,0],pose.balanceAngle,g.balanceCenter.toArray()),chronometerPalletPoint:point([jTip,jMid],pose.balanceAngle+reed396.jOffset,g.balanceCenter.toArray()),
      leverImpulseActive,directImpulseActive,impulseActive,impulseType:leverImpulseActive?'lever-transmitted-impulse-through-g-C-e-i':directImpulseActive?'direct-chronometer-impulse-to-j':null,
      wheelStepProgress:Math.max(0,Math.min(1,((restAngle-old.halfBeatIndex*reed396.pitch/2)-wheelAngle)/(reed396.pitch/2))),unlockedOnceThisHalfBeat:wheelAngle<restAngle-old.halfBeatIndex*reed396.pitch/2-1e-8,relockedOnceThisHalfBeat:stable&&pallet===(old.leverImpulseBeat?'F':'G'),forcePath:leverImpulseActive?['escape-wheel-A-tooth','lever-impulse-pallet-g','crooked-lever-C-and-fork-e','roller-pin-i','balance-B']:directImpulseActive?['escape-wheel-A-tooth','chronometer-impulse-pallet-j','balance-B']:[],
      stage:stable?`finite-lock-on-${pallet}`:impulseActive?`finite-${pallet}-impulse`:mode?'finite-detent-withdrawal':'prescribed-free-drop'};
  }
  d.stateAtTime=state;
  model.update=time=>{originalUpdate(time);const s=state(time);b.escapeWheel.rotation.z=s.wheelAngle;b.lever.rotation.z=s.leverAngle;b.balance.rotation.z=s.balanceAngle;d.kinematics=s;d.contacts={wheelLock:{active:s.stableLock,pallet:s.activeLockPallet,stable:s.stableLock,finiteGeometry:true},leverImpulseG:{active:s.leverImpulseActive,forcePath:s.leverImpulseActive?s.forcePath:[],palletPoint:s.palletGPoint},directChronometerImpulseJ:{active:s.directImpulseActive,forcePath:s.directImpulseActive?s.forcePath:[],palletPoint:s.chronometerPalletPoint},forkEToRollerPinI:{active:s.forkEngaged,kinematicSlot:true,pinPoint:s.balancePinPoint}};};
  d.update=model.update;
  d.motion.finiteWorkingLaw='lever C follows roller pin i in the slot of fork e and rests on a banking pin otherwise; offline finite-pallet continuation, short contact arcs and bounded prescribed free drop';
  d.nominalDynamics396=d.dynamics;
  d.dynamics={type:'baked finite-pallet kinematic continuation',finitePalletGeometry:true,passiveForcesSolved:false,forkContactSolved:false,detentOnlyFQualified:false,sourceSpecifiesAbsoluteDimensionsTimingMaterialsLoadsOrForces:false,idealizations:['Prescribed balance vibration; lever angle is the fork-slot constraint on roller pin i','Bounded prescribed free-drop speed','Rigid ideal sharp tooth and pallet faces','F withdrawal can receive work; strict detent-only action remains unresolved','Fork, spring, friction and impact forces not solved (the fork is a kinematic slot)']};
  {const phase=Math.acos(reed396EngageAngle/reed396.balanceAmplitude)/Math.PI;d.timeline.finiteLeverMove=[[phase,1-phase],[phase,1-phase]];}
  d.transmission.qualification='G/J contact reactions assist their respective coordinates; the fork carries the lever by its slot. F detent-only behaviour remains unqualified.';
  model.update(0);

  d.hideGround = true;
  d.minimumDisplayCycleSeconds = 6;
  d.cameraDistanceScale = 1.02;
  model.cameraDirection = new THREE.Vector3(.6, 1.2, 16);
  d.reconstructionNote = 'Brown\'s proportions: balance staff b 1.83 tooth-tip radii from staff a and a balance rim 1.63 tip radii. The one-piece anchor (cross-piece h with lower pallet g and upper detent f) and the long pallet-j arm meet the escape wheel in its own plane through a baked contact continuation. On the clockwise swing g unlocks and the tooth drives the lever (impulse through C, e and i) and f catches; on the return swing f unlocks and the released tooth\'s locking face overtakes j as it rises across the line of centres, driving the balance directly, and g catches. Locking faces are arcs about staff c. Lever C follows roller pin i in the slot of fork e. Pallet shapes, j\'s angle on its staff and event timing are reconstructed. F can receive work during withdrawal, so its strict detent-only action remains unresolved. Balance timing, unloaded drop speed and spring forces remain prescribed; passive dynamics are not solved.';
  root.traverse(o => { if (o.isMesh) for (const material of [].concat(o.material)) material.fog = false; });
  markShadows(root);
  return model;
}
