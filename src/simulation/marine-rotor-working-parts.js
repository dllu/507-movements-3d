import * as THREE from 'three';
import {ring} from './finite-plate-geometry.js';
import {horizontalRing} from './horizontal-turbine-solids.js';
import {finiteSurfaceShell} from './finite-surface-shell.js';
import {fitPistonGuide} from './piston-guide-parts.js';
const replace=(o,g)=>{o.geometry.dispose();o.geometry=g;};

export function correctMarineRotor(root,id){
 const d=root.userData,b=d.blocks,g=d.geometry;
 if(id===487){
  for(const rim of b.rims)replace(rim,ring(g.rimInnerRadiusSceneUnit,g.rimOuterRadiusSceneUnit,-.08,.08,128));
  replace(b.hub,horizontalRing(.204,g.hubRadiusSceneUnit,-.79,.79));
  for(const bearing of b.bearings)replace(bearing,ring(.204,.365,-.11,.11,96));
  for(const a of b.spokeAssemblies)for(const spoke of a.spokes){
   const low=g.hubRadiusSceneUnit-.025,high=g.paddleInnerRadiusSceneUnit+.12;
   replace(spoke,new THREE.BoxGeometry(high-low,.105,.105));spoke.position.x=(low+high)/2;
  }
  for(let i=0;i<2;i++){const z=-1.15-.55*i;b.bearings[i].position.z=z;b.baseRails[i].position.z=z;for(const leg of b.supportLegs.slice(i*2,i*2+2))leg.position.z=z;}
  b.shaftIndex.position.z=.825;
  d.minimumDisplayCycleSeconds=4;
  d.reconstructionNote='The official animation supplies one rigid eight-paddle rotation at15 rpm. Finite annular rims, attached spokes and bored journals retain that topology. The water and wake are schematic; prescribed speed and representative flat-plate drag do not validate loaded hydrodynamic behavior.';
 }else{
  const original=b.bladeAssemblies[0].blade.geometry,solid=finiteSurfaceShell(original,.045);
  original.dispose();for(const a of b.bladeAssemblies){a.blade.geometry=solid;a.perimeter.forEach(o=>o.visible=false);a.blade.material.transparent=false;a.blade.material.opacity=1;a.blade.material.depthWrite=true;}
  replace(b.hub,horizontalRing(.184,.43,-.54,.54));
  // Brown's hub has a collar on the shaft side, and beyond it the shaft
  // steps down to a plain end nut; the shaft ends cleanly at the nut.
  b.nose.visible=false;
  replace(b.shaft,new THREE.CylinderGeometry(.18,.18,3.84,40));b.shaft.position.x=-.28;
  b.hubFittings=[[.184,.56,-.86,-.54,'hub-collar-on-shaft-side'],[.184,.27,.54,1.11,'stepped-shaft-sleeve-beyond-hub'],[0,.31,1.64,1.84,'propeller-shaft-end-nut']].map(([inner,outer,low,high,role])=>{
   const part=new THREE.Mesh(inner?horizontalRing(inner,outer,low,high,96):new THREE.CylinderGeometry(outer,outer,high-low,48).translate(0,(low+high)/2,0),b.hub.material);
   part.rotation.z=-Math.PI/2;part.userData.role=role;b.rotor.add(part);return part;
  });
  for(const bearing of b.bearings)replace(bearing,ring(.184,.365,-.11,.11,96));
  b.waterVolume.visible=false;
  b.base.position.y=-2.56;
  for(const p of b.pedestals){replace(p,new THREE.BoxGeometry(.48,2.41,.62));p.position.y=-1.265;}
  d.minimumDisplayCycleSeconds=4;
  d.reconstructionNote='Closed finite blades retain the exact constant-lead helicoid as their mid-surface. Their display thickness is reconstructed. Bored shaft journals and a lowered support base clear the full rotation. Four-second viewing period slows the representative90rpm law; no CFD, cavitation, structural or loaded propulsion validation is implied.';
 }
 fitPistonGuide(root,d.update,g.cycleDuration);
 // 488: Brown looks at the screw almost square to the shaft, a little from the
 // left and above (he shows the left collar's face), so both blades show the
 // same breadth of face.
 d.cameraDirection=id===487?new THREE.Vector3(.7,.7,15):new THREE.Vector3(-1.6,1.4,15);
 if(id===488){
  const bounds=new THREE.Box3(),point=new THREE.Vector3();
  for(let i=0;i<=64;i++){d.update(g.cycleDuration*i/64);root.updateMatrixWorld(true);root.traverseVisible(o=>{const p=o.geometry?.attributes.position;if(p)for(let j=0;j<p.count;j++)bounds.expandByPoint(point.fromBufferAttribute(p,j).applyMatrix4(o.matrixWorld));});}
  d.cameraFitBounds=bounds.expandByScalar(.08);d.update(0);
 }
 d.cameraFov=12;d.cameraDistanceScale=1.02;
}
