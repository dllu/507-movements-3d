import * as THREE from 'three';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import {bevelBodyGeometry} from './bevel-geometry.js';
import {plate,poly,circle,polygonClipping as clip} from './finite-plate-geometry.js';
import {planetary505Parameters as rack,planetary505Profiles as profiles} from '../data/planetary-505-profiles.js';

function replaceGeometry(mesh,geometry){mesh.geometry.dispose();mesh.geometry=geometry;}
export function boredCylinder(mesh,boreRadius){
 const p=mesh.geometry.parameters;
 replaceGeometry(mesh,boredLatheGeometry([{radial:Math.max(p.radiusBottom,boreRadius+.035),axial:-p.height/2},{radial:Math.max(p.radiusTop,boreRadius+.035),axial:p.height/2}],boreRadius,64));
 mesh.userData.boreRadius=boreRadius;
}
export function boreSpur(gear,boreRadius,generated=false){
 const rotor=gear.userData.rotor,body=rotor.children[0],p=body.geometry.parameters;
 let shape,options;
 if(generated){const teeth=gear.userData.teeth,radii=profiles[teeth],points=[];
  for(let tooth=0;tooth<teeth;tooth++)for(let i=0;i<radii.length;i++){const a=(tooth+i/radii.length-.5)*2*Math.PI/teeth;points.push(new THREE.Vector2(radii[i]*Math.cos(a),radii[i]*Math.sin(a)));}
  shape=new THREE.Shape(points);options={depth:.32,bevelEnabled:false,curveSegments:48};
  gear.userData.toothProfile='offline-rounded-rack-generated-involute';
  Object.assign(gear.userData,{pressureAngle:rack.pressureAngle,rootRadius:Math.min(...radii),outerRadius:Math.max(...radii),addendum:rack.module*rack.addendum,dedendum:rack.module*rack.dedendum,toothHeight:rack.module*(rack.addendum+rack.dedendum)});
 }else{shape=p.shapes.clone();options={...p.options,curveSegments:32};}
 const hole=new THREE.Path();hole.absarc(0,0,boreRadius,0,2*Math.PI,true);shape.holes.push(hole);
 replaceGeometry(body,new THREE.ExtrudeGeometry(shape,options).translate(0,0,-options.depth/2));
 body.userData.boreRadius=boreRadius;boredCylinder(rotor.children[1],boreRadius);
 const indicator=rotor.children[3],end=gear.userData.radius*.72;
 const start=Math.max(gear.userData.radius*.19,boreRadius+.035)+.015;
 replaceGeometry(indicator,new THREE.BoxGeometry(end-start,indicator.geometry.parameters.height,.024));
 indicator.position.x=(start+end)/2;
}
function boreBevel(gear,boreRadius,depth){
 const rotor=gear.userData.rotor,body=rotor.children[0],tooth=gear.userData.toothMeshes[0].geometry;
 replaceGeometry(body,bevelBodyGeometry(tooth,boreRadius).rotateX(Math.PI).translate(0,0,1.5*depth));
 body.userData.boreRadius=boreRadius;
 const hub=rotor.children.find(m=>m.geometry?.type==='CylinderGeometry');boredCylinder(hub,boreRadius);
}
function arm(mesh,rectangle,eyes,bores,low,high,axis='z'){
 const outside=clip.union(poly(rectangle),...eyes.map(([x,y,r])=>poly(circle([x,y],r,64))));
 const geometry=plate(clip.difference(outside,...bores.map(([x,y,r])=>poly(circle([x,y],r,64)))),low,high);
 if(axis==='y')geometry.rotateX(Math.PI/2);
 replaceGeometry(mesh,geometry);mesh.position.set(0,0,0);
}
function spindle(parent,x,y,z,r,length,axis,material){
 const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,length,48),material);
 if(axis==='z')mesh.rotation.x=Math.PI/2;mesh.position.set(x,y,z);mesh.userData.role='reconstructed-carrier-journal';parent.add(mesh);return mesh;
}

