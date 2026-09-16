import * as THREE from 'three';
import profiles from './chain-drive-profiles.js';
import {plate,ring} from './finite-plate-geometry.js';
const replace=(mesh,geometry)=>{mesh.geometry.dispose();mesh.geometry=geometry;};
export function correctChainDrive(model,id){
 const {root}=model,d=root.userData,b=d.blocks,g=d.geometry;
 const wheel=id===227?b.sprocket:id===229?b.wheel:null;
 const originalWheelPolygons=wheel?[wheel.geometry.parameters.shapes.extractPoints(64).shape.map(p=>p.toArray())]:null;
 d.chainDriveParts={originalWheelPolygons};
 if(profiles[id]){
  if(wheel)replace(wheel,plate(profiles[id],-(g.sprocketDepth??g.wheelDepth)/2,(g.sprocketDepth??g.wheelDepth)/2));
  else {const geometry=plate(profiles[id],-g.toothDepth/2,g.toothDepth/2);for(const tooth of b.teeth)replace(tooth,geometry);}
 }
 if(id===228){
  replace(b.disk,ring(g.shaftRadius+.003,g.diskRadius,-g.diskDepth/2,g.diskDepth/2,96));b.disk.rotation.set(0,0,0);
  replace(b.hub,ring(g.shaftRadius+.003,g.hubRadius,-g.hubDepth/2,g.hubDepth/2,64));b.hub.rotation.set(0,0,0);
 }
 if(id!==228)replace(b.hub,ring(g.shaftHoleRadius*(id===227?.72:.68)+.003,g.hubOuterRadius,-(g.hubDepth??.34)/2,(g.hubDepth??.34)/2,64));
 b.cameraEnvelope.visible=false;
 const bounds={227:[[-2.7,-4.7,-.74],[2.7,3.1,.74]],228:[[-2.65,-4.75,-.89],[2.65,3.35,.89]],229:[[-4.35,-6.8,-.64],[4.75,3.35,.64]]}[id];
 d.cameraFitBounds=new THREE.Box3(new THREE.Vector3(...bounds[0]),new THREE.Vector3(...bounds[1]));
 d.cameraFov=8;d.cameraDistanceScale=1;
 d.hideGround=true;d.minimumDisplayCycleSeconds=4;
 d.reconstructionNote='Rigid chain links follow a prescribed, continuous chordal path with exact pitch. Working pulley profiles have finite clearance for entry and exit. Tension, load sharing, backlash take-up and elastic chain dynamics are not solved.';
 root.traverse(o=>{for(const m of [].concat(o.material??[]))m.fog=false;});
 model.cameraDirection=new THREE.Vector3(id===228?5.4:.9,id===228?3.3:.6,id===228?10.8:14);
}
