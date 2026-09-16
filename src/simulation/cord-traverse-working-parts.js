import * as T from 'three';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import {fitPistonGuide} from './piston-guide-parts.js';
const replace=(o,g)=>{o.geometry.dispose();o.geometry=g;};
const add=(p,g,m,role)=>{const o=new T.Mesh(g,m);o.userData.role=role;p.add(o);return o;};
const ring=(radius,bore,length)=>boredLatheGeometry([{axial:-length/2,radial:radius},{axial:length/2,radial:radius}],bore,80);
// Closed meridional sections revolved with an angle-dependent groove.
function sectionSolid(section,count=256,axis='x'){
 const positions=[],indices=[],size=section(0).length;
 for(let i=0;i<=count;i++){const a=2*Math.PI*i/count;for(const[x,r]of section(a))positions.push(...(axis==='x'?[x,r*Math.cos(a),-r*Math.sin(a)]:[r*Math.cos(a),x,r*Math.sin(a)]));}
 for(let i=0;i<count;i++)for(let j=0;j<size;j++){const a=i*size+j,b=(i+1)*size+j,c=(i+1)*size+(j+1)%size,d=i*size+(j+1)%size;indices.push(a,b,c,a,c,d);}
 let volume=0;const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();
 for(let i=0;i<indices.length;i+=3){a.fromArray(positions,indices[i]*3);b.fromArray(positions,indices[i+1]*3);c.fromArray(positions,indices[i+2]*3);volume+=a.dot(b.cross(c));}
 if(volume<0)for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
}
export function retainTraverseCord(group,radius,segments){
 const mesh=group.userData.mesh;
 replace(mesh,new T.TubeGeometry(group.userData.curve,segments,radius,10,false));
 const geometry=mesh.geometry,baseCount=geometry.attributes.position.count;
 for(const name of['position','normal']){const old=geometry.attributes[name].array,data=new Float32Array(old.length+6);data.set(old);geometry.setAttribute(name,new T.BufferAttribute(data,3).setUsage(T.DynamicDrawUsage));}
 const index=Array.from(geometry.index.array);for(let j=0;j<10;j++)index.push(baseCount,j,j+1,baseCount+1,segments*11+j+1,segments*11+j);geometry.setIndex(index);
 const p=geometry.attributes.position,n=geometry.attributes.normal;
 group.userData.setCurve=curve=>{
  const frames=curve.computeFrenetFrames(segments,false),point=new T.Vector3();
  for(let i=0;i<=segments;i++){
   curve.getPointAt(i/segments,point);
   for(let j=0;j<=10;j++){const a=2*Math.PI*j/10,c=-Math.cos(a),s=Math.sin(a),normal=frames.normals[i].clone().multiplyScalar(c).addScaledVector(frames.binormals[i],s),k=i*11+j;n.setXYZ(k,normal.x,normal.y,normal.z);p.setXYZ(k,point.x+radius*normal.x,point.y+radius*normal.y,point.z+radius*normal.z);}
  }
  for(const [vertex,u,sign]of[[baseCount,0,-1],[baseCount+1,1,1]]){curve.getPointAt(u,point);p.setXYZ(vertex,point.x,point.y,point.z);const tangent=curve.getTangentAt(u);n.setXYZ(vertex,sign*tangent.x,sign*tangent.y,sign*tangent.z);}
  p.needsUpdate=true;n.needsUpdate=true;geometry.computeBoundingBox();geometry.computeBoundingSphere();group.userData.curve=curve;group.userData.length=curve.getLength();group.userData.updateDistance(0);
 };
}
function groovedSheave(pulley,R,bore,width){
 const rotor=pulley.userData.rotor,material=pulley.userData.tread.material;
 for(const o of rotor.children)o.visible=false;
 const profile=[{axial:-width/2,radial:R+.022},{axial:-.052,radial:R+.022},{axial:-.040,radial:R-.041},{axial:.040,radial:R-.041},{axial:.052,radial:R+.022},{axial:width/2,radial:R+.022}];
 const body=add(rotor,boredLatheGeometry(profile,bore,128),material,'finite-bored-rope-groove');body.rotation.x=Math.PI/2;
 pulley.userData.workingGroove=body;
}
export function correctCordTraverseParts(root,id,update){
 const d=root.userData,b=d.blocks,g=d.geometry;
 if(id===352){
  for(const [p,R,bore,w]of[[b.leftGuide.pulley,g.fixedGuidePitchRadius,.068,.18],[b.rightGuide.pulley,g.fixedGuidePitchRadius,.068,.18],[b.movingPulley,g.movingPulleyPitchRadius,.055,.16]])groovedSheave(p,R,bore,w);
  // Both barrels retain a full finite rope pack, including the eased takeoff.
  replace(b.smallBarrel,new T.CylinderGeometry(g.smallBarrelPitchRadius-g.ropeRadius*1.12,g.smallBarrelPitchRadius-g.ropeRadius*1.12,1.45,64));b.smallBarrel.position.x=g.smallRopeExit.x+.20;
  b.barrelFlanges[2].position.x=g.smallRopeExit.x-.525;b.barrelFlanges[3].position.x=g.smallRopeExit.x+.925;
  for(const bearing of b.shaftBearings){replace(bearing,ring(.20,.104,.20));bearing.rotation.set(0,0,Math.PI/2);bearing.position.z=0;}
  // The hanger lies behind the rope plane and joins the existing axle.
  replace(b.hanger,new T.BoxGeometry(.12,.66,.16));b.hanger.position.y=-.33;b.hanger.position.addScaledVector(g.pulleyAxis,-.16);
  retainTraverseCord(b.rope,g.ropeRadius,1024);
 }else if(id===358){
  b.fuseeGroove.visible=false;
  const profile=d.profile.radiusAtTurns,N=400,height=g.fuseeHeight,pitch=height/g.revolutionCount;
  const body=sectionSolid(angle=>{
   const points=[];
   for(let i=0;i<=N;i++){
    const progress=i/N,y=g.fuseeTopY-height*progress,phase=Math.PI/2+2*Math.PI*g.revolutionCount*progress;
    const angular=Math.atan2(Math.sin(angle-phase),Math.cos(angle-phase)),offset=Math.abs(angular*pitch/(2*Math.PI));
    const floor=profile(progress*g.revolutionCount)-.032,outer=profile(progress*g.revolutionCount)+.004;
    const fraction=T.MathUtils.clamp((offset-.037)/.013,0,1);points.push([y,floor+(outer-floor)*fraction]);
   }
   points.push([g.fuseeBottomY,.046],[g.fuseeTopY,.046]);return points;
  },128,'y');replace(b.fuseeBody,body);
  b.fuseeRotor.children.filter(o=>o.userData.role==='fusee-end-face').forEach(o=>o.visible=false);
  for(const o of b.carriage.children){if(o.userData.role==='vertical-fusee-and-crank-shaft')replace(o,new T.CylinderGeometry(.043,.043,2.28,40));}
  replace(b.carriageBed,new T.BoxGeometry(1.56,.16,.76));
  for(const wheel of b.carriageWheels){wheel.position.y=-.39;replace(wheel.userData.hub,ring(.064,.042,.20));}
  for(const x of[-.57,.57]){const axle=add(b.carriage,new T.CylinderGeometry(.040,.040,1.10,32),b.carriageBed.material,'fixed-carriage-wheel-axle');axle.rotation.x=Math.PI/2;axle.position.set(x,-.39,0);}
  for(const bearing of b.carriage.children.filter(o=>o.userData.role==='carriage-mounted-fusee-shaft-bearing')){replace(bearing,ring(.14,.047,.14));bearing.rotation.set(0,0,0);const support=add(b.carriage,new T.BoxGeometry(.20,.10,.34),bearing.material,'fusee-journal-to-bearing-frame');support.position.set(0,bearing.position.y,-.26);}
  const lowerCross=add(b.carriage,new T.BoxGeometry(1.10,.10,.13),b.carriageBed.material,'lower-fusee-bearing-crossmember');lowerCross.position.set(0,.08,-.43);
  for(const cord of[b.firstCord,b.secondCord])for(const marker of cord.userData.markers)marker.visible=false;
  for(const [i,cord]of[b.firstCord,b.secondCord].entries()){retainTraverseCord(cord,.014,480);cord.userData.mesh.userData.role=`finite-fusee-cord-${i+1}`;}
  for(let x=-6;x<=6;x+=.5){const mark=add(b.track,new T.BoxGeometry(.035,Number.isInteger(x)?.085:.045,.012),b.carriageWheels[0].userData.hub.material,'rail-travel-reference-mark');mark.position.set(x,-.67,.537);}
  root.rotation.z=Math.PI/2;d.followCarriage=true;d.cameraMaxDistance=48;
 }else{
  const section=angle=>{const x=d.grooveXAtLocalAngle(angle),r=g.barrelRadius,L=g.barrelAxialLength/2;return[[-L,r],[x-.086,r],[x-.074,.676],[x+.074,.676],[x+.086,r],[L,r],[L,.094],[-L,.094]];};
  replace(b.groovedCylinder,sectionSolid(section));b.groovedCylinder.rotation.set(0,0,0);b.grooveTrack.visible=false;b.grooveReversalPockets.forEach(o=>o.visible=false);
  for(const [i,rim]of b.cylinderEndRims.entries()){replace(rim,ring(.79,.094,.022));rim.rotation.set(0,0,Math.PI/2);rim.position.x=(i?1:-1)*(g.barrelAxialLength/2+.011);}
  for(const [list,shaftRadius]of[[b.upperBearings,.082],[b.lowerBearings,.090]])for(const bearing of list){replace(bearing,ring(.20,shaftRadius+.004,.23));bearing.rotation.set(0,0,Math.PI/2);bearing.position.z=0;const bridge=add(b.frame,new T.BoxGeometry(.23,.15,.28),bearing.material,'journal-bridge-to-rear-post');bridge.position.copy(bearing.position);bridge.position.z=-.28;}
 }
 d.minimumDisplayCycleSeconds=g.cyclePeriod??g.inputCyclePeriod;d.workingPartsReview={status:'selected-finite-interfaces',residual:id===362?'The oblique planar groove prescribes a smooth sinusoidal traverse; pin clearance is finite, but load, friction and backlash response are not simulated.':'Analytical pitch-radius travel and ideal no-slip spin are preserved. Helical lay, cord elasticity, tension and the exact changing finite-radius material length remain reconstruction approximations.'};
 fitPistonGuide(root,update,d.minimumDisplayCycleSeconds);d.cameraDirection=id===362?new T.Vector3(.5,.3,15):new T.Vector3(.6,.4,15);
 if(id===358){root.updateMatrixWorld(true);d.cameraFitBounds=new T.Box3().setFromObject(b.carriage).expandByScalar(.24);d.presentation={referenceFrame:'carriage-following closeup',croppedGeometry:'The complete stationary track is retained, with its remote ends outside the initial closeup.'};}
}
