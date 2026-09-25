import * as THREE from 'three';
import {plate,poly,circle,polygonClipping as clip} from './finite-plate-geometry.js';
import {horizontalPlate,horizontalRing,horizontalTurned} from './horizontal-turbine-solids.js';
import {curvedPipeWall,mergePassageParts} from './finite-fluid-passages.js';
import {portedBarrel} from './lift-pump-working-parts.js';
import {boredPlanarLinkGeometry} from './bored-planar-link.js';
import {PALETTE,matte} from './primitives.js';
import {waterFountainGeometry,waterJetMaterial,waterVolumeMaterial} from './water-volume.js';
const replace=(o,g)=>{o.geometry.dispose();o.geometry=g;};
const rectangle=(w,h,cx=0,cy=0)=>poly([[cx-w/2,cy-h/2],[cx+w/2,cy-h/2],[cx+w/2,cy+h/2],[cx-w/2,cy+h/2]]);
const add=(parent,geometry,material,role)=>{const mesh=new THREE.Mesh(geometry,material);mesh.userData.role=role;parent.add(mesh);return mesh;};
export function fountainBowlLevel(volume){
  const r=1.2,width=1.35;
  const volumeAt=h=>width*(r*r*Math.acos((r-h)/r)-(r-h)*Math.sqrt(Math.max(0,2*r*h-h*h)));
  let low=0,high=r;
  for(let i=0;i<40;i++){const h=(low+high)/2;if(volumeAt(h)<volume)low=h;else high=h;}
  return 2+(low+high)/2;
}

