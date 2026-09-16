import * as THREE from 'three';
import {lever296Parts as p} from './baked/lever-296-pallets.js';
import {plate,poly,circle,ring,polygonClipping} from './finite-plate-geometry.js';
import {markShadows} from './primitives.js';
const TAU=2*Math.PI,period=4,offset=.25;
const rot=(v,a)=>[v[0]*Math.cos(a)-v[1]*Math.sin(a),v[0]*Math.sin(a)+v[1]*Math.cos(a)];
function replace(mesh,geometry){mesh.geometry.dispose();mesh.geometry=geometry;}
export function lever296Pose(time){
 const coordinate=time/2+2*offset,halfBeatIndex=Math.floor(coordinate),halfPhase=coordinate-halfBeatIndex,side=((halfBeatIndex%2)+2)%2===0?1:-1;
 const beta=-side*p.balanceAmplitude*Math.cos(Math.PI*halfPhase),betaRate=side*p.balanceAmplitude*Math.PI/2*Math.sin(Math.PI*halfPhase),betaAcceleration=side*p.balanceAmplitude*(Math.PI/2)**2*Math.cos(Math.PI*halfPhase);
 const c=Math.max(-p.engagementAngle,Math.min(p.engagementAngle,beta)),D=p.centerDistance,r=.68,s=Math.hypot(D-r*Math.cos(c),r*Math.sin(c)),alpha=Math.atan2(-r*Math.sin(c),D-r*Math.cos(c)),z=(s*s+p.cornerRadius**2-.085**2)/(2*s*p.cornerRadius),h=Math.acos(Math.max(-1,Math.min(1,z))),sign=c<0?-1:1;
 const forkAngle=alpha-sign*(p.cornerAngle-h),ds=D*r*Math.sin(c)/s,dh=-(1-(p.cornerRadius**2-.085**2)/(s*s))/(2*p.cornerRadius)*ds/Math.sqrt(Math.max(1e-16,1-z*z)),derivative=(r*r-r*D*Math.cos(c))/(s*s)+sign*dh;
 const pinEngaged=Math.abs(beta)<=p.engagementAngle,forkAngularSpeed=pinEngaged?derivative*betaRate:0,progress=(p.bank-side*forkAngle)/(2*p.bank),progressRate=-side*forkAngularSpeed/(2*p.bank);
 let advance=0,rate=0,stage='locked';
 if(progress>=.5&&progress<.9){advance=(progress-.5)/.4*8*Math.PI/180;rate=8*Math.PI/180/.4*progressRate;stage='pallet-impulse';}
 else if(progress>=.9){const x=Math.max(0,Math.min(1,(progress-.9)/.1));advance=(8+4*x*x*(3-2*x))*Math.PI/180;rate=4*Math.PI/180*6*x*(1-x)/.1*progressRate;stage=progress>=1-1e-10?'next-pallet-lock':'free-drop';}
 const wheelAngle=2*Math.PI/3-halfBeatIndex*p.pitch/2-advance;
 return{halfBeatIndex,halfPhase,side,balanceAngle:beta,balanceAngularSpeed:betaRate,balanceAngularAcceleration:betaAcceleration,forkAngle,forkAngularSpeed,forkAngularAcceleration:null,forkProgress:progress,pinEngaged,stage,wheelAngle,wheelAngularSpeed:-rate,wheelAngularAcceleration:null,wheelAdvance:advance,activePallet:(stage==='next-pallet-lock'?-side:side)>0?'left':'right',activeToothIndex:((Math.floor((halfBeatIndex+(stage==='next-pallet-lock'?1:0))/2)+((stage==='next-pallet-lock'?-side:side)>0?0:-2))%15+15)%15};
}
export function correctLever296Contact(model){
 const {root}=model,d=root.userData,b=d.blocks,g=d.geometry,oldUpdate=model.update,frame=g.forkPlaneZ;
 d.nominal296={};for(const key of ['stateAtTime','stateAtHalfPhase','canonicalStates','canonicalTimes','forkTineFaceFrame','forkTineFacePoints','forkTineProfiles','palletContactFrame','palletImpulsePoints','palletLockPoints','palletProfiles']){d.nominal296[key]=d[key];delete d[key];}
 d.nominal296.geometry={...g};
 const working=[];
 const tooth=plate(poly(p.tooth),-.16,.16),old=new Set(b.wheelTeeth.map(o=>o.geometry));for(const t of b.wheelTeeth)t.geometry=tooth;for(const q of old)q.dispose();
 replace(b.wheelRim,ring(g.wheelInnerRadius,g.wheelToothRootRadius,-.15,.15,192));
 for(const spoke of b.wheelSpokes){replace(spoke,plate(poly([[.13,-.1],[2.15,-.1],[2.15,.1],[.13,.1]]),-.123,.123));spoke.position.set(0,0,0);}
 // The old body/lever both filled the central arbor passage.
 const outline=b.anchorBody.geometry.parameters.shapes.extractPoints().shape.map(v=>v.toArray());replace(b.anchorBody,plate(polygonClipping.difference(poly(outline),poly(circle([0,0],.126,96))),-.15,.15));
 const inAxis=points=>points.map(q=>rot(q,p.axisAngle));
 replace(b.forkLever,plate(poly(inAxis([[.16,-.15],[p.forkLength-.18,-.15],[p.forkLength-.18,.15],[.16,.15]])),-.15,.15));b.forkLever.position.set(0,0,0);b.forkLever.rotation.set(0,0,0);
 for(let i=0;i<2;i++){const sign=i===0?1:-1,inner=sign*p.forkHalfWidth,outer=sign*(p.forkHalfWidth+.13);replace(b.forkTines[i],plate(poly(inAxis([[p.forkLength-.25,inner],[p.forkLength,inner],[p.forkLength,outer],[p.forkLength-.25,outer]])),-.15,.15));b.forkTines[i].position.set(0,0,0);}
 replace(b.impulsePin,new THREE.CylinderGeometry(.085,.085,.62,96));
 root.traverse(o=>{if(/anchor-arm-to-pallet/.test(o.userData.role??''))o.visible=false;});
 const necks=[],bridges=[];
 for(let i=0;i<2;i++){
  replace(b.palletBlocks[i],plate(poly(p.pallets[i]),-.16-frame,.16-frame));
  const neck=new THREE.Mesh(plate(poly(p.necks[i]),.13-frame,.44-frame),b.palletBlocks[i].material);neck.userData.role=`finite296-pallet-neck-${i}`;b.palletFork.add(neck);necks.push(neck);
  const end=p.centers[i],start=[i===0?-1.5:1.5,-.43],dx=end[0]-start[0],dy=end[1]-start[1],L=Math.hypot(dx,dy),n=[-dy/L*.13,dx/L*.13];
  const bridge=new THREE.Mesh(plate(poly([[start[0]+n[0],start[1]+n[1]],[end[0]+n[0],end[1]+n[1]],[end[0]-n[0],end[1]-n[1]],[start[0]-n[0],start[1]-n[1]]]),-.15,.15),b.anchorBody.material);bridge.userData.role=`finite296-connected-pallet-bridge-${i}`;b.palletFork.add(bridge);bridges.push(bridge);
 }
 const bankSupports=[];
 for(let i=0;i<2;i++){
  const sign=i===0?-1:1,local=rot([2.18,sign*(.15+.085+.0005)],p.axisAngle+sign*p.bank),pin=b.bankingPins[i];
  replace(pin,new THREE.CylinderGeometry(.085,.085,1.78,48));pin.position.set(p.palletPivot[0]+local[0],p.palletPivot[1]+local[1],-.14);
  const foot=rot([2.18,0],p.axisAngle),v=new THREE.Vector3(local[0]-foot[0],local[1]-foot[1],0),bar=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,v.length(),24),pin.material);bar.position.set((local[0]+foot[0])/2+p.palletPivot[0],(local[1]+foot[1])/2+p.palletPivot[1],-1.03);bar.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());bar.userData.role=`finite296-banking-support-${i}`;b.fixedFrame.add(bar);bankSupports.push(bar);
 }
 for(const o of[b.forkIndex,b.wheelIndex,b.palletContactMarker,b.pinContactMarker,...b.forkTineEdges,...b.palletLockEdges,...b.palletImpulseEdges])o.visible=false;
 g.forkAmplitude=p.bank;g.palletReleaseHalfPhase=.5;g.palletImpulseEndHalfPhase=null;g.impulseAdvance=8*Math.PI/180;g.freeDropAdvance=4*Math.PI/180;
 const stateAtTime=time=>{
  const s=lever296Pose(time),beta=s.balanceAngle,local=rot([.68,0],g.balancePinMountAngle+beta),pinCenter=new THREE.Vector2(g.balanceCenter.x+local[0],g.balanceCenter.y+local[1]);
  const cornerSign=beta>=0?1:-1,q=rot(rot([p.forkLength,cornerSign*p.forkHalfWidth],p.axisAngle),s.forkAngle),point=new THREE.Vector2(g.palletPivot.x+q[0],g.palletPivot.y+q[1]),normal=pinCenter.clone().sub(point).normalize();
  return{...s,cyclePhase:((time/4+offset)%1+1)%1,pinContactActive:s.pinEngaged,pinContact:s.pinEngaged?{point,center:pinCenter,normal,radiusError:point.distanceTo(pinCenter)-.085,mode:s.halfPhase<.5?'balance-unlocks-fork':'fork-impulses-balance'}:null,palletContactActive:s.stage!=='free-drop',contactQualification:'generated finite lands with .0005 running clearance; prescribed load/holding'};
 };
 const update=time=>{oldUpdate(time);const s=stateAtTime(time);b.balance.rotation.z=s.balanceAngle;b.palletFork.rotation.z=s.forkAngle;b.wheelRotor.rotation.z=s.wheelAngle;b.palletContactMarker.visible=false;b.pinContactMarker.visible=false;d.kinematics=s;d.currentState=s;d.contacts={pin:s.pinContact,pallet:s.activePallet,stage:s.stage,qualification:s.contactQualification};for(const[o,rate]of[[b.balance,s.balanceAngularSpeed],[b.palletFork,s.forkAngularSpeed],[b.wheelRotor,s.wheelAngularSpeed]]){o.userData.angularSpeed=rate;o.userData.angularAcceleration=o===b.balance?s.balanceAngularAcceleration:null;}};
 d.stateAtTime=stateAtTime;d.stateAtHalfPhase=(half,u)=>stateAtTime((half+u)*2-4*offset);d.canonicalTimes={leftLock:-.6,leftImpulse:.08,rightLock:1.4,rightImpulse:2.08,oneOscillation:4};d.canonicalStates=Object.fromEntries(Object.entries(d.canonicalTimes).map(([name,t])=>[name,stateAtTime(t)]));
 d.workingLever296={parts:p,necks,bridges,bankSupports,stateAtTime};
 d.reconstructionNote='Finite fork corners engage the balance pin, and hooked teeth meet generated locking and impulse lands in the wheel plane. Balance and wheel timing, bank impacts, holding and .0005 pallet clearance are prescribed; passive spring energy, friction and loaded operation remain unresolved.';
 d.escapementInterfaces.contactResidual='Finite fork and wheel contacts reconstructed; preload, clearance take-up, bank impacts and passive energy balance remain unvalidated.';
 d.minimumDisplayCycleSeconds=6;markShadows(root);root.traverse(o=>{for(const mat of[].concat(o.material??[]))mat.fog=false;});
 const bounds=new THREE.Box3(),v=new THREE.Vector3();for(let i=0;i<=64;i++){update(i*4/64);root.updateMatrixWorld(true);root.traverseVisible(o=>{const pos=o.geometry?.attributes.position;if(pos)for(let j=0;j<pos.count;j++)bounds.expandByPoint(v.fromBufferAttribute(pos,j).applyMatrix4(o.matrixWorld));});}d.cameraFitBounds=bounds.expandByScalar(.15);update(0);return{...model,update};
}