// Source-faithful presentation and real bores for the four related epicyclic
// reconstructions. Analytic ratios stay in their authored movement factories.
export function correctEpicyclicFamily(root,id){
 const b=root.userData.blocks,g=root.userData.geometry;
 root.userData.hideGround=true;
 const remove=id===502?['supportBase','supportPost','supportHead','fixedLock']:id===503?['supportBase','rearPost','bearingArms','bearings']:id===504?['supportBase']:['supportBase','rearPost','fixedRingClamps'];
 for(const name of remove)for(const object of(Array.isArray(b[name])?b[name]:[b[name]])){object?.removeFromParent();object?.traverse(o=>o.geometry?.dispose());}
 for(const marker of b.contactMarkers)marker.visible=false;
 for(const label of Object.values(b.labels)){label.visible=false;label.removeFromParent();label.traverse(o=>o.geometry?.dispose());}
 if(id===502){
  for(const[gear,bore]of[[b.fixedSunA,.131],[b.outputD,.131],[b.compoundE,.161],[b.compoundF,.161],[b.outputB,.091]])boreSpur(gear,bore);
  arm(b.carrierBar,[[-.12,-.11],[.12,-.11],[.12,g.outerOutputCenterRadius+.22],[-.12,g.outerOutputCenterRadius+.22]],[[0,0,.23],[0,g.compoundCenterRadius,.22],[0,g.outerOutputCenterRadius,.20]],[[0,0,.131],[0,g.compoundCenterRadius,.091],[0,g.outerOutputCenterRadius,.091]],g.carrierPlaneZ-.08,g.carrierPlaneZ+.08);
  boredCylinder(b.carrierPivots[0],.131);boredCylinder(b.compoundSleeve,.091);
  spindle(b.carrierC,0,g.compoundCenterRadius,.06,.09,1.1,'z',b.compoundSleeve.material);
  spindle(b.carrierC,0,g.outerOutputCenterRadius,.36,.09,.64,'z',b.compoundSleeve.material);
  // Brown draws the carrier upright (B over F over A/D). The view frames that
  // pose whole and centred, plus the inner orbit (A, D and F) to 2.6 about A;
  // B and the arm's outer end leave the frame briefly as the carrier points
  // down. The white speed index is not drawn.
  // Actual swept surfaces reach +/-3.753.
  root.userData.sweptBounds=new THREE.Box3(new THREE.Vector3(-3.77,-3.77,-.76),new THREE.Vector3(3.77,3.77,.83));
  root.userData.cameraFitBounds=new THREE.Box3(new THREE.Vector3(-2.6,-2.6,-.76),new THREE.Vector3(2.6,3.77,.83));
  b.carrierIndex.visible=false;
 }else if(id===503){
  for(const gear of[b.lowerC,b.upperD])boreBevel(gear,.116,g.bevelDepth);boreBevel(b.planetB,.106,g.bevelDepth);
  replaceGeometry(b.carrierShaftA,new THREE.CylinderGeometry(.115,.115,3.30,48));
  b.shaftAIndex.position.set(.10,1.58,0);b.shaftAIndex.scale.x=.28;
  root.userData.cameraFitBounds=new THREE.Box3(new THREE.Vector3(-2.25,-1.68,-2.25),new THREE.Vector3(2.25,1.68,2.25));
 }else if(id===504){
  boreSpur(b.fixedA,.121);for(const gear of b.intermediateRows)boreSpur(gear,.151);for(const gear of Object.values(b.outputs))boreSpur(gear,.131);
  replaceGeometry(b.stationaryStud,new THREE.CylinderGeometry(.12,.12,1.23,48));b.stationaryStud.position.y=-.935;
  replaceGeometry(b.supportPedestal,boredLatheGeometry([{axial:-.63,radial:.65},{axial:-.48,radial:.65},{axial:-.38,radial:.28},{axial:-.03,radial:.28}],.121,64));
  for(const [label,index] of Object.entries(b.outputIndices)){const end=b.outputs[label].userData.radius*.84,start=.185;replaceGeometry(index,new THREE.BoxGeometry(end-start,.028,.025));index.position.x=(start+end)/2;}
  boredCylinder(b.intermediateSleeve,.091);
  // Brown's arm supports the wheels from below.
  for(const part of[b.carrierHandle,b.carrierIndex,...b.carrierPivots])part.position.y-=1.68;
  arm(b.carrierBar,[[-.12,-.135],[3.6,-.135],[3.6,.135],[-.12,.135]],[[0,0,.22],[g.carrierPinSpacing,0,.22],[2*g.carrierPinSpacing,0,.26]],[[0,0,.121],[g.carrierPinSpacing,0,.091],[2*g.carrierPinSpacing,0,.131]],-.085,.085,'y');b.carrierBar.position.y=-.84;
  boredCylinder(b.carrierPivots[0],.121);
  spindle(b.carrierCD,g.carrierPinSpacing,-.21,0,.09,1.78,'y',b.intermediateSleeve.material);
  replaceGeometry(b.outputPin,new THREE.CylinderGeometry(.13,.13,1.85,48));b.outputPin.position.y=-.20;
  g.carrierPlaneY=-.84;
  root.userData.cameraFitBounds=new THREE.Box3(new THREE.Vector3(-4.22,-1.72,-4.22),new THREE.Vector3(4.22,1.42,4.22));
 }else if(id===505){
  boreSpur(b.sunA,.161,true);boreSpur(b.planetB,.091,true);boredCylinder(b.sunOutputShaft,.131);boredCylinder(b.carrierPivots[0],.161);
  replaceGeometry(b.sunOutputIndex,new THREE.BoxGeometry(.43,.07,.024));b.sunOutputIndex.position.set(.425,0,.18);
  arm(b.carrierBar,[[-.32,-.11],[2.84,-.11],[2.84,.11],[-.32,.11]],[[0,0,.23],[g.planetCenterRadius,0,.19]],[[0,0,.161],[g.planetCenterRadius,0,.091]],.45,.61);
  spindle(b.carrierD,g.planetCenterRadius,0,.23,.09,.92,'z',b.centralStud.material);
  root.userData.cameraFitBounds=new THREE.Box3(new THREE.Vector3(-3.25,-3.25,-.72),new THREE.Vector3(3.25,3.25,1.04));
  root.userData.generatedGearParameters={...rack};
  g.toothHeight=rack.module*(rack.addendum+rack.dedendum);
 }
 root.traverse(o=>{for(const material of(Array.isArray(o.material)?o.material:[o.material]))if(material)material.fog=false;});
 // Fit the full orbit explicitly; a wide-angle sphere fit made the initial
 // source views unnecessarily small, especially the shallow 504 gear stack.
 if(id!==505){
  root.userData.cameraFov=12;
  const bounds=root.userData.sweptBounds??root.userData.cameraFitBounds;
  root.userData.sampledMotionBounds={min:bounds.min.toArray(),max:bounds.max.toArray()};
 }
 root.userData.cameraDistanceScale=1;
 root.userData.familyReview={workingMotion:'analytic',ground:false,shaftBores:true,sourceSupports:'unsupported invented frames omitted',contactQualification:'See docs/validation/502-505-gear-solids.json; sampled gear-body contacts only.'};
}