export function correctFountain(root){
 const d=root.userData,b=d.blocks,g=d.geometry,material=b.basinFloor.material;
 b.foundation.visible=false;
 const lowerOuter=rectangle(4.46,1.78),lowerInner=rectangle(g.lowerInnerLength,g.lowerInnerWidth);
 replace(b.lowerShell,horizontalPlate(clip.difference(lowerOuter,lowerInner),g.lowerBottomY,g.lowerBottomY+g.lowerInnerHeight));b.lowerShell.position.y=0;
 const rails=b.lowerVessel.children.filter(o=>o.geometry?.type==='BoxGeometry'&&o!==b.lowerWater&&o!==b.lowerAirCavity);
 for(const rail of rails){
   const top=rail.position.y>.5,outline=top?clip.difference(rectangle(4.58,1.90),poly(circle([-1.66,0],.098,64)),poly(circle([1.66,0],.134,64))):rectangle(4.58,1.90);
   replace(rail,horizontalPlate(outline,top?.67:-.05,top?.77:.05));rail.position.set(0,0,0);
 }
 // The engraving's bowl sits in a larger sealed air enclosure.
 const bellOuter=rectangle(2.72,1.67),bellInner=rectangle(2.60,1.55);
 const lower=horizontalPlate(clip.difference(bellOuter,bellInner),.77,3.34);
 const upper=horizontalPlate(clip.difference(bellOuter,bellInner),3.56,g.topBasinBottomY-.12);
 const portLayer=clip.difference(clip.difference(bellOuter,bellInner),rectangle(.25,.21,-1.32,0));
 const middle=horizontalPlate(portLayer,3.34,3.56);
 replace(b.intermediateShell,mergePassageParts([lower,middle,upper]));b.intermediateShell.position.set(0,0,0);
 b.intermediateRims.forEach(o=>o.visible=false);
 b.intermediateAirCavity.visible=false;
 const outer=[],inner=[];
 for(let i=0;i<=96;i++){const a=Math.PI+Math.PI*i/96;outer.push([1.24*Math.cos(a),3.2+1.24*Math.sin(a)]);inner.push([1.208*Math.cos(a),3.2+1.208*Math.sin(a)]);}
 const bowlProfile=poly([...outer,...inner.reverse()]);
 b.bowl=add(b.intermediateVessel,plate(bowlProfile,-.715,.715),material,'finite-semicircular-intermediate-water-bowl');
 const endOutline=poly([...outer,[1.24,3.2],[-1.24,3.2]]);
 for(const z of[-.70,.70])add(b.intermediateVessel,plate(endOutline,z-.025,z+.025),b.intermediateShell.material,'closed-bowl-end-wall');
 // Fixed topology for a circular-segment water prism, with a level surface.
 const segments=96,positions=new Float32Array(segments*12*3),geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));replace(b.intermediateWater,geometry);
 const updateWater=level=>{
   const half=Math.acos((3.2-level)/1.2),points=[];
   for(let i=0;i<=segments;i++){const a=-Math.PI/2-half+2*half*i/segments;points.push(new THREE.Vector2(1.2*Math.cos(a),3.2+1.2*Math.sin(a)));}
   const p=geometry.attributes.position;let n=0;
   const vertex=(v,z)=>p.setXYZ(n++,v.x,v.y,z);
   for(let i=1;i<segments;i++)for(const z of[-.675,.675]){
     const list=z>0?[points[0],points[i],points[i+1]]:[points[0],points[i+1],points[i]];list.forEach(v=>vertex(v,z));
   }
   for(let i=0;i<=segments;i++){const a=points[i],c=points[(i+1)%(segments+1)];for(const[v,z]of[[a,-.675],[c,-.675],[c,.675],[a,-.675],[c,.675],[a,.675]])vertex(v,z);}
   for(let i=n;i<p.count;i++)p.setXYZ(i,0,0,0);geometry.setDrawRange(0,n);p.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();b.intermediateWater.position.set(0,0,0);b.intermediateWater.scale.set(1,1,1);
 };
 replace(b.basinFloor,horizontalPlate(clip.difference(rectangle(4.62,1.76),poly(circle([0,0],.109,64)),poly(circle([1.66,0],.134,64))),g.topBasinBottomY-.12,g.topBasinBottomY));b.basinFloor.position.set(0,0,0);
 replace(b.rightDrainOuter,horizontalTurned([[.08,.080],[.08,.13],[g.topBasinBottomY+.06,.13],[g.topBasinBottomY+.06,.080]]));b.rightDrainOuter.position.set(1.66,0,0);
 replace(b.rightDrainWater,new THREE.CylinderGeometry(.072,.072,g.topBasinBottomY-.04,32));b.rightDrainWater.position.set(1.66,(g.topBasinBottomY+.14)/2,0);
 const air=new THREE.CatmullRomCurve3([new THREE.Vector3(-1.66,.55,0),new THREE.Vector3(-1.66,3.12,0),new THREE.Vector3(-1.60,3.45,0),new THREE.Vector3(-1.24,3.45,0)]);
 replace(b.leftAirPipe,curvedPipeWall(air,.055,.095,96));replace(b.airCore,new THREE.TubeGeometry(air,96,.045,12,false));
 replace(b.centralRiser,horizontalTurned([[2.055,.067],[2.055,.105],[g.nozzleY-.18,.105],[g.nozzleY-.18,.067]]));b.centralRiser.position.set(0,0,0);
 replace(b.centralRiserWater,new THREE.CylinderGeometry(.055,.055,g.nozzleY-2.075,28));b.centralRiserWater.position.set(0,(g.nozzleY+2.035)/2,0);
 replace(b.nozzle,horizontalTurned([[-.10,.060],[-.10,.095],[.10,.075],[.10,.060]]));
 replace(b.jetColumn,new THREE.CylinderGeometry(.016,.028,1,16));
 // Brown draws the jet as a willow plume rising from the spire tip and
 // falling back on every side: one translucent column and falling crown that
 // thins into spray, fixed in shape (unit head) and scaled with the pressure
 // head H. The left spray mesh carries the column and the left half of the
 // crown, the right one the right half.
 const nominalHead=d.stateAtTime(0).idealJetHeight;
 b.fountainSprays.forEach((spray,i)=>{
   replace(spray,waterFountainGeometry({nozzleY:-.04,apexY:1,columnRadius:.04/nominalHead,crownRadius:.9,fallY:-.25,crownThickness:.035,fadeStart:.62,
     thetaStart:i===0?Math.PI/2:-Math.PI/2,thetaLength:Math.PI,radialSegments:24,column:i===0,cutColumn:false}));
   spray.position.set(0,g.nozzleY,0);
 });
 const pour=new THREE.CatmullRomCurve3([new THREE.Vector3(-1.52,g.topBasinBottomY+1.10,.20),new THREE.Vector3(-1.46,g.topBasinBottomY+.80,.12),new THREE.Vector3(-1.31,g.topBasinBottomY+.50,.04),new THREE.Vector3(-1.18,g.topBasinBottomY+g.topWaterVolume/g.topArea,0)]);
 replace(b.externalPour,new THREE.TubeGeometry(pour,36,.055,10,false));
 const section=sectionFountain(root);
 d.updateWorkingParts=state=>{
   updateWater(state.intermediateWaterSurfaceY);b.intermediateAirCavity.visible=false;
   const head=Math.max(.02,state.idealJetHeight);
   b.fountainSprays.forEach(spray=>{spray.scale.setScalar(head);spray.position.y=section.spireTipY;});
   section.update(state,b.jetColumn.material.opacity);
 };
 d.reconstructionNote='Three connected vessel paths and a finite circular bowl follow the engraving. Water transfer, isothermal pressure and jet head remain ideal prescribed laws; the hidden-flow loop reset is nonphysical. The gas enclosure capacity ignores wall/pipe displacement, and jets are illustrative paths, not solved fluid trajectories.';
 finish(root,8);
}

