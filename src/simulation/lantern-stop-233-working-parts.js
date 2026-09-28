import * as THREE from 'three';
import { plate, circle, ring } from './finite-plate-geometry.js';
import { poly, polygonClipping } from './finite-plate-geometry.js';
import { setSpin } from './primitives.js';
const replace = (mesh, geometry) => { mesh.geometry.dispose(); mesh.geometry = geometry; };
export function installLanternStop233(root, latchShape, update) {
  const d=root.userData,b=d.blocks,g=d.geometry,rotor=b.rollerWheel.userData.rotor;
  // The flat bar with its slanted end, extruded without a bevel so its
  // underside and slant keep their running clearance to the trundles.
  const outline=latchShape.getPoints(18).map(p=>p.toArray());
  replace(b.latchBody, plate([[outline,circle([0,0],.099,64)]],-.08,.08));
  const [disk,rim]=rotor.children;
  replace(disk,ring(.099,g.rollerRadius,-.09,.09,192));disk.rotation.x=0;
  replace(rim,new THREE.TorusGeometry(.37,.025,8,96));rim.position.z=.086;
  b.rollerWitness.position.z=.094;
  // The arm is on the front of the freely turning roller, with a real spindle
  // through separate bores instead of the old coplanar arm/disk overlap.
  const armMaterial=b.rollerArm.children.find(o=>o.isMesh).material;
  for(const child of [...b.rollerArm.children]){child.geometry?.dispose();b.rollerArm.remove(child);}
  // Brown's arm is a broad flat plate tapering from the small pivot eye to a
  // roller boss about 60% of the roller's diameter: one extrusion bounded by
  // two eye arcs concentric with the pivots and their common tangents.
  const armPlate=new THREE.Mesh(taperedArmGeometry(g.rollerArmLength,.14,.22,.099,.15),armMaterial);
  armPlate.position.set(0,0,.82);armPlate.rotation.z=g.rollerRestArmAngle;b.rollerArm.add(armPlate);
  armPlate.userData.role='roller-stop-tapered-flat-arm';
  const material=disk.material;
  const spindle=new THREE.Mesh(new THREE.CylinderGeometry(.095,.095,.48,64).rotateX(Math.PI/2),material);
  spindle.position.set(g.rollerArmLocal.x,g.rollerArmLocal.y,.73);spindle.userData.role='roller-spindle-in-separate-arm-and-disk-bores';b.rollerStop.add(spindle);
  // p93: each fixed pivot is a short stud just through its own part (arm
  // z .745-.895, latch .53-.69) with 0.045 standing out each side, not a
  // 1.6-long rod running behind the wheel (Brown draws only the eyes).
  for(const [pin,back,front] of [[b.rollerPivotPin,.70,.94],[b.latchPivotPin,.485,.735]]) {
    replace(pin.userData.rotor.children[0],new THREE.CylinderGeometry(.095,.095,front-back,64));
    pin.position.z=(back+front)/2;pin.userData.length=front-back;
  }
  const wheelRotor=b.wheel.userData.rotor;
  for(const mesh of wheelRotor.children)if(mesh.isMesh&&mesh.geometry.type==='CylinderGeometry'&&!mesh.userData.lanternTrundle){
    const p=mesh.geometry.parameters;
    replace(mesh,ring(.134,p.radiusTop,-p.height/2,p.height/2,128));mesh.rotation.x=0;
  }
  b.wheelIndicator.position.z=.298;
  const trundles=b.wheel.userData.trundles;
  for(const pin of trundles)replace(pin,new THREE.CylinderGeometry(g.trundleRadius,g.trundleRadius,.92,128));
  d.lanternStop233Parts={disk,rim,spindle,armPlate,latchRunningClearance:.004};
  d.minimumDisplayCycleSeconds=g.cyclePeriod;d.hideGround=true;d.cameraFov=8;
  const drivenUpdate=installRidingStops233(root,update);
  d.reconstructionNote='The roller and latch are alternative stops shown on one wheel. The wheel is turned counterclockwise one trundle per stroke; the roller rides over each trundle and drops into the next space, and the latch is lifted by the trundle under it and falls back onto the slant. Both are least-lift contact followers (they rise only as far as a trundle pushes them). Clockwise the latch locks. Gravity or spring bias, holding force, friction and impacts are not dynamically solved. The official page has no registered animation.';
  root.traverse(o=>{for(const m of [].concat(o.material??[]))m.fog=false;});
  const bounds=new THREE.Box3(),point=new THREE.Vector3();
  for(let i=0;i<=32;i++){drivenUpdate(g.cyclePeriod*i/32);root.updateMatrixWorld(true);root.traverseVisible(o=>{const p=o.geometry?.attributes.position;if(p)for(let j=0;j<p.count;j++)bounds.expandByPoint(point.fromBufferAttribute(p,j).applyMatrix4(o.matrixWorld));});}
  d.cameraFitBounds=bounds.expandByScalar(.04);drivenUpdate(0);
  return drivenUpdate;
}

