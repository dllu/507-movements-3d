import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredEscapementMovement as create} from '../src/simulation/authored-escapements.js';
import {solidSurface,surfaceTriangles} from './helpers/solid-surface.mjs';
import {makeSevenTooth238Branch} from '../src/simulation/seven-tooth-238-contact.js';

const cross=(a,b)=>a.x*b.y-a.y*b.x;
test('238 B uses actual wheel flank normals within the finite pallet corner cone, with matched velocity',()=>{
 const m=create({id:238}),d=m.root.userData,g=d.geometry,w=d.blocks.escapeWheel.userData.body,p=d.workingParts.faces[0],ws=solidSurface(w.geometry),ps=solidSurface(p.geometry),triangles=surfaceTriangles(w.geometry);
 let maxGap=0,maxSelectedFacetGap=0,maxNormalError=0,maxCone=-Infinity,minWheel=Infinity,minPallet=Infinity;
 for(let i=0;i<=512;i++){
  const q=(i>256?3:0)+.1+.23999*(i%257)/256;m.update(q*4);m.root.updateMatrixWorld(true);const s=d.kinematics,c=s.contact,point=new THREE.Vector3(c.point.x,c.point.y,g.wheelPlaneZ),local=point.clone().applyMatrix4(w.matrixWorld.clone().invert());
  maxGap=Math.max(maxGap,ws.distance(local),ps.distance(point.clone().applyMatrix4(p.matrixWorld.clone().invert())));
  let nearest=Infinity,normal;
  for(const triangle of triangles){const n=triangle.getNormal(new THREE.Vector3());if(Math.abs(n.z)>.1)continue;const gap=triangle.closestPointToPoint(local,new THREE.Vector3()).distanceTo(local);n.transformDirection(w.matrixWorld);if(n.dot(new THREE.Vector3(-c.normal.x,-c.normal.y,0))>.99999&&gap<nearest){nearest=gap;normal=n;}}
  maxSelectedFacetGap=Math.max(maxSelectedFacetGap,nearest);
  assert.ok(normal&&nearest<1e-9,`selected reaction must lie on an actual contacting side triangle q=${q} gap=${nearest} edge=${c.actualWheelEdgeIndex}; coincident tip facets admit a normal cone`);
  const f=d.faceAt('B',s.palletAngle),tip=f.tipPoint.clone().addScaledVector(f.normal,-.0005),root=f.rootPoint.clone().addScaledVector(f.normal,-.0005),back=tip.clone().addScaledVector(f.normal,-.06);
  for(const other of[root,back])maxCone=Math.max(maxCone,other.clone().sub(tip).normalize().dot(c.normal));
  const reaction=new THREE.Vector2(-normal.x,-normal.y),wheelMoment=cross(c.point,reaction),palletMoment=-cross(c.point.clone().sub(g.palletPivot),reaction);
  minWheel=Math.min(minWheel,-wheelMoment);minPallet=Math.min(minPallet,palletMoment);
  maxNormalError=Math.max(maxNormalError,Math.abs(c.wheelVelocity.clone().sub(c.palletVelocity).dot(reaction)));
 }
 console.log({maxGap,maxSelectedFacetGap,maxCone,minWheel,minPallet,maxNormalError});
 assert.ok(maxGap<1e-9);assert.ok(maxCone<-.005);// The smaller plate-scaled star (tip radius 1.015, was 1.101) shortens both
 // reaction moment arms (measured 0.608 and 0.454, formerly 0.717 and 0.521).
 assert.ok(minWheel>.58);assert.ok(minPallet>.43);assert.ok(maxNormalError<1e-10);
});
test('238 B corner follows all preserved flank edges and ends at the unchanged tip',()=>{
 const d=create({id:238}).root.userData,g=d.geometry,branch=makeSevenTooth238Branch(d);let previous=-Infinity,maxVelocityError=0;
 for(let i=0;i<=2048;i++){const a=THREE.MathUtils.lerp(g.lowPalletAngle,branch.releaseAngle,i/2048),c=branch.at(a);assert.ok(c.angle>=previous-1e-12);assert.ok(c.ratio>0);previous=c.angle;
  if(i>0&&i<2048){const h=1e-8,left=branch.at(a-h),right=branch.at(a+h);if(left.edgeIndex===right.edgeIndex)maxVelocityError=Math.max(maxVelocityError,Math.abs((right.angle-left.angle)/(2*h)-c.ratio));}}
 assert.ok(maxVelocityError<1e-6);// The cleaned contour stores the tip in Float32, which can round it up by ~2e-8.
 assert.ok(branch.release.point.length()-g.contactRadius<1e-7);assert.ok(branch.release.point.distanceTo(branch.release.wheelPoint.clone().rotateAround(new THREE.Vector2(),branch.release.angle))<1e-12);
 assert.ok(branch.releaseAngle<g.highPalletAngle);assert.ok(g.highPalletAngle-branch.releaseAngle<.0001);/* 7.1e-5 rad (0.004°) with the plate-scaled star; was 4.9e-5 */assert.ok(Number.isInteger(branch.release.edgeIndex));
 assert.equal(d.workingParts.profile.outline.length,1078);assert.equal(d.bContactBranch.profileUnchanged,true);console.log({initialWheel:branch.initial.angle,releaseWheel:branch.release.angle,releasePallet:branch.releaseAngle,maxVelocityError});
});
test('238 lock resists attempted advance and both scheduled drops join continuously over repeated turns',()=>{
 const m=create({id:238}),d=m.root.userData,g=d.geometry,w=d.blocks.escapeWheel.userData.body,solid=solidSurface(w.geometry);
 for(const q of[.05,.15,.22,.30]){m.update(q*4);m.root.updateMatrixWorld(true);const c=d.kinematics.contact,point=new THREE.Vector3(c.point.x,c.point.y,g.wheelPlaneZ);d.blocks.escapeWheel.userData.rotor.rotation.z+=.0001;m.root.updateMatrixWorld(true);assert.ok(solid.signedDistance(point.applyMatrix4(w.matrixWorld.clone().invert()),.01)<-1e-5,'finite corner must block a wheel advance');}
 for(let turn=-1;turn<9;turn++)for(const boundary of[0,.1,.34,.4,.58,.82,.88,1]){const a=d.stateAtCycleCoordinate(turn+boundary-1e-7),b=d.stateAtCycleCoordinate(turn+boundary+1e-7);assert.ok(Math.abs(a.wheelAngle-b.wheelAngle)<1e-6);assert.ok(Math.abs(a.palletAngle-b.palletAngle)<1e-6);assert.ok(Math.abs(a.wheelAngularSpeed-b.wheelAngularSpeed)<1e-6);assert.ok(Math.abs(a.palletAngularSpeed-b.palletAngularSpeed)<1e-6);}
 for(let i=0;i<=64;i++){const q=i/64;m.update(q*4);const s=d.stateAtCycleCoordinate(q);assert.equal(d.blocks.escapeWheel.userData.rotor.rotation.z,s.wheelAngle);assert.equal(d.blocks.palletCarrier.rotation.z,s.palletAngle);assert.ok(Math.abs(d.stateAtCycleCoordinate(q+7).wheelAngle-s.wheelAngle-2*Math.PI)<1e-12);}
 assert.equal(d.dynamics.forceValidated,false);assert.equal(d.contactQualification.completeTransmissionValidated,false);assert.match(d.reconstructionNote,/impacts/);assert.match(d.reconstructionNote,/not simulated/);
});