// Brown draws 464 as one hollow cast frame cut in section: a top trough,
// two hollow legs (the right one the water down-pipe, the left one the air
// passage), a hollow foot on claw feet, the bowl hung in the air chamber
// under the trough and the pointed spire of the jet pipe rising through it.
// Water shows inside the hollow parts as horizontal ruled lines. The 3D
// vessels, pipes and water volumes stay in the model (their clearances and
// levels are still tested) but are not drawn; this section is what is seen.
function sectionFountain(root){
 const d=root.userData,b=d.blocks,g=d.geometry;
 const rect=(x0,y0,x1,y1)=>poly([[x0,y0],[x1,y0],[x1,y1],[x0,y1]]);
 const hide=o=>o.traverse(x=>{if(x.isMesh)x.visible=false;});
 for(const o of[b.lowerVessel,b.intermediateVessel,b.topBasin,b.rightDrainOuter,b.leftAirPipe,b.airCore,b.centralRiser,b.nozzle])hide(o);
 // Flows toggled by the playback keep their visibility state; only their
 // 3D volumes stop drawing. The plume gets its own material.
 const sprayMaterial=waterJetMaterial();
 for(const spray of b.fountainSprays)spray.material=sprayMaterial;
 b.jetColumn.material.visible=false;b.rightDrainWater.material.visible=false;
 const back=-.35,cut=0,wall=.07;
 // Solid mass and its hollows (plate coordinates of the reconstruction).
 const tableTop=g.topBasinBottomY+.29,tableFloor=g.topBasinBottomY-.05,chamberTop=3.67,chamberBottom=.84,footTop=.77,footFloor=.02;
 const mass=clip.union(rect(-2.31,3.73,2.31,tableTop),rect(-2.02,footTop,2.02,3.73),
   rect(-2.29,-.05,2.29,footTop),
   // Brown's flared shoulders where the legs meet the foot.
   ...[-1,1].map(sign=>poly(Array.from({length:17},(_,i)=>{const a=Math.PI/2*i/16;return[sign*(2.02+.27*(1-Math.cos(a))),footTop+.27*(1-Math.sin(a))];}).concat([[sign*2.02,footTop]]))));
 const tableHollow=rect(-2.31+wall,tableFloor,2.31-wall,tableTop-wall);
 const rightLeg=rect(1.47,.60,1.95,tableFloor+.05),leftLeg=rect(-1.95,.60,-1.47,3.60);
 const chamber=rect(-1.42,chamberBottom,1.42,chamberTop),port=rect(-1.50,3.40,-1.40,3.55);
 const foot=rect(-2.29+wall,footFloor,2.29-wall,footTop-.07);
 const hollows=clip.union(tableHollow,rightLeg,leftLeg,chamber,port,foot);
 const pipeHalf=.17,pipeBore=.11,spireBase=g.nozzleY+.05,spireTip=spireBase+.26,pipeFoot=2.06;
 const pipeOuter=clip.union(rect(-pipeHalf,pipeFoot,pipeHalf,spireBase),poly([[-pipeHalf,spireBase],[pipeHalf,spireBase],[.012,spireTip],[-.012,spireTip]]));
 const pipeInner=clip.union(rect(-pipeBore,pipeFoot-.01,pipeBore,spireBase),poly([[-pipeBore,spireBase],[pipeBore,spireBase],[.012,spireTip+.01],[-.012,spireTip+.01]]));
 const bowlOuter=[],bowlInner=[];
 for(let i=0;i<=96;i++){const a=Math.PI+Math.PI*i/96;bowlOuter.push([1.24*Math.cos(a),3.2+1.24*Math.sin(a)]);bowlInner.push([1.208*Math.cos(a),3.2+1.208*Math.sin(a)]);}
 const bowlWall=poly([...bowlOuter,...bowlInner.reverse()]);
 const hangers=[-1,1].map(sign=>rect(sign*1.24-.02,3.19,sign*1.24+.02,chamberTop+.01));
 const solid=clip.union(clip.difference(mass,hollows),clip.difference(pipeOuter,pipeInner),bowlWall,...hangers);
 const group=new THREE.Group();group.userData.role='hollow-cast-fountain-frame-in-section';root.add(group);
 const wallMaterial=matte(PALETTE.frame,{roughness:.8}),backMaterial=matte(0xe4dfd3,{roughness:.9});
 const addMesh=(geometry,material,role)=>{const m=new THREE.Mesh(geometry,material);m.userData.role=role;m.userData.presentationOnly=true;group.add(m);return m;};
 addMesh(plate(solid,back,cut),wallMaterial,'section-cut-walls-of-hollow-cast-frame');
 // The far half's inner faces close every hollow, so they read as cavities.
 addMesh(plate(clip.union(mass,pipeOuter),back-.04,back),backMaterial,'far-inner-face-of-hollow-cast-frame');
 const feet=[-1,1].map(sign=>poly(Array.from({length:25},(_,i)=>{const a=Math.PI*i/24;return[sign*2.05+.17*Math.cos(a),-.05-.12*Math.sin(a)];})));
 addMesh(plate(clip.union(...feet),back,cut),wallMaterial,'claw-foot-of-cast-frame');
 // Water in section: translucent bodies filling the cut hollows from the
 // far inner face to the cut plane (Brown rules them; we show the water).
 const waterMaterial=waterVolumeMaterial();
 const levelMaterial=()=>{const m=waterMaterial.clone();m.clippingPlanes=[new THREE.Plane(new THREE.Vector3(0,-1,0),0)];return m;};
 const footMaterial=levelMaterial(),bowlMaterial=levelMaterial();
 const water=(region,y0,y1,material,role)=>{const m=addMesh(plate(clip.intersection(region,rect(-3,y0,3,y1)),back+.002,cut-.002),material,role);m.renderOrder=1;return m;};
 water(clip.difference(tableHollow,pipeOuter),tableFloor,tableTop-wall,waterMaterial,'water-in-top-trough');
 water(rect(1.47,footTop-.07,1.95,tableFloor+.05),footTop-.07,tableFloor+.05,waterMaterial,'water-in-right-hollow-leg');
 water(pipeInner,pipeFoot,spireTip,waterMaterial,'water-in-jet-pipe-and-spire');
 water(foot,footFloor,footTop,footMaterial,'water-in-hollow-foot');
 water(poly([[-1.208,3.2],...bowlInner.slice().reverse().slice(1,-1),[1.208,3.2]]),1.99,3.2,bowlMaterial,'water-in-hung-bowl');
 group.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;for(const m of[].concat(o.material))m.fog=false;}});
 d.localClippingEnabled=true;
 d.sectionFrame={group,spireTipY:spireTip};
 return{spireTipY:spireTip,update(state,opacity){
   footMaterial.clippingPlanes[0].constant=state.lowerWaterSurfaceY;
   bowlMaterial.clippingPlanes[0].constant=state.intermediateWaterSurfaceY;
   sprayMaterial.opacity=Math.min(.5,opacity+.05);
 }};
}

