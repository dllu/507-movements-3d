import * as THREE from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { boredLatheGeometry } from './bored-lathe-geometry.js';
import { finiteSurfaceShell } from './finite-surface-shell.js';
import { plate, poly, circle, polygonClipping } from './finite-plate-geometry.js';
import capData from './generated/windmill-cap.js';

const tube=(r,b,h)=>boredLatheGeometry([{radial:r,axial:-h/2},{radial:r,axial:h/2}],b,64);
const replace=(mesh,geometry)=>{mesh.geometry.dispose();mesh.geometry=geometry;};
const rect=(x0,y0,x1,y1)=>poly([[x0,y0],[x1,y0],[x1,y1],[x0,y1]]);
function boredBlock(x0,y0,x1,y1,r,depth,center=[0,0]) {
  return plate(polygonClipping.difference(rect(x0,y0,x1,y1),poly(circle(center,r,64))),-depth/2,depth/2);
}
function add(parent,geometry,material,role,position=new THREE.Vector3()) {
  const mesh=new THREE.Mesh(geometry,material);mesh.position.copy(position);mesh.userData.role=role;parent.add(mesh);return mesh;
}
export function correctWindRotorWorkingParts(root,id) {
 const b=root.userData.blocks,p={};
 if(id===484) {
  replace(b.helicalBlade,finiteSurfaceShell(b.helicalBlade.geometry,0.035));
  replace(b.coreCylinder,tube(.58,.132,4));
  for(const collar of b.endCollars)replace(collar,tube(.70,.132,.13));
  replace(b.loadWheel.children[0],tube(.58,.132,.16));
  b.bearings.forEach((bearing,i)=>{
   replace(bearing,tube(.245,.134,.18));bearing.rotation.set(0,0,Math.PI/2);
   const {shoulder,upright}=b.supports[i];
   replace(shoulder,boredBlock(-.41,-.15,.41,.15,.138,.52,[0,.18]));shoulder.rotation.y=Math.PI/2;
   replace(upright,new THREE.BoxGeometry(.34,1.88,.64));upright.position.y=-.85;
  });
  b.base.visible=false;
  root.userData.cameraDirection=new THREE.Vector3(.6,1.4,15);
  root.userData.minimumDisplayCycleSeconds=6;
 } else if(id===485) {
  for(const {panel}of b.sails)replace(panel,finiteSurfaceShell(panel.geometry,.02));
  const cap=new THREE.BufferGeometry();cap.setAttribute('position',new THREE.Float32BufferAttribute(capData.positions,3));cap.setIndex(capData.indices);
  replace(b.dome,toCreasedNormals(cap,Math.PI/5));cap.dispose();
  p.bearingSupports=[];
  for(const bearing of b.bearings) {
   replace(bearing,tube(.215,.119,.12));bearing.rotation.x=Math.PI/2;
   p.bearingSupports.push(add(root,boredBlock(-.25,-.34,.25,.22,.122,.16),b.tower.material,
    'windshaft-bearing-pedestal',bearing.position));
  }
  replace(b.hub,tube(.27,.117,.36));
  root.userData.cameraDirection=new THREE.Vector3(7.6,3.2,13);
  root.userData.minimumDisplayCycleSeconds=3;
 } else {
  b.base.visible=false;
  // The bearing seats on the cross supports' top face (y -.30) instead of
  // running .025 down into their bore, which it shared (a coincident wall).
  replace(b.lowerBearing,tube(.28,.134,.125));b.lowerBearing.rotation.x=0;b.lowerBearing.position.y=-.2375;
  for(const support of b.supportCross)replace(support,boredBlock(-.80,-.10,.80,.10,.134,.14).rotateX(Math.PI/2));
  replace(b.hub,tube(.43,.134,.31));
  // The boss stands on the hub's top face (y .155) rather than sinking into
  // the hub's bore, which it shared; its top stays at .36.
  replace(b.squareShaftBoss,boredBlock(-.20,-.20,.20,.20,.134,.205).rotateX(Math.PI/2));b.squareShaftBoss.position.y=.2575;
  replace(b.loadFlywheel,tube(.62,.134,.13));
  p.armHub=add(b.rotor,tube(.23,.134,.44),b.hub.material,'lower-arm-root-hub',new THREE.Vector3(0,-.35,0));
  p.sleeves=[];
  for(const assembly of b.armAssemblies) {
   const {arm,armAssembly,hinge,hingePin,panel,topRail,bottomRail}=assembly;
   arm.position.y=-.52;
   hinge.remove(hingePin);armAssembly.add(hingePin);hingePin.position.x=hinge.position.x;
   replace(panel,plate([ ...rect(-.64,-.36,-.125,.36), ...rect(.125,-.36,.64,.36)],-.0325,.0325));
   for(const rail of[topRail,bottomRail])replace(rail,plate([...rect(-.665,-.0225,-.125,.0225),...rect(.125,-.0225,.665,.0225)],-.0425,.0425));
   p.sleeves.push(add(hinge,tube(.145,.105,.82),hingePin.material,'bored-sail-hinge-sleeve'));
  }
  for(const marker of b.sailFaceMarkers)marker.position.x=.24;
  // The source circle is a plan reference, not an additional contact track.
  replace(b.sweepRing,new THREE.TorusGeometry(1.72,.025,8,96));
  root.userData.geometry.sweepRadiusSceneUnit=1.72;
  b.sweepRing.userData.nonMechanicalReference=true;
  root.userData.cameraDirection=new THREE.Vector3(.01,15,.35);
  root.userData.minimumDisplayCycleSeconds=4;
 }
 root.userData.windRotorWorkingParts=p;
 root.userData.cameraDistanceScale=1;
 root.userData.hideGround=true;
 root.userData.reconstructionNote=id===486
  ? 'Sail timing follows the official animation, with a smooth delayed flip. Sail hinges and rotor motion are prescribed; aerodynamic loads, passive flipping, stop impacts and flywheel speed regulation are not dynamically validated.'
  : 'Rotation and wind or water loading are illustrative prescribed operating points. The visible blades and shaft connections are reconstructed; aerodynamic or hydrodynamic performance and passive speed regulation are not dynamically validated.';
 root.traverse(o=>{for(const material of [].concat(o.material??[]))material.fog=false;});
}
