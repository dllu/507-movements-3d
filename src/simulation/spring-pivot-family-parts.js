import * as THREE from 'three';
import { boredLatheGeometry } from './bored-lathe-geometry.js';
import { boredCylinderGeometry } from './piston-guide-parts.js';
import { circle, poly, plate, polygonClipping } from './finite-plate-geometry.js';

export function boreBoxAtLocalPoint(mesh, center, radius) {
  const { width, height, depth } = mesh.geometry.parameters;
  mesh.geometry.dispose();
  mesh.geometry = plate(polygonClipping.difference(
    poly([[-width/2,-height/2],[width/2,-height/2],[width/2,height/2],[-width/2,height/2]]),
    poly(circle(center, radius, 64))), -depth/2, depth/2);
}
export function boreZCylinder(mesh, radius, bore, length) {
  mesh.geometry.dispose();
  mesh.geometry = boredCylinderGeometry(radius, bore, length);
}
export function addZJournal(parent, radius, bore, length, material, position, role) {
  const mesh = new THREE.Mesh(boredCylinderGeometry(radius,bore,length), material);
  mesh.rotation.x = Math.PI/2;
  mesh.position.copy(position); mesh.userData.role = role; parent.add(mesh); return mesh;
}
export function finishSpringFamily(root, cycle) {
  root.userData.hideGround = true;
  root.userData.minimumDisplayCycleSeconds = cycle;
  root.traverse(o => { for(const material of [].concat(o.material ?? [])) material.fog = false; });
}
// Distance to the actual rotated circular lip's tube, rather than a projected X line.
export function bellLipSphereGap(center, bellPivot, bellAngle, height, radius, tube, sphere) {
  const q = center.clone().sub(bellPivot).applyAxisAngle(new THREE.Vector3(0,0,1), -bellAngle);
  q.y += height;
  return Math.hypot(Math.hypot(q.x,q.z)-radius,q.y)-tube-sphere;
}

export function finiteSawSheave(material) {
  const root = new THREE.Group(), rotor = new THREE.Group();
  root.add(rotor); root.userData.rotor = rotor;
  const profile = [{axial:-.10,radial:.33},{axial:-.04,radial:.33},{axial:-.0253,radial:.30}];
  for(let i=1;i<32;i++){const a=Math.PI*i/32;profile.push({axial:-.0253*Math.cos(a),radial:.30-.0253*Math.sin(a)});}
  profile.push({axial:.0253,radial:.30},{axial:.04,radial:.33},{axial:.10,radial:.33});
  const rim = new THREE.Mesh(boredLatheGeometry(profile,.235,96),material);rim.rotation.x=Math.PI/2;rotor.add(rim);
  const hub=addZJournal(rotor,.078,.038,.25,material,new THREE.Vector3(),'bored-counterweight-sheave-hub');
  for(let i=0;i<4;i++){const a=i*Math.PI/2,spoke=new THREE.Mesh(new THREE.BoxGeometry(.185,.03,.11),material);spoke.position.set(.16*Math.cos(a),.16*Math.sin(a),0);spoke.rotation.z=a;rotor.add(spoke);}
  root.userData.rim=rim;root.userData.hub=hub;return root;
}

// An expanding planar curl, followed by a smoothly bending terminal leaf.
// Geometry buffers are reused; the deformation is prescribed, not an elastic solve.
export function makePlanarCurledSpring(material) {
  const spiralSteps=128, tailSteps=48, count=spiralSteps+tailSteps+1;
  const geometry=new THREE.BufferGeometry();
  const positions=new Float32Array(count*12),indices=[];
  for(let i=0;i<count-1;i++)for(let side=0;side<4;side++){
    const a=i*4+side,b=i*4+(side+1)%4,c=b+4,d=a+4;indices.push(a,b,d,b,c,d);
  }
  indices.push(0,3,1,1,3,2);const last=(count-1)*4;indices.push(last,last+1,last+3,last+1,last+2,last+3);
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
  geometry.setIndex(indices);
  geometry.userData.deforming=true;
  const mesh=new THREE.Mesh(geometry,material),points=[];
  mesh.userData.role='preloaded-planar-curled-spring-A';
  mesh.userData.reconstruction='source-scale planar curled leaf; prescribed terminal bending, ideal axial force readout';
  const initial=-Math.PI/2,final=-4*Math.PI+.55;
  for(let i=0;i<=spiralSteps;i++){
    const u=i/spiralSteps,a=initial+(final-initial)*u,r=.17+.68*u;
    points.push(new THREE.Vector2(r*Math.cos(a)+.05*u,r*Math.sin(a)+.25*u));
  }
  const join=points.at(-1),previous=points.at(-2),direction=join.clone().sub(previous).normalize();
  for(let i=0;i<tailSteps;i++)points.push(new THREE.Vector2());
  mesh.userData.setEndpoints=(start,end)=>{
    mesh.position.copy(start);
    const target=new THREE.Vector2(end.x-start.x-.17,end.y-start.y);
    const c1=join.clone().addScaledVector(direction,.18),c2=target.clone().add(new THREE.Vector2(-.12,0));
    for(let i=1;i<=tailSteps;i++){
      const u=i/tailSteps,v=1-u;
      points[spiralSteps+i].set(v*v*v*join.x+3*v*v*u*c1.x+3*v*u*u*c2.x+u*u*u*target.x,
        v*v*v*join.y+3*v*v*u*c1.y+3*v*u*u*c2.y+u*u*u*target.y);
    }
    for(let i=0;i<count;i++){
      const before=points[Math.max(0,i-1)],after=points[Math.min(count-1,i+1)],dx=after.x-before.x,dy=after.y-before.y,len=Math.hypot(dx,dy);
      const nx=-dy/len*.025,ny=dx/len*.025,p=points[i];
      for(const[j,s,z]of[[0,1,-.035],[1,-1,-.035],[2,-1,.035],[3,1,.035]]){
        const k=i*12+j*3;positions[k]=p.x+s*nx;positions[k+1]=p.y+s*ny;positions[k+2]=z;
      }
    }
    geometry.attributes.position.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
    mesh.userData.attachmentDistance=start.distanceTo(end);mesh.userData.terminalPoint=end.clone().add(new THREE.Vector3(-.17,0,0));
  };
  return mesh;
}