export function correctBalancePumps(root){
 const d=root.userData,b=d.blocks,g=d.geometry;
 replace(b.beamBar,plate(clip.difference(clip.union(rectangle(g.beamHalfLength*2,.14),poly(circle([0,0],.235,64))),poly(circle([0,0],.174,64))),-.12,.12));
 // A split deck lets the beam rock and its links descend between the treads.
 replace(b.platform,horizontalPlate(clip.difference(rectangle(4.25,1.65,0,-.18),rectangle(4.4,.72)),1.50,1.66));b.platform.position.set(0,0,0);
 replace(b.foundation,horizontalPlate(clip.difference(rectangle(7,3.2),...[-1,1].map(side=>poly(circle([side*g.cylinderOffset,0],.12,64)))),-1.52,-1.37));b.foundation.position.set(0,0,0);
 b.attachmentPins.forEach(pin=>replace(pin,new THREE.CylinderGeometry(.072,.072,.72,32)));
 for(const a of b.pumpAssemblies){
   const x=a.side*g.cylinderOffset;
   replace(a.cylinder,portedBarrel(g.cylinderInnerRadius,.30,g.cylinderBottomY,g.cylinderTopY,-1.03,.13,1));a.cylinder.position.set(x,0,0);a.cylinder.rotation.y=-Math.PI/2;
   const link=boredPlanarLinkGeometry({length:g.pitmanLength,width:.09,eyeRadius:.125,boreRadius:.076,depth:.09});link.translate(-g.pitmanLength/2,0,0).rotateZ(Math.PI/2).scale(1,1/g.pitmanLength,1);replace(a.pitman,link);
   replace(a.crosshead,plate(clip.difference(clip.union(rectangle(.16,.22,0,-.11),poly(circle([0,0],.135,64))),poly(circle([0,0],.076,64))),-.10,.10));
   a.jointPin=add(root,new THREE.CylinderGeometry(.072,.072,.65,32),a.pistonRod.material,'actual-crosshead-pitman-pin');a.jointPin.rotation.x=Math.PI/2;
   replace(a.inletPipe,horizontalTurned([[-.115,.070],[-.115,.11],[.115,.11],[.115,.070]]));a.inletPipe.position.y=-1.315;
   replace(a.inletWater,new THREE.CylinderGeometry(.066,.066,.23,24));a.inletWater.position.y=-1.315;
   a.inletSeat=add(root,horizontalRing(.09,g.cylinderInnerRadius,-.05,0),a.inletValve.material,'finite-inlet-check-seat');a.inletSeat.position.set(x,g.cylinderBottomY+.12-.0225,0);
   a.deliverySeat=add(root,horizontalRing(.10,.17,-.05,0),a.deliveryValve.material,'finite-delivery-check-seat');a.deliverySeat.position.set(x,-.6725,.55);
   a.deliveryBody=add(root,horizontalTurned([[-.25,.08],[-.25,.11],[-.18,.205],[.18,.205],[.25,.11],[.25,.08],[.18,.17],[-.18,.17]]),a.cylinder.material,'finite-delivery-check-chamber');a.deliveryBody.position.set(x,-.65,.55);
   const lower=new THREE.CatmullRomCurve3([new THREE.Vector3(x,-1.03,.20),new THREE.Vector3(x,-1.03,.40),new THREE.Vector3(x,-.90,.55)]);
   const upper=new THREE.CatmullRomCurve3([new THREE.Vector3(x,-.40,.55),new THREE.Vector3(x,.20,.55),new THREE.Vector3(a.side*.34,.48,.55),new THREE.Vector3(0,.62,.55)]);
   replace(a.deliveryPipe,mergePassageParts([curvedPipeWall(lower,.08,.11,40),curvedPipeWall(upper,.08,.11,64)]));
   const flow=new THREE.CurvePath();flow.add(lower);flow.add(new THREE.LineCurve3(lower.getPoint(1),upper.getPoint(0)));flow.add(upper);replace(a.deliveryWater,new THREE.TubeGeometry(flow,96,.052,12,false));
   a.cover=add(root,horizontalRing(.056,.30,-.045,.045),a.cylinder.material,'bored-pump-rod-cover');a.cover.position.set(x,g.cylinderTopY,0);
 }
 replace(b.commonOutlet,horizontalTurned([[-.36,.19],[-.36,.23],[-.06,.125],[.36,.125],[.36,.072],[-.06,.072]]));b.commonOutlet.position.z=.55;b.commonOutletWater.position.z=.55;
 d.updateWorkingParts=state=>state.pumps.forEach((s,i)=>{
   const a=b.pumpAssemblies[i];a.pitman.position.z=.25;a.jointPin.position.copy(s.crosshead);a.jointPin.position.z=.10;
   const top=s.crosshead.y-.20,bottom=s.piston.y;a.pistonRod.position.y=(top+bottom)/2;a.pistonRod.scale.y=top-bottom;
   a.deliveryValve.position.set(a.side*g.cylinderOffset,-.65+.075*s.deliveryOpenAmount,.55);
 });
 d.reconstructionNote='Exact beam/pitman slider motion with finite joint bores and separate delivery passages. Check timing, operator forcing and fluid transport remain prescribed; no passive check forces, pressure losses or seal leakage are solved.';
 finish(root,g.cycleDuration);
}

function finish(root,minimum){
 const d=root.userData;d.hideGround=true;d.minimumDisplayCycleSeconds=minimum;
 root.traverse(o=>{for(const m of o.material?[].concat(o.material):[])m.fog=false;});
 const bounds=new THREE.Box3(),p=new THREE.Vector3();
 for(let i=0;i<=32;i++){d.update(d.geometry.cycleDuration*i/32);root.updateMatrixWorld(true);root.traverseVisible(o=>{const a=o.geometry?.attributes.position;if(a)for(let j=0;j<a.count;j++)bounds.expandByPoint(p.fromBufferAttribute(a,j).applyMatrix4(o.matrixWorld));});}
 d.cameraFitBounds=bounds.expandByScalar(.12);d.cameraDirection=new THREE.Vector3(.7,.65,15);d.cameraDistanceScale=1.06;d.cameraFov=12;
}