function taperedArmGeometry(length,pivotEye,rollerEye,bore,depth){
  // Outer common tangents of the two eye circles.
  const c=(pivotEye-rollerEye)/length,sn=Math.sqrt(1-c*c);
  const hull=[[pivotEye*c,pivotEye*sn],[length+rollerEye*c,rollerEye*sn],[length+rollerEye*c,-rollerEye*sn],[pivotEye*c,-pivotEye*sn]];
  const outline=polygonClipping.union(poly(circle([0,0],pivotEye,96)),poly(circle([length,0],rollerEye,128)),poly(hull));
  const bored=polygonClipping.difference(outline,poly(circle([0,0],bore,64)),poly(circle([length,0],bore,64)));
  const geometry=plate(bored,-depth/2,depth/2);
  geometry.userData.bores=[{x:0,y:0,radius:bore},{x:length,y:0,radius:bore}];
  return geometry;
}

// Both stops stay engaged. The wheel turns counterclockwise one trundle per
// stroke (the latch's own overshoot-and-return law), and each stop rises only
// as far as the trundles push it: the roller is the least outward arm lift
// that clears every trundle circle, so it climbs over the trundle beneath it
// and drops into the next space; the latch keeps its solved clearance lift.
export function lanternStop233Kinematics(root){
  const d=root.userData,g=d.geometry,envelope=d.latchEnvelopeAtProgress;
  const {trundleCount:n,trundlePitch:pitch,trundleOrbitRadius:orbit,trundleRadius,rollerPivot,rollerArmLength:L,
    rollerRestArmAngle:rest,rollerContactDistance:reach,rollerRadius,rollerGapAngle,cyclePeriod,latchOvershoot}=g;
  const half=pitch/2,forwardEnd=1+latchOvershoot;
  const strokes=[{start:.16,end:.4},{start:.58,end:.82}];
  const smoother=u=>{u=Math.min(1,Math.max(0,u));return u**3*(10+u*(-15+6*u));};
  const smootherD=u=>u<=0||u>=1?0:30*u*u*(1-u)**2;
  // Wheel progress (in pitches) through one stroke and its rate per cycle.
  const strokeProgress=(phase,{start,end})=>{
    const turn=latchOvershoot>0?start+(end-start)*.75:end;
    if(phase<=start)return{p:0,dp:0,returning:false};
    if(phase<turn){const u=(phase-start)/(turn-start);return{p:smoother(u)*forwardEnd,dp:smootherD(u)/(turn-start)*forwardEnd,returning:false};}
    if(phase<end){const u=(phase-turn)/(end-turn);return{p:forwardEnd-smoother(u)*latchOvershoot,dp:-smootherD(u)/(end-turn)*latchOvershoot,returning:true};}
    return{p:1,dp:0,returning:latchOvershoot>0};
  };
  const pinCenter=(i,wheelAngle)=>{const a=rollerGapAngle+half+i*pitch+wheelAngle;return[Math.cos(a)*orbit,Math.sin(a)*orbit];};
  const centerAt=delta=>{const a=rest+delta;return[rollerPivot.x+L*Math.cos(a),rollerPivot.y+L*Math.sin(a)];};
  // Arm-lift interval over which the roller overlaps trundle i.
  const interval=(pin)=>{
    const dx=pin[0]-rollerPivot.x,dy=pin[1]-rollerPivot.y,dist=Math.hypot(dx,dy);
    const cos=(L*L+dist*dist-reach*reach)/(2*L*dist);
    if(cos>=1||cos<=-1)return null;
    const mid=Math.atan2(dy,dx)-rest,spread=Math.acos(cos);
    const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
    return[wrap(mid-spread),wrap(mid-spread)+2*spread];
  };
  const rollerLift=wheelAngle=>{
    const intervals=[];for(let i=0;i<n;i++){const iv=interval(pinCenter(i,wheelAngle));if(iv)intervals.push([...iv,i]);}
    let delta=0,binding=-1,moved=true;
    while(moved){moved=false;for(const [a,b,i] of intervals)if(delta>a+1e-12&&delta<b-1e-12){delta=b;binding=i;moved=true;}}
    return{delta,binding};
  };
  // Tabulate the lift and the rolling spin over one pitch of wheel angle.
  const samples=4096,lift=new Float64Array(samples+1),spin=new Float64Array(samples+1);
  for(let k=0;k<=samples;k++)lift[k]=rollerLift(pitch*k/samples).delta;
  const spinRate=(theta,dTheta)=>{
    const {delta,binding}=rollerLift(theta);if(binding<0)return 0;
    const deltaNext=rollerLift(theta+dTheta).delta;
    const c=centerAt(delta),pin=pinCenter(binding,theta);
    const nx=(c[0]-pin[0])/reach,ny=(c[1]-pin[1])/reach,tx=-ny,ty=nx;
    const a=rest+delta,dDelta=(deltaNext-delta)/dTheta;
    const vcx=-L*Math.sin(a)*dDelta,vcy=L*Math.cos(a)*dDelta;
    const px=pin[0]+nx*trundleRadius,py=pin[1]+ny*trundleRadius;
    return (tx*vcx+ty*vcy-(tx*-py+ty*px))/rollerRadius;
  };
  for(let k=1;k<=samples;k++){const h=pitch/samples;spin[k]=spin[k-1]+(spinRate(h*(k-1),h*1e-3)+spinRate(h*k,h*1e-3))*h/2;}
  const perPitch=spin[samples];
  const lookup=(table,theta)=>{
    const turns=Math.floor(theta/pitch+1e-12),local=Math.max(0,theta-turns*pitch)/pitch*samples;
    const k=Math.min(samples-1,Math.floor(local)),t=local-k;
    return{turns,value:table[k]+(table[k+1]-table[k])*t};
  };
  const stateAtCycleCoordinate=coordinate=>{
    const cycleIndex=Math.floor(coordinate),phase=coordinate-cycleIndex;
    const [a,b]=strokes.map(s=>strokeProgress(phase,s));
    const active=phase>strokes[0].start&&phase<strokes[0].end?a:phase>strokes[1].start&&phase<strokes[1].end?b:null;
    const progress=a.p+b.p,speed=(a.dp+b.dp)/cyclePeriod;
    const wheelAngle=pitch*(2*cycleIndex+progress);
    const within=pitch*progress;
    const roller=rollerLift(within);
    const spinAt=lookup(spin,within);
    const strokeP=active?active.p:(phase<strokes[0].start||phase>=strokes[1].end?0:1);
    const latch=active?envelope(active.p,active.returning):null;
    const latchAngle=latch?latch.latchAngle:0;
    const eps=1e-4,rollerAhead=rollerLift(within+pitch*eps).delta,rollerBehind=rollerLift(within-pitch*eps).delta;
    const rollerLeverAngularSpeed=(rollerAhead-rollerBehind)/(2*eps)*speed;
    const pin=roller.binding>=0?pinCenter(roller.binding,within):null,center=centerAt(roller.delta);
    // Physical trundle nearest a world point at the current wheel angle.
    const trundleAt=point=>{let best=0,gap=Infinity;for(let i=0;i<n;i++){const q=pinCenter(i,wheelAngle),e=Math.hypot(q[0]-point.x,q[1]-point.y);if(e<gap){gap=e;best=i;}}return best;};
    const rollerPoint=pin?{x:pin[0]+(center[0]-pin[0])/reach*trundleRadius,y:pin[1]+(center[1]-pin[1])/reach*trundleRadius}:null;
    return{
      cycleCoordinate:coordinate,cycleIndex,cyclePhase:phase,strokeProgress:strokeP,
      activeAlternative:active?'both-stops-riding':null,
      wheelAngle,wheelAngularSpeed:pitch*speed,
      rollerLeverDelta:roller.delta,rollerLeverAngle:rest+roller.delta,rollerLeverAngularSpeed,
      rollerSpinAngle:(2*cycleIndex+spinAt.turns)*perPitch+spinAt.value,
      rollerSpinAngularSpeed:roller.binding>=0&&active?spinRate(within,pitch*1e-4)*pitch*speed:0,
      rollerActive:!!active,latchActive:!!active,
      rollerContact:pin&&active?{trundleIndex:trundleAt({x:pin[0],y:pin[1]}),pinCenter:{x:pin[0],y:pin[1]},rollerCenter:{x:center[0],y:center[1]},
        point:rollerPoint,centerDistanceError:Math.hypot(center[0]-pin[0],center[1]-pin[1])-reach}:null,
      latchAngle,latchAngularSpeed:latch?latch.latchAngleDerivative*active.dp/cyclePeriod:0,
      latchContact:latch?{trundleIndex:trundleAt(latch.pinCenter),pinCenter:latch.pinCenter,point:latch.worldContactPoint,gap:latch.gap}:null,
      sourcePose:Math.abs(progress-Math.round(progress))<1e-12&&roller.delta===0&&latchAngle===0,
      stage:active?'wheel-turns-counterclockwise-roller-rides-over-and-latch-lifts':'both-stops-seated',
    };
  };
  return{stateAtCycleCoordinate,rollerLift,liftTable:lift,spinPerPitch:perPitch,strokes};
}

