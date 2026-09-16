import * as THREE from 'three';
import {duplex293Bake as bake} from './baked/duplex-293-contact.js';
import {plate,poly,circle,polygonClipping,ring} from './finite-plate-geometry.js';
import {markShadows} from './primitives.js';
const TAU=2*Math.PI;
function replace(mesh,geometry){mesh.geometry.dispose();mesh.geometry=geometry;}
const rotate=(p,a)=>[p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a)];
export function correctDuplex293Contact(model){
 const {root}=model,d=root.userData,b=d.blocks,g=d.geometry,oldUpdate=model.update;
 const frame=g.lockReferenceAngle-Math.PI/2,amp=g.balanceAmplitude,period=bake.period;
 d.nominal293={stateAtTime:d.stateAtTime,stateAtCyclePhase:d.stateAtCyclePhase,geometry:{...g},canonicalTimes:d.canonicalTimes,canonicalStates:d.canonicalStates};
 replace(b.wheelRim,ring(g.wheelInnerRadius,g.lockingToothRootRadius,-.15,.15,192));
 replace(b.lockingRoller,plate([[bake.roller,circle([0,0],.136,96).reverse()]],-.20,.20));
 const toothGeometry=plate(poly(bake.tooth),-.16,.16),oldTeeth=new Set(b.lockingToothMeshes.map(t=>t.geometry));
 for(const t of b.lockingToothMeshes)t.geometry=toothGeometry;
 for(const geometry of oldTeeth)geometry.dispose();
 for(let i=0;i<15;i++){b.impulsePins[i].position.x=Math.cos(i*bake.pitch)*bake.pinOrbit;b.impulsePins[i].position.y=Math.sin(i*bake.pitch)*bake.pinOrbit;}
 replace(b.impulsePalletBody,plate(poly(bake.pallet),-.10,.10));b.impulsePalletBody.position.set(0,0,.64);
 // A real stepped connection clears the crown ends at .815. The working tip
 // stays at the original .54..74 axial contact layer; its load face is retained.
 const end=bake.armEnd,curve=new THREE.CubicBezierCurve(new THREE.Vector2(0,0),new THREE.Vector2(.75,-.35),new THREE.Vector2(.65,-1.3),new THREE.Vector2(...end));
 const center=curve.getPoints(32).map(p=>p.toArray()),left=[],right=[];
 for(let i=0;i<center.length;i++){const p=center[i],a=center[Math.max(0,i-1)],z=center[Math.min(center.length-1,i+1)],dx=z[0]-a[0],dy=z[1]-a[1],L=Math.hypot(dx,dy);left.push([p[0]-dy/L*.09,p[1]+dx/L*.09]);right.push([p[0]+dy/L*.09,p[1]-dx/L*.09]);}
 const armShape=polygonClipping.difference(polygonClipping.union(poly([...left,...right.reverse()]),poly(circle([0,0],.23,96))),poly(circle([0,0],.136,96)));
 replace(b.impulsePalletArm,plate(armShape,.87,1.05));b.impulsePalletArm.position.set(0,0,0);b.impulsePalletArm.rotation.set(0,0,0);
 const neck=new THREE.Mesh(plate(poly(bake.neck),.64,.96),b.impulsePalletBody.material);neck.userData.role='stepped-293-pallet-neck-clear-of-crown-return';b.balance.add(neck);
 replace(b.rollerHub,new THREE.CylinderGeometry(.13,.13,1.98,48));b.rollerHub.position.z=.115;
 // Existing wheel spokes stopped short of the rim and crossed the arbor bore.
 for(const spoke of b.spokeMeshes){replace(spoke,plate(poly([[.16,-.135],[3.48,-.135],[3.48,.135],[.16,.135]]),-.126,.126));spoke.position.set(0,0,0);}
 for(const mesh of[b.outerLockEdge,b.releaseNotchEdge,b.silentNotchEdge,b.impulsePalletEdge,b.wheelIndex,b.lockContactMarker,b.impulseContactMarker])mesh.visible=false;
 const note='Finite roller side-lock, notch passage and crown impulse are reconstructed with a raised connecting arm. Balance timing, free advance, silent return and small running clearances are prescribed; passive spring energy, friction, impacts and loaded holding remain unresolved.';
 d.reconstructionNote=note;d.escapementInterfaces.contactResidual='Selected finite lock/impulse geometry is corrected. Passive balance forcing, clearance take-up, impacts and sustained operation remain unvalidated.';
 d.minimumDisplayCycleSeconds=6;
 g.lockingToothTipRadius=bake.toothRadius;g.impulsePinPhaseOffset=0;g.recoilAmplitude=null;
 const stateAtTime=time=>{
  const coordinate=time/period+bake.displayOffset,cycleIndex=Math.floor(coordinate),phase=coordinate-cycleIndex,rows=bake.samples;
  let lo=0,hi=rows.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(rows[mid][0]<=phase)lo=mid;else hi=mid;}
  const a=rows[lo],z=rows[hi],u=(phase-a[0])/(z[0]-a[0]),wheelAngle=a[1]+(z[1]-a[1])*u-cycleIndex*bake.pitch+frame;
  const balanceAngle=-amp*Math.cos(TAU*phase)+frame,balanceAngularSpeed=amp*TAU/period*Math.sin(TAU*phase),balanceAngularAcceleration=amp*(TAU/period)**2*Math.cos(TAU*phase);
  const row=u<.5?a:z,mode=row[2],contactMode=['free-drop','roller-side-lock','crown-pin-impulse','notch-guided-passage'][mode];
  let q=rotate([row[3],row[4]],mode===2?balanceAngle:frame);const center=mode===2?g.balanceCenter:g.wheelCenter;q=new THREE.Vector2(q[0]+center.x,q[1]+center.y);
  const advance=rows[0][1]-(wheelAngle-frame+cycleIndex*bake.pitch),toothIndex=((cycleIndex+(phase>.5?1:0))%15+15)%15;
  const tipAngle=wheelAngle+toothIndex*bake.pitch,activeLockingToothPoint=new THREE.Vector2(g.wheelCenter.x+bake.toothRadius*Math.cos(tipAngle),g.wheelCenter.y+bake.toothRadius*Math.sin(tipAngle));
  return {cycleIndex,cyclePhase:phase,balanceAngle,balanceAngularSpeed,balanceAngularAcceleration,wheelAngle,wheelAngularSpeed:(z[1]-a[1])/(z[0]-a[0])/period,wheelAngularAcceleration:0,wheelAdvance:advance,recoil:phase>.5?Math.max(0,advance-bake.pitch):0,lockingToothIndex:toothIndex,activeLockingToothPoint,activeImpulsePinIndex:((cycleIndex%15)+15)%15,singleBeatImpulseActive:mode===2,contactActive:mode!==0,contactMode,stage:contactMode,contact:mode?{mode:contactMode,expectedPoint:q,wheelResistingMoment:row[5],balanceAssistingMoment:row[6],qualification:'offline finite profile at nearest bake knot; prescribed running clearance'}:null};
 };
 const update=time=>{
  oldUpdate(time);const s=stateAtTime(time);b.balance.rotation.z=s.balanceAngle;b.wheelRotor.rotation.z=s.wheelAngle;
  for(const [mesh,speed,acceleration] of[[b.balance,s.balanceAngularSpeed,s.balanceAngularAcceleration],[b.wheelRotor,s.wheelAngularSpeed,0]]){mesh.userData.angularSpeed=speed;mesh.userData.angularAcceleration=acceleration;}
  b.lockContactMarker.visible=false;b.impulseContactMarker.visible=false;d.kinematics=s;d.contacts=s.contact;d.currentState=s;
 };
 d.stateAtTime=stateAtTime;d.stateAtCyclePhase=phase=>stateAtTime((phase-bake.displayOffset)*period);
 d.wheelAngleAtCyclePhase=(cycle,phase)=>d.stateAtCyclePhase(cycle+phase).wheelAngle;
 d.wheelStateAtPhase=phase=>{const s=d.stateAtCyclePhase(phase);return{advance:s.wheelAdvance,angularSpeed:s.wheelAngularSpeed,angularAcceleration:0,recoil:s.recoil};};
 d.canonicalTimes={poweredRest:(.03-bake.displayOffset)*period,impulseMiddle:(.313-bake.displayOffset)*period,silentMiddle:(.82-bake.displayOffset)*period,oneOscillation:period};
 d.canonicalStates=Object.fromEntries(Object.entries(d.canonicalTimes).map(([k,t])=>[k,stateAtTime(t)]));
 d.transmission.recoil='finite notch permits a bounded silent excursion and recoil, returning to the same tooth';
 d.workingDuplex293={bake,neck,armEnd:end,stateAtTime,nominalPhaseOffset:bake.displayOffset};
 // Retain the superseded mathematical loci only under an explicit nominal namespace.
 for(const name of ['impulsePalletFrameAtPhase','impulsePalletLocalPointAtPhase','impulsePalletPoints','notchFrameAtPhase','releaseNotchLocalPointAtPhase','releaseNotchPoints','silentNotchLocalPointAtPhase','silentNotchPoints','lockPoint']){d.nominal293[name]=d[name];delete d[name];}
 d.lockingToothPoint=(angle,index)=>new THREE.Vector2(g.wheelCenter.x+bake.toothRadius*Math.cos(angle+index*bake.pitch),g.wheelCenter.y+bake.toothRadius*Math.sin(angle+index*bake.pitch));
 d.impulsePinCenter=(angle,index)=>new THREE.Vector2(g.wheelCenter.x+bake.pinOrbit*Math.cos(angle+index*bake.pitch),g.wheelCenter.y+bake.pinOrbit*Math.sin(angle+index*bake.pitch));
 const impulseRows=bake.samples.filter(row=>row[2]===2);
 g.releaseStart=bake.samples.find(row=>row[0]>.04&&row[2]!==1)[0];g.impulseStart=impulseRows[0][0];g.impulseEnd=impulseRows.at(-1)[0];g.landing=bake.samples.find(row=>row[0]>g.impulseEnd&&row[2]===1)[0];
 const silent=bake.samples.filter(row=>row[0]>.5&&row[2]===3);g.silentStart=silent[0][0];g.silentEnd=silent.at(-1)[0];g.silentMiddle=(g.silentStart+g.silentEnd)/2;g.stepDuration=(g.landing-g.releaseStart)*period;
 d.timeline={demonstrationPeriod:period,schedule:['side lock','notch-guided release','crown impulse','next-tooth lock','silent notch excursion and return']};
 markShadows(root);root.traverse(o=>{for(const mat of[].concat(o.material??[]))mat.fog=false;});
 const bounds=new THREE.Box3(),p=new THREE.Vector3();
 for(let i=0;i<=64;i++){update(period*i/64);root.updateMatrixWorld(true);root.traverseVisible(o=>{const pos=o.geometry?.attributes.position;if(pos)for(let j=0;j<pos.count;j++)bounds.expandByPoint(p.fromBufferAttribute(pos,j).applyMatrix4(o.matrixWorld));});}
 d.cameraFitBounds=bounds.expandByScalar(.15);update(0);return{...model,update};
}
