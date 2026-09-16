import * as THREE from 'three';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
const turn=2*Math.PI,cordRadius=.012,pencilRadius=.085,cordZ0=.16,cordZ1=.36;
// External tangents with a fixed clockwise winding sense. Lifting the
// attachment heights monotonically along the unfolded path separates strands.
function tangent(a,ra,b,rb){const d=b.clone().sub(a),length=d.length(),e=d.multiplyScalar(1/length),k=(ra-rb)/length,h=Math.sqrt(1-k*k),normal=new THREE.Vector2(e.x*k-e.y*h,e.y*k+e.x*h);return{start:a.clone().addScaledVector(normal,ra),end:b.clone().addScaledVector(normal,rb),normal,length:Math.sqrt(length*length-(ra-rb)**2)};}
export function hyperbolaCordPath(state){
 const first=tangent(state.lowerFocus,.07+cordRadius,state.pencilPoint,pencilRadius+cordRadius+.0002),second=tangent(state.pencilPoint,pencilRadius+cordRadius+.0002,state.ruleEnd,.075+cordRadius),angle=Math.atan2(first.normal.y,first.normal.x),last=Math.atan2(second.normal.y,second.normal.x),sweep=-((angle-last+turn)%turn),arcLength=-sweep*(pencilRadius+cordRadius+.0002),planarLength=first.length+arcLength+second.length;
 const z1=cordZ0+(cordZ1-cordZ0)*first.length/planarLength,z2=cordZ0+(cordZ1-cordZ0)*(first.length+arcLength)/planarLength;
 return{first,second,angle,sweep,z1,z2,arcLength,planarLength,visibleLength:Math.hypot(planarLength,cordZ1-cordZ0),radius:pencilRadius+cordRadius+.0002,start:new THREE.Vector3(first.start.x,first.start.y,cordZ0),entry:new THREE.Vector3(first.end.x,first.end.y,z1),exit:new THREE.Vector3(second.start.x,second.start.y,z2),end:new THREE.Vector3(second.end.x,second.end.y,cordZ1)};
}
function wrapGeometry(){const geometry=new THREE.BufferGeometry(),positions=new Float32Array(65*9*3),indices=[];for(let i=0;i<64;i++)for(let j=0;j<8;j++){let a=i*9+j,b=a+9;indices.push(a,a+1,b,b,a+1,b+1);}geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(positions.length),3));geometry.setIndex(indices);return geometry;}
export function installHyperbolaFiniteGeometry(root){
 const b=root.userData.blocks,ruleZ=.50,shift=-.195;
 b.board.visible=false;b.boardFrame.visible=false;b.lowerThreadLoop.visible=false;
 b.rule.position.z=ruleZ;b.ruleBody.position.x=shift;for(const tick of b.ruleTicks)tick.position.x=shift;b.ruleEndCap.position.x=-.215;
 const eye=new THREE.Mesh(boredLatheGeometry([{radial:.14,axial:-.08},{radial:.14,axial:.08}],.074,64).rotateX(Math.PI/2),b.ruleBody.material);eye.userData.role='bored-upper-focus-rule-eye';b.rule.add(eye);b.ruleEye=eye;
 for(const pin of[b.upperFocusPin,b.lowerFocusPin])pin.collar.position.z=-.18;
 b.upperFocusPin.axle.geometry.dispose();b.upperFocusPin.axle.geometry=new THREE.CylinderGeometry(.07,.07,.9,32);b.upperFocusPin.axle.position.z=.17;b.upperFocusPin.cap.position.z=.67;
 b.lowerFocusPin.axle.geometry.dispose();b.lowerFocusPin.axle.geometry=new THREE.CylinderGeometry(.07,.07,.32,32);b.lowerFocusPin.cap.geometry.dispose();b.lowerFocusPin.cap.geometry=new THREE.SphereGeometry(.04,18,12);b.lowerFocusPin.cap.position.z=.165;
 b.threadAnchor.position.z=cordZ1-ruleZ;
 const bridge=new THREE.Mesh(new THREE.BoxGeometry(.23,.055,.045),b.ruleBody.material);bridge.position.set(-.115,-root.userData.geometry.ruleLength,cordZ1-ruleZ);const leg=new THREE.Mesh(new THREE.BoxGeometry(.055,.055,.13),b.ruleBody.material);leg.position.set(shift,-root.userData.geometry.ruleLength,-.07);b.rule.add(bridge,leg);b.anchorBridge=[bridge,leg];
 const find=role=>b.pencil.children.find(o=>o.userData.role===role),barrel=find('moving-pencil-barrel'),cone=find('moving-pencil-conical-tip'),point=find('pencil-point-on-hyperbola');
 barrel.geometry.dispose();barrel.geometry=new THREE.CylinderGeometry(pencilRadius,pencilRadius,.65,32);barrel.position.z=.33;
 cone.geometry.dispose();cone.geometry=new THREE.CylinderGeometry(.018,pencilRadius,.13,32);cone.rotation.x=-Math.PI/2;cone.position.z=-.06;point.position.z=-.145;find('white-thread-bight-around-pencil').visible=false;
 b.pencilBarrel=barrel;b.pencilPoint=point;
 for(const cord of[b.focusCord,b.ruleCord]){cord.geometry.dispose();cord.geometry=new THREE.CylinderGeometry(cordRadius,cordRadius,1,16);}
 const wrap=new THREE.Mesh(wrapGeometry(),b.focusCord.material);wrap.userData.role='continuous-finite-cord-wrapped-around-pencil';root.add(wrap);b.pencilWrap=wrap;
 Object.assign(root.userData,{hideGround:true,cameraFov:8,cameraDirection:new THREE.Vector3(0,0,1),minimumDisplayCycleSeconds:8,cameraFitBounds:new THREE.Box3(new THREE.Vector3(-2.8,-3.35,-.28),new THREE.Vector3(2.8,2.3,.80)),reconstructionNote:'The exact hyperbola follows an ideal point-string construction. The displayed finite cord is illustrative: its prescribed winding requires changing length, so it is not an inextensible string.'});
 root.userData.sampledMotionBounds={min:root.userData.cameraFitBounds.min.toArray(),max:root.userData.cameraFitBounds.max.toArray()};
 root.traverse(o=>{for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(m)m.fog=false;});
 const update=state=>{
  const p=hyperbolaCordPath(state);b.focusCord.userData.setEndpoints(p.start,p.entry);b.ruleCord.userData.setEndpoints(p.exit,p.end);
  const a=wrap.geometry.attributes.position,n=wrap.geometry.attributes.normal;
  for(let i=0;i<=64;i++){const f=i/64,theta=p.angle+p.sweep*f,radial=new THREE.Vector3(Math.cos(theta),Math.sin(theta),0),tangent=new THREE.Vector3(-p.radius*Math.sin(theta)*p.sweep,p.radius*Math.cos(theta)*p.sweep,p.z2-p.z1).normalize(),binormal=new THREE.Vector3().crossVectors(tangent,radial),center=new THREE.Vector3(state.pencilPoint.x+p.radius*Math.cos(theta),state.pencilPoint.y+p.radius*Math.sin(theta),p.z1+(p.z2-p.z1)*f);for(let j=0;j<=8;j++){const normal=radial.clone().multiplyScalar(Math.cos(turn*j/8)).addScaledVector(binormal,Math.sin(turn*j/8)),point=center.clone().addScaledVector(normal,cordRadius),index=i*9+j;a.setXYZ(index,...point.toArray());n.setXYZ(index,...normal.toArray());}}
  a.needsUpdate=true;n.needsUpdate=true;wrap.geometry.computeBoundingBox();wrap.geometry.computeBoundingSphere();
  root.userData.finiteCord={...p,cordRadius,pencilRadius,idealLength:root.userData.geometry.threadLength,lengthResidual:p.visibleLength-root.userData.geometry.threadLength};
 };
 let min=Infinity,max=-Infinity;for(let i=0;i<=2048;i++){const p=hyperbolaCordPath(root.userData.stateAtTime(root.userData.geometry.cycleDuration*i/2048)),residual=p.visibleLength-root.userData.geometry.threadLength;min=Math.min(min,residual);max=Math.max(max,residual);}
 root.userData.finiteCordLengthRange={minimumResidual:min,maximumResidual:max,maximumVariation:max-min,idealLength:root.userData.geometry.threadLength,relativeVariation:(max-min)/root.userData.geometry.threadLength,inextensible:false,trajectoryUsesIdealPointString:true,winding:'prescribed-clockwise'};
 return update;
}
