import * as T from 'three';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import {boredHorizontalPlate} from './bored-horizontal-plate.js';
import {fitPistonGuide} from './piston-guide-parts.js';
import {LaidRopeGeometry,replaceWithLaidRope} from './laid-rope.js';
import {creaseIndexedNormals} from './crease-normals.js';
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
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);creaseIndexedNormals(g);g.computeBoundingBox();g.computeBoundingSphere();return g;
}
// Brown draws these cords as laid rope: keep the shared three-strand rope,
// reusing its buffers as the cord deforms. The lay is fixed from each cord's
// anchored start.
export function retainTraverseCord(group,radius,segments){
 const mesh=group.userData.mesh;
 replace(mesh,new LaidRopeGeometry(group.userData.curve,segments,radius,8,false));
 group.userData.setCurve=curve=>{
  replaceWithLaidRope(mesh,curve,{radius,tubularSegments:segments});
  group.userData.curve=curve;group.userData.length=curve.getLength();group.userData.updateDistance(0);
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
 // 358's long side bars run off the plate; the carriage close-up frames without them.
 const sideBars358=[];
 const d=root.userData,b=d.blocks,g=d.geometry;
 if(id===352){
  for(const [p,R,bore,w]of[[b.leftGuide.pulley,g.fixedGuidePitchRadius,.068,.18],[b.rightGuide.pulley,g.fixedGuidePitchRadius,.068,.18],[b.movingPulley,g.movingPulleyPitchRadius,.055,.16]])groovedSheave(p,R,bore,w);
  // Both barrels retain a full finite rope pack, including the eased takeoff.
  replace(b.smallBarrel,new T.CylinderGeometry(g.smallBarrelPitchRadius-g.ropeRadius*1.12,g.smallBarrelPitchRadius-g.ropeRadius*1.12,1.45,64));b.smallBarrel.position.x=g.smallRopeExit.x+.20;
  // Brown's barrels are plain drums: no flanges, spin index or rope markers.
  for(const flange of b.barrelFlanges.splice(0))flange.removeFromParent();
  b.shaftIndicator.visible=false;for(const marker of[...b.ropeMarkers,...b.contactMarkers])marker.visible=false;
  for(const bearing of b.shaftBearings){replace(bearing,ring(.20,.104,.20));bearing.rotation.set(0,0,Math.PI/2);bearing.position.z=0;}
  // The hanger lies behind the rope plane and joins the existing axle.
  replace(b.hanger,new T.BoxGeometry(.12,.66,.16));b.hanger.position.y=-.33;b.hanger.position.addScaledVector(g.pulleyAxis,-.16);
  retainTraverseCord(b.rope,g.ropeRadius,1024);
 }else if(id===358){
  // Brown draws neither a separate groove tube nor a white spin index.
  b.fuseeGroove.visible=false;b.spinIndicator.visible=false;
  const profile=d.profile.radiusAtTurns,N=400,height=g.fuseeHeight,pitch=height/g.revolutionCount;
  const body=sectionSolid(angle=>{
   const points=[];
   for(let i=0;i<=N;i++){
    const progress=i/N,y=g.fuseeTopY-height*progress,phase=Math.PI/2+2*Math.PI*g.revolutionCount*progress;
    // The floor follows the lower groove edge so the cord clears Brown's steep cone;
    // the flat floor is wide enough for the two side-by-side laid cords.
    const angular=Math.atan2(Math.sin(angle-phase),Math.cos(angle-phase)),offset=Math.abs(angular*pitch/(2*Math.PI));
    const floor=profile(Math.min(1,progress+.05/height)*g.revolutionCount)-.032,outer=profile(progress*g.revolutionCount)+.004;
    const fraction=T.MathUtils.clamp((offset-.068)/.007,0,1);points.push([y,floor+(outer-floor)*fraction]);
   }
   points.push([g.fuseeBottomY,.046],[g.fuseeTopY,.046]);return points;
  },128,'y');replace(b.fuseeBody,body);
  b.fuseeRotor.children.filter(o=>o.userData.role==='fusee-end-face').forEach(o=>o.visible=false);
  for(const o of b.carriage.children){if(o.userData.role==='vertical-fusee-and-crank-shaft')replace(o,new T.CylinderGeometry(.043,.043,o.geometry.parameters.height,40));}
  // Brown's plan: two frame bars along the traverse carry the wheel axles;
  // the nearer bar also carries the shaft's small-end bearing.
  const wheelZ=b.carriageWheels[0].position.z,wheelY=b.carriageWheels[0].position.y,barLength=b.carriageBed.geometry.parameters.width;
  for(const wheel of b.carriageWheels)replace(wheel.userData.hub,ring(.064,.042,.20));
  for(const wheel of b.carriageWheels){const axle=add(b.carriage,new T.CylinderGeometry(.040,.040,1.12,32),b.carriageBed.material,'fixed-carriage-wheel-axle');axle.position.set(wheel.position.x,wheelY,wheelZ);}
  for(const bearing of b.carriage.children.filter(o=>o.userData.role==='carriage-mounted-fusee-shaft-bearing')){
   // Brown's two crank-end bearings are plain rectangular blocks standing on the bracket, bored for the shaft.
   if(bearing.position.y>1){replace(bearing,boredHorizontalPlate({outline:[[-.38,wheelZ+.04],[.38,wheelZ+.04],[.38,.16],[-.38,.16]],holes:[{radius:.047}],depth:.18}));bearing.rotation.set(0,0,0);bearing.material=bearing.material.clone();bearing.material.color.setHex(0x7e8584);bearing.userData.role='carriage-mounted-crank-end-bearing-block';continue;}
   replace(bearing,ring(.14,.047,.14));bearing.rotation.set(0,0,0);const supportLow=wheelZ,supportHigh=-.09,support=add(b.carriage,new T.BoxGeometry(.20,.10,supportHigh-supportLow),bearing.material,'fusee-journal-to-bearing-frame');support.position.set(0,bearing.position.y,(supportLow+supportHigh)/2);}
  const lowerCross=add(b.carriage,new T.BoxGeometry(barLength,.13,.13),b.carriageBed.material,'lower-fusee-bearing-crossmember');lowerCross.position.set(0,-.25,wheelZ);
  // Brown's two long flat bars run the length of the carriage, along the
  // fusee shaft: under the far wheel frame, past the fusee and the crank, and
  // on off the plate at his break. They stand clear of the crank's sweep
  // (radius 1.3) and lie under the wheel-frame bars; one cross bar joins them
  // to carry the crank-end bearing.
  const frameBars=b.carriage.children.filter(o=>o.userData.role==='carriage-mounted-fusee-bearing-frame');let frameMaterial;
  frameBars[0].traverse(o=>{if(o.isMesh&&!frameMaterial)frameMaterial=o.material;});
  for(const bar of frameBars){bar.removeFromParent();bar.traverse(o=>o.geometry?.dispose());}
  // Pass 99: Brown's bars are not symmetric: the upper one lies 1.43 from the
  // shaft, the lower one 0.71, under the fusee's large end and the crank.
  // The frame runs deep enough (bar top 1.31 below the shaft) that the lower
  // bar clears the crank handle's sweep (radius 1.38) by 0.05.
  const sideXs=[1.44,-.71],sideWidth=.24,sideZ=wheelZ-.125,sideStart=b.carriageBed.position.y-.065,sideEnd=7.5;
  for(const sideX of sideXs){const side=add(b.carriage,new T.BoxGeometry(sideWidth,sideEnd-sideStart,.13),frameMaterial,'long-carriage-side-bar-run-past-plate-break');side.position.set(sideX,(sideStart+sideEnd)/2,sideZ);sideBars358.push(side);}
  // Pass 96: Brown's box bracket, not a full cross bar. One plate off the
  // lower long bar, level with the old cross bar, runs out to 0.75 past the
  // shaft (his top edge) and carries both crank-end bearing blocks. It
  // spans the two blocks and stops short of the crank's sweep; Brown's
  // outline runs on beyond the crank, which a solid plate in the crank's
  // plane cannot do.
  {const [y0,y1]=[g.crankBearingYs[0]-.1,g.crankBearingYs[1]+.1],[x0,x1]=[sideXs[1]-sideWidth/2,.75];
   const bracket=add(b.carriage,new T.BoxGeometry(x1-x0,y1-y0,.13),frameMaterial,'carriage-mounted-fusee-bearing-frame');bracket.position.set((x0+x1)/2,(y0+y1)/2,wheelZ);}
  for(const cord of[b.firstCord,b.secondCord])for(const marker of cord.userData.markers)marker.visible=false;
  for(const [i,cord]of[b.firstCord,b.secondCord].entries()){retainTraverseCord(cord,.03,480);cord.userData.mesh.userData.role=`finite-fusee-cord-${i+1}`;}
  const rail=b.track.children.find(o=>o.userData.role==='fixed-carriage-guide-rail'),railTop=rail.position.z+.05;
  for(let x=-Math.floor(g.trackHalfLength);x<=Math.floor(g.trackHalfLength);x+=.5){const mark=add(b.track,new T.BoxGeometry(.05,Number.isInteger(x)?.36:.24,.012),rail.material,'rail-travel-reference-mark');mark.position.set(x,rail.position.y,railTop-.106);}
  root.rotation.z=Math.PI/2;d.followCarriage=true;d.cameraMaxDistance=4.8*g.carriageStroke;
 }else{
  const section=angle=>{const x=d.grooveXAtLocalAngle(angle),r=g.barrelRadius,L=g.barrelAxialLength/2;return[[-L,r],[x-.086,r],[x-.074,r-.084],[x+.074,r-.084],[x+.086,r],[L,r],[L,.094],[-L,.094]];};
  replace(b.groovedCylinder,sectionSolid(section));b.groovedCylinder.rotation.set(0,0,0);b.grooveTrack.visible=false;b.grooveReversalPockets.forEach(o=>o.visible=false);
  for(const [i,rim]of b.cylinderEndRims.entries()){replace(rim,ring(g.barrelRadius+.03,.094,.022));rim.rotation.set(0,0,Math.PI/2);rim.position.x=(i?1:-1)*(g.barrelAxialLength/2+.011);}
  for(const [list,shaftRadius]of[[b.upperBearings,.082],[b.lowerBearings,.090]])for(const bearing of list){replace(bearing,ring(.20,shaftRadius+.004,.23));bearing.rotation.set(0,0,Math.PI/2);bearing.position.z=0;const bridge=add(b.frame,new T.BoxGeometry(.23,.15,.28),bearing.material,'journal-bridge-to-rear-post');bridge.position.copy(bearing.position);bridge.position.z=-.28;}
 }
 d.minimumDisplayCycleSeconds=g.cyclePeriod??g.inputCyclePeriod;d.workingPartsReview={status:'selected-finite-interfaces',residual:id===362?'The oblique planar groove prescribes a smooth sinusoidal traverse; pin clearance is finite, but load, friction and backlash response are not simulated.':'Analytical pitch-radius travel and ideal no-slip spin are preserved. Helical lay, cord elasticity, tension and the exact changing finite-radius material length remain reconstruction approximations.'};
 fitPistonGuide(root,update,d.minimumDisplayCycleSeconds);d.cameraDirection=id===362?new T.Vector3(.5,.3,15):new T.Vector3(.6,.4,15);
 if(id===358){root.updateMatrixWorld(true);for(const bar of sideBars358)bar.removeFromParent();d.cameraFitBounds=new T.Box3().setFromObject(b.carriage).expandByScalar(.24);for(const bar of sideBars358)b.carriage.add(bar);root.updateMatrixWorld(true);d.presentation={referenceFrame:'carriage-following closeup',croppedGeometry:'The complete stationary track is retained, with its remote ends outside the initial closeup.'};}
}
