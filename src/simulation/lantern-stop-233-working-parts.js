import * as THREE from 'three';
import { plate, circle, ring } from './finite-plate-geometry.js';
import { boredPlanarLinkGeometry } from './bored-planar-link.js';
const replace = (mesh, geometry) => { mesh.geometry.dispose(); mesh.geometry = geometry; };
export function installLanternStop233(root, latchShape, update) {
  const d=root.userData,b=d.blocks,g=d.geometry,rotor=b.rollerWheel.userData.rotor;
  // The working edge is the actual analytical trundle envelope. A bevel must
  // not inflate it toward the cylinder it is meant to contact.
  const outline=latchShape.getPoints(18).map((p,i)=>{
    if(i<g.latchFacePoints.length)p=p.clone().addScaledVector(d.latchEnvelopeAtProgress(i/(g.latchFacePoints.length-1)).localNormal,.000015);
    return p.toArray();
  });
  replace(b.latchBody, plate([[outline,circle([0,0],.099,64)]],-.08,.08));
  const [disk,rim]=rotor.children;
  replace(disk,ring(.099,g.rollerRadius,-.09,.09,192));disk.rotation.x=0;
  replace(rim,new THREE.TorusGeometry(.37,.025,8,96));rim.position.z=.086;
  b.rollerWitness.position.z=.094;
  // The arm is on the front of the freely turning roller, with a real spindle
  // through separate bores instead of the old coplanar arm/disk overlap.
  const armMaterial=b.rollerArm.children.find(o=>o.isMesh).material;
  for(const child of [...b.rollerArm.children]){child.geometry?.dispose();b.rollerArm.remove(child);}
  const armPlate=new THREE.Mesh(boredPlanarLinkGeometry({length:g.rollerArmLength,width:.18,eyeRadius:.14,boreRadius:.099,depth:.15}),armMaterial);
  armPlate.position.set(0,0,.82);armPlate.rotation.z=g.rollerRestArmAngle;b.rollerArm.add(armPlate);
  const material=disk.material;
  const spindle=new THREE.Mesh(new THREE.CylinderGeometry(.095,.095,.48,64).rotateX(Math.PI/2),material);
  spindle.position.set(g.rollerArmLocal.x,g.rollerArmLocal.y,.73);spindle.userData.role='roller-spindle-in-separate-arm-and-disk-bores';b.rollerStop.add(spindle);
  for(const pin of [b.rollerPivotPin,b.latchPivotPin]) {
    replace(pin.userData.rotor.children[0],new THREE.CylinderGeometry(.095,.095,1.60,64));
    pin.position.z=.17;pin.userData.length=1.60;
  }
  const wheelRotor=b.wheel.userData.rotor;
  for(const mesh of wheelRotor.children)if(mesh.isMesh&&mesh.geometry.type==='CylinderGeometry'&&!mesh.userData.lanternTrundle){
    const p=mesh.geometry.parameters;
    replace(mesh,ring(.134,p.radiusTop,-p.height/2,p.height/2,128));mesh.rotation.x=0;
  }
  b.wheelIndicator.position.z=.298;
  const trundles=b.wheel.userData.trundles;
  for(const pin of trundles)replace(pin,new THREE.CylinderGeometry(g.trundleRadius,g.trundleRadius,.92,128));
  d.lanternStop233Parts={disk,rim,spindle,armPlate,latchRunningClearance:.000015};
  d.minimumDisplayCycleSeconds=g.cyclePeriod;d.hideGround=true;d.cameraFov=8;
  d.reconstructionNote='The roller and latch are alternative stops, demonstrated separately with prescribed withdrawal and opposite wheel strokes. Their finite working faces follow the trundles; gravity or spring bias, holding force, friction and impacts are not dynamically solved. The official page has no registered animation.';
  root.traverse(o=>{for(const m of [].concat(o.material??[]))m.fog=false;});
  const bounds=new THREE.Box3(),point=new THREE.Vector3();
  for(let i=0;i<=32;i++){update(g.cyclePeriod*i/32);root.updateMatrixWorld(true);root.traverseVisible(o=>{const p=o.geometry?.attributes.position;if(p)for(let j=0;j<p.count;j++)bounds.expandByPoint(point.fromBufferAttribute(p,j).applyMatrix4(o.matrixWorld));});}
  d.cameraFitBounds=bounds.expandByScalar(.04);update(0);
}
