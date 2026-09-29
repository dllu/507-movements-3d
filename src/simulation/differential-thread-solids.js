import * as THREE from 'three';
import {helicalThread,threadAngles} from './mujoco-screw/thread-geometry.js';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const replace=(mesh,geometry)=>{mesh.geometry.dispose();mesh.geometry=geometry;};
function thread(profile,axis='z',quarter=false){let g=helicalThread(profile,threadAngles(profile,128));if(quarter)g.rotateZ(Math.PI/2);if(axis==='x')g.rotateY(Math.PI/2);if(axis==='y')g.rotateX(-Math.PI/2);return g;}
function annulus(inner,outer,depth){return boredLatheGeometry([{radial:outer,axial:-depth/2},{radial:outer,axial:depth/2}],inner,64);}
function spurBore(gear,bore,depth=null){
 const rotor=gear.userData.rotor,body=rotor.children[0],p=body.geometry.parameters,shape=p.shapes.clone(),hole=new THREE.Path();hole.absarc(0,0,bore,0,2*Math.PI,true);shape.holes.push(hole);
 replace(body,new THREE.ExtrudeGeometry(shape,{...p.options,curveSegments:48}).translate(0,0,-p.options.depth/2));body.userData.boreRadius=bore;
 const hub=rotor.children[1],hp=hub.geometry.parameters;replace(hub,annulus(bore,Math.max(hp.radiusTop,bore+.03),depth??hp.height));hub.userData.boreRadius=bore;
 const mark=rotor.children[3],start=Math.max(bore+.045,gear.userData.radius*.22),end=Math.max(start+.06,gear.userData.radius*.72);
 replace(mark,new THREE.BoxGeometry(end-start,.04,.024));mark.position.x=(start+end)/2;
}
// Pass 101 (266): a closed trapezoid (V-flanked) thread swept helically,
// root on the core, crest narrower than root, like Brown's cut threads. The
// axial width is linear in radius: rootWidth at p.inner, crestWidth at
// p.outer. Each section is the trapezoid exactly clipped to [p.low, p.high]:
// its radial extent [ra, rb] shrinks where a flank leaves the slab, and each
// boundary has one kink where it meets an end plane. So the ends close on
// the planes with no overlapping or coincident faces.
const widthAt=(p,r)=>p.rootWidth+(p.crestWidth-p.rootWidth)*(r-p.inner)/(p.outer-p.inner);
export function trapezoidThread(p,segments=128){
 const tau=2*Math.PI,mod=a=>((a%tau)+tau)%tau,wi=p.rootWidth,wo=p.crestWidth,maxW=Math.max(wi,wo);
 const dw=(wo-wi)/(p.outer-p.inner),clampR=r=>Math.min(p.outer,Math.max(p.inner,r)),rAtWidth=w=>p.inner+(w-wi)/dw;
 const range=[(p.low-maxW/2-p.phase)/p.lead,(p.high+maxW/2-p.phase)/p.lead].sort((a,b)=>a-b),angles=[];
 for(let turn=Math.floor(range[0]/tau);turn<=Math.ceil(range[1]/tau);turn++)for(let i=0;i<segments;i++){const a=turn*tau+tau*i/segments;if(a>range[0]&&a<range[1])angles.push(a);}
 for(const z of[p.low,p.high])for(const w of[wi,wo])for(const sign of[-1,1]){const a=(z-p.phase-sign*w/2)/p.lead;if(a>range[0]&&a<range[1])angles.push(a);}
 angles.push(...range);angles.sort((a,b)=>a-b);
 const list=angles.filter((a,i)=>!i||a-angles[i-1]>1e-10);
 const section=a=>{
  const c=p.phase+p.lead*a,need=2*Math.max(c-p.high,p.low-c,0);
  let ra=p.inner,rb=p.outer;
  if(need>0){const r=clampR(rAtWidth(need));if(dw<0)rb=Math.min(rb,r);else ra=Math.max(ra,r);}
  if(ra>rb)ra=rb=(ra+rb)/2;
  const lower=r=>Math.max(p.low,c-widthAt(p,r)/2),upper=r=>Math.min(p.high,c+widthAt(p,r)/2);
  const kl=Math.min(rb,Math.max(ra,rAtWidth(2*(c-p.low)))),ku=Math.min(rb,Math.max(ra,rAtWidth(2*(p.high-c))));
  const ca=Math.cos(mod(a)),sa=Math.sin(mod(a)),P=(r,z)=>[r*ca,r*sa,z];
  // lower boundary ra->kl->rb, upper boundary ra->ku->rb
  const lo=[ra,kl,rb].map(r=>({r,z:lower(r)})),hi=[ra,ku,rb].map(r=>({r,z:upper(r)}));
  const onPlane=(pts,f,plane)=>[0,1].map(k=>{const r=(pts[k].r+pts[k+1].r)/2;return Math.abs(f(r)-plane)<1e-12;});
  return{ca,sa,P,lo,hi,loPlane:onPlane(lo,lower,p.low),hiPlane:onPlane(hi,upper,p.high)};
 };
 const flankNormal=(s,r,side,plane)=>plane?[0,0,side]:new THREE.Vector3(-dw/2*s.ca,-dw/2*s.sa,side).addScaledVector(new THREE.Vector3(-s.sa,s.ca,0),-side*p.lead/Math.max(r,1e-9)).normalize().toArray();
 const rad=(s,sign)=>[sign*s.ca,sign*s.sa,0];
 const positions=[],normals=[];
 const tri=(pp,nn)=>{const a=new THREE.Vector3(...pp[0]),cr=new THREE.Vector3(...pp[1]).sub(a).cross(new THREE.Vector3(...pp[2]).sub(a));if(cr.lengthSq()<1e-22)return;
  const avg=new THREE.Vector3(...nn[0]).add(new THREE.Vector3(...nn[1])).add(new THREE.Vector3(...nn[2]));if(cr.dot(avg)<0){pp=[pp[0],pp[2],pp[1]];nn=[nn[0],nn[2],nn[1]];}positions.push(...pp.flat());normals.push(...nn.flat());};
 const quad=(pp,nn)=>{tri([pp[0],pp[1],pp[2]],[nn[0],nn[1],nn[2]]);tri([pp[0],pp[2],pp[3]],[nn[0],nn[2],nn[3]]);};
 let A=section(list[0]);
 for(let i=1;i<list.length;i++){const B=section(list[i]),pa=v=>A.P(v.r,v.z),pb=v=>B.P(v.r,v.z);
  quad([pa(A.lo[0]),pb(B.lo[0]),pb(B.hi[0]),pa(A.hi[0])],[rad(A,-1),rad(B,-1),rad(B,-1),rad(A,-1)]);
  quad([pa(A.lo[2]),pb(B.lo[2]),pb(B.hi[2]),pa(A.hi[2])],[rad(A,1),rad(B,1),rad(B,1),rad(A,1)]);
  for(const [key,side,planes] of [['lo',-1,'loPlane'],['hi',1,'hiPlane']])for(let k=0;k<2;k++){
   const plane=A[planes][k]&&B[planes][k],a0=A[key][k],a1=A[key][k+1],b0=B[key][k],b1=B[key][k+1];
   quad([pa(a0),pb(b0),pb(b1),pa(a1)],[flankNormal(A,a0.r,side,plane),flankNormal(B,b0.r,side,plane),flankNormal(B,b1.r,side,plane),flankNormal(A,a1.r,side,plane)]);
  }
  A=B;}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.computeBoundingBox();g.computeBoundingSphere();g.userData.thread={...p};return g;
}
export function correctDifferentialThreads(root,id){
 const b=root.userData.blocks,g=root.userData.geometry;
 root.userData.hideGround=true;
 if(id===260){
  // Brown hatches C at about a quarter of its diameter per stripe. A
  // three-start thread gives that fine visible pitch while keeping the
  // 0.48 lead (and so the differential feed) unchanged.
  const starts=3,pitch=g.screwLead/starts,external={inner:g.screwCoreRadius,outer:.367,low:g.externalThreadStartX,high:g.externalThreadEndX,width:pitch/2,lead:g.screwLead/(2*Math.PI),phase:g.externalThreadStartX,starts,pitch};
  const internal={inner:g.screwCoreRadius+.002,outer:.369,low:g.fixedGearStationX-g.nutWidth/2,high:g.fixedGearStationX+g.nutWidth/2,width:pitch/2-.004,lead:external.lead,phase:external.phase+pitch/2,starts,pitch};
  const multiStart=p=>mergeGeometries(Array.from({length:p.starts},(_,k)=>thread({...p,phase:p.phase+k*p.pitch},'x',true)));
  replace(b.externalThread,multiStart(external));replace(b.internalThread,multiStart(internal));
  replace(b.nutSleeve,annulus(.369,g.nutOuterRadius,g.nutWidth));b.nutSleeve.material.transparent=false;b.nutSleeve.material.opacity=1;b.nutSleeve.userData.role='bored-rotating-nut-secured-in-wheel-E-hub';
  // makeAxialCylinder already orients its Y-axis to X.
  for(const [gear,r,d]of[[b.longPinionF,.142,g.longPinionFaceWidth+.04],[b.pinionB,.142],[b.wheelD,.237],[b.wheelE,.371]])spurBore(gear,r,d);
  // Each crosshead has a real passage, including the rotating nut journal.
  for(const [bridge,radius,height,axisY]of[[b.tallStandardTop,.195,.80,g.upperAxisY],[b.rightStandardTop,.512,1.44,g.lowerAxisY]]){
   const p=bridge.geometry.parameters,shape=new THREE.Shape();shape.moveTo(-p.depth/2,-height/2);shape.lineTo(p.depth/2,-height/2);shape.lineTo(p.depth/2,height/2);shape.lineTo(-p.depth/2,height/2);shape.closePath();
   const hole=new THREE.Path();hole.absarc(0,axisY-bridge.position.y,radius,0,2*Math.PI,true);shape.holes.push(hole);
   replace(bridge,new THREE.ExtrudeGeometry(shape,{depth:p.width,bevelEnabled:false,curveSegments:64}).translate(0,0,-p.width/2).rotateY(Math.PI/2));bridge.userData.boreRadius=radius;
  }
  for(const bar of b.rightStandardBars){replace(bar,new THREE.BoxGeometry(.25,2,.3));bar.position.y=-2.27;}
  // The journal is 0.005 inside the nut's outer wall and bored 0.011 over
  // the nut and 0.009 over wheel E, so where they overlap no surfaces
  // coincide (they flickered).
  const sleeveExtension=new THREE.Mesh(annulus(.380,.505,.58).rotateZ(Math.PI/2),b.internalThread.material);sleeveExtension.position.x=2.24;sleeveExtension.userData.role='nut-journal-extension-through-fixed-bearing';b.nutAssembly.add(sleeveExtension);b.nutJournal=sleeveExtension;
  // A stationary bored collar locates the nut extension; its supports tie
  // it to both upright bars without crossing the screw passage.
  replace(b.fixedNutBearing,annulus(.512,.72,.23).rotateX(Math.PI/2));b.fixedNutBearing.position.x=2.3;
  b.contactMarkerBE.visible=false;b.contactMarkerFD.visible=false;
  root.userData.threadProfiles={external,internal};root.userData.minimumDisplayCycleSeconds=18;
  root.userData.reconstructionNote='Two unequal gear reductions turn the screw and its axially fixed nut at different speeds. Their relative rotation produces the slow axial feed. The displayed reversal and thread proportions are reconstructed.';
 }else if(id===266){
  const profiles={};
  // Brown draws V-flanked cut threads whose root is well below the crest.
  // Pass 101: a trapezoid thread (root 0.8 pitch wide on a 0.12 core, crest
  // 0.2 pitch at 0.205) replaces the shallow square ribbon on a thick core,
  // which read as a coil spring. The bearings carry the exact complement,
  // with 0.004 total axial clearance at every radius.
  const core=.12,outer=.205,clearance=.004;g.threadRootRadius=core;
  {const p=b.shaftCore.geometry.parameters;replace(b.shaftCore,new THREE.CylinderGeometry(core,core,p.height,48));}
  for(const [key,pitch,start,end,bearing,x,depth]of[['fixed',g.fixedThreadPitch,g.fixedThreadStart,g.fixedThreadEnd,b.fixedBearing,g.fixedBearingX,g.fixedBearingDepth],['moving',g.movingThreadPitch,g.movingThreadStart,g.movingThreadEnd,b.movingBearing,g.movingBearingInitialX,g.movingBearingDepth]]){
   const external={inner:core,outer,low:start,high:end,rootWidth:.8*pitch,crestWidth:.2*pitch,lead:pitch/(2*Math.PI),phase:start,pitch};
   const internal={inner:core+.002,outer:.226,low:-depth/2,high:depth/2,lead:external.lead,phase:start+pitch/2-x,pitch};
   internal.rootWidth=pitch-clearance-widthAt(external,internal.outer);internal.crestWidth=pitch-clearance-widthAt(external,internal.inner);
   // Internal thread: its root is at the bore (outer), its crest inward.
   const internalGeometryProfile={...internal,rootWidth:internal.crestWidth,crestWidth:internal.rootWidth};
   replace(b[`${key}Thread`],trapezoidThread(external));b[`${key}Thread`].material.color.copy(b.shaftCore.material.color);
   const mesh=new THREE.Mesh(trapezoidThread(internalGeometryProfile).rotateY(Math.PI/2),b[`${key}BearingBody`].material);mesh.userData.role=`${key}-matching-internal-trapezoid-thread`;bearing.add(mesh);b[`${key}InternalThread`]=mesh;
   for(const collar of b[`${key}BearingCollars`])replace(collar,annulus(.208,.28,.025).rotateX(Math.PI/2));
   profiles[key]={external,internal,widthAt:r=>widthAt(external,r),internalWidthAt:r=>widthAt(internalGeometryProfile,r)};
  }
  b.fixedContactMarker.visible=false;b.movingContactMarker.visible=false;
  root.userData.threadProfiles=profiles;root.userData.minimumDisplayCycleSeconds=12;
  root.userData.reconstructionNote='Each turn advances the shaft by the coarse pitch; the finer thread subtracts from that motion, leaving 0.06 units of bearing travel per turn. The demonstration reverses before either nut runs off its thread.';
 }
 root.traverse(o=>{for(const material of(Array.isArray(o.material)?o.material:[o.material]))if(material)material.fog=false;});
}
export function correctWormRack(root){
 const b=root.userData.blocks,g=root.userData.geometry,pitch=g.rackToothPitch,lead=pitch/(2*Math.PI);
 const profile={inner:g.wormCoreRadius,outer:.78,low:g.wormThreadMinimumY,high:g.wormThreadMaximumY,width:.32,lead,phase:g.sourceActiveToothY,squareEnds:true};
 replace(b.wormThread,thread(profile,'y'));
 b.wormThread.material.color.copy(b.wormCore.material.color);b.wormThread.userData.profile='integral-square-thread';
 // Helicoidal rack flanks match the actual square-thread worm across the
 // finite tooth width, rather than intersecting it as flat rectangular bars.
 for(const tooth of b.rackTeeth){const p=tooth.geometry.parameters,geometry=new THREE.BoxGeometry(p.width,p.height,p.depth,12,1,16),a=geometry.attributes.position;for(let i=0;i<a.count;i++){const x=a.getX(i)+tooth.position.x,z=a.getZ(i);a.setY(i,a.getY(i)+lead*Math.atan2(z,g.wormAxisX-x));}geometry.computeVertexNormals();replace(tooth,geometry);}
 for(const o of[b.base,b.baseStem,b.rearPost,...b.wormBearings,...b.rackGuides,b.contactIndex,b.threadIndex])o.visible=false;
 b.rotationIndex.position.set(.18,1.75,0);
 root.userData.threadProfiles={external:profile};root.userData.hideGround=true;root.userData.minimumDisplayCycleSeconds=8;
 root.userData.reconstructionNote='One worm turn moves the rack by one tooth pitch. The integral thread and mating flanks are reconstructed across their width; the smooth reversal keeps this finite rack in view.';
 root.userData.cameraFitBounds=new THREE.Box3(new THREE.Vector3(-1.10,-3.10,-1.05),new THREE.Vector3(1.40,4.45,.82));
 root.userData.sampledMotionBounds={min:root.userData.cameraFitBounds.min.toArray(),max:root.userData.cameraFitBounds.max.toArray()};
 root.traverse(o=>{for(const material of(Array.isArray(o.material)?o.material:[o.material]))if(material)material.fog=false;});
}