function installRidingStops233(root,baseUpdate){
  const d=root.userData,b=d.blocks,g=d.geometry;
  const kinematics=lanternStop233Kinematics(root);
  const rollerRotor=b.rollerWheel.userData.rotor;
  const stateAtTime=time=>kinematics.stateAtCycleCoordinate(time/g.cyclePeriod);
  d.stateAtCycleCoordinate=kinematics.stateAtCycleCoordinate;
  d.stateAtTime=stateAtTime;
  d.lanternStop233Kinematics=kinematics;
  d.mechanism='one-fourteen-trundle-lantern-wheel-turned-counterclockwise-past-a-riding-roller-detent-and-a-lifting-latch-stop';
  d.transmission={...d.transmission,alternativesSimultaneouslyLoaded:true,latchDemonstrationDirection:'counterclockwise-one-trundle-pitch',
    rollerDemonstrationDirection:'counterclockwise-one-trundle-pitch',trundlesPerDemonstrationStroke:1,strokesPerCycle:2,
    wheelReturnsToSourceAngleEachCycle:false,stopsLiftedOnlyByTrundleContact:true};
  d.canonicalTimes={cycleClosure:g.cyclePeriod,sourcePose:0,firstStrokeMidpoint:g.cyclePeriod*.28,secondStrokeMidpoint:g.cyclePeriod*.7};
  return time=>{
    baseUpdate(time);
    const state=stateAtTime(time);
    setSpin(b.wheel,state.wheelAngle);setSpin(b.wheelShaft,state.wheelAngle);
    b.rollerStop.rotation.z=state.rollerLeverDelta;
    rollerRotor.rotation.z=state.rollerSpinAngle-state.rollerLeverDelta;
    b.latchStop.rotation.z=state.latchAngle;
    b.wheel.userData.angularSpeed=state.wheelAngularSpeed;b.wheelShaft.userData.angularSpeed=state.wheelAngularSpeed;
    b.rollerStop.userData.angularSpeed=state.rollerLeverAngularSpeed;b.rollerWheel.userData.angularSpeed=state.rollerSpinAngularSpeed;
    b.latchStop.userData.angularSpeed=state.latchAngularSpeed;
    b.rollerContactMarker.visible=false;b.latchContactMarker.visible=false;
    d.contacts={latchStopToTrundle:state.latchContact,rollerStopToTrundle:state.rollerContact};
    d.kinematics=state;
  };
}
