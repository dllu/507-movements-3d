import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredEscapementMovement as create} from '../src/simulation/authored-escapements.js';
import {surfacePoints,surfaceTriangles,solidSurface} from './helpers/solid-surface.mjs';
function audit() {
  const points = new Map(), solids = new Map(), triangles = new Map(), minima = {};
  let queries = 0;
  const check = (a, b, label, journal = false, dynamic = false) => {
    if (dynamic || !points.has(a.geometry)) points.set(a.geometry, surfacePoints(a.geometry));
    if (!solids.has(b.geometry)) solids.set(b.geometry, solidSurface(b.geometry));
    const solid = solids.get(b.geometry), matrix = b.matrixWorld.clone().invert().multiply(a.matrixWorld);
    const verify = point => {
      const gap = solid.signedDistance(point, .1); queries++;
      assert.ok(Number.isFinite(gap)); minima[label] = Math.min(minima[label] ?? .1, gap);
      assert.ok(gap >= -1e-5, `${label}: ${a.userData.role} -> ${b.userData.role}: ${gap}`);
      return gap;
    };
    let minimum = .1;
    for (const point of points.get(a.geometry)) minimum = Math.min(minimum, verify(point.clone().applyMatrix4(matrix)));
    // A long shaft's ends can lie beyond a thin journal. Intersect its actual
    // triangle edges with the journal's interior slices as well as vertices.
    if (journal) {
      if (!triangles.has(a.geometry)) triangles.set(a.geometry, surfaceTriangles(a.geometry));
      for (const triangle of triangles.get(a.geometry)) {
        const vertices = [triangle.a, triangle.b, triangle.c].map(p => p.clone().applyMatrix4(matrix));
        for (const axis of ['x', 'y', 'z']) for (const coordinate of [solid.box.min[axis] + 1e-6, (solid.box.min[axis] + solid.box.max[axis]) / 2, solid.box.max[axis] - 1e-6]) {
          for (let j = 0; j < 3; j++) {
            const a = vertices[j], b = vertices[(j + 1) % 3], t = (coordinate - a[axis]) / (b[axis] - a[axis]);
            if (t >= 0 && t <= 1) verify(a.clone().lerp(b, t));
          }
        }
      }
    }
    return minimum;
  };
  return { check, report: () => ({ queries, minima }) };
}

const shaftMesh=g=>g.userData.rotor.children.find(o=>o.isMesh);
test('238 finite complete wheel clears both pallets and their mounts across lock, impulse and drops',()=>{
 const m=create({id:238}),d=m.root.userData,b=d.blocks,p=d.workingParts,a=audit();
 for(let i=0;i<=64;i++){m.update(i/64*4);m.root.updateMatrixWorld(true);
  for(const part of[...p.faces,...p.mounts,b.palletBody]){a.check(part,b.escapeWheel.userData.body,'pallet/wheel');a.check(b.escapeWheel.userData.body,part,'wheel/pallet');}
 }console.log(a.report());
});
test('238 C retains a supporting finite tip and opposing actual surface reaction',()=>{
 const m=create({id:238}),d=m.root.userData,b=d.blocks,g=d.geometry,p=d.workingParts,wheel=b.escapeWheel.userData.body,solid=solidSurface(wheel.geometry);let minWheel=Infinity,minPallet=Infinity,maxGap=0;const support=[];
 for(const q of[.4,.6,.7,.819]){m.update(q*4);m.root.updateMatrixWorld(true);const s=d.kinematics,c=s.contact,face=p.faces[s.activePallet==='B'?0:1],world=new THREE.Vector3(c.point.x,c.point.y,g.wheelPlaneZ),local=world.clone().applyMatrix4(face.matrixWorld.clone().invert()),nearest=new THREE.Vector3();let best=Infinity,normal;
  for(const t of surfaceTriangles(face.geometry)){const n=t.getNormal(new THREE.Vector3());if(n.x*c.normal.x+n.y*c.normal.y<.8)continue;const gap=t.closestPointToPoint(local,nearest).distanceTo(local);if(gap<best){best=gap;normal=n;}}
  assert.ok(best<.000501);normal.transformDirection(face.matrixWorld);maxGap=Math.max(maxGap,best);
  const wheelMoment=c.point.x*normal.y-c.point.y*normal.x,r=c.point.clone().sub(g.palletPivot),palletMoment=-r.x*normal.y+r.y*normal.x;
  assert.ok(wheelMoment<-.05);assert.ok((s.activePallet==='B'?1:-1)*palletMoment>.02);minWheel=Math.min(minWheel,-wheelMoment);minPallet=Math.min(minPallet,Math.abs(palletMoment));
  const wheelLocal=world.clone().applyMatrix4(wheel.matrixWorld.clone().invert());assert.ok(solid.distance(wheelLocal)<1e-6,'original active tip preserved');
  const outline=p.profile.outline;let index=0,bestDistance=Infinity;outline.forEach((v,i)=>{const r=Math.hypot(v[0]-wheelLocal.x,v[1]-wheelLocal.y);if(r<bestDistance){bestDistance=r;index=i;}});
  const outward=normal.clone().negate().transformDirection(wheel.matrixWorld.clone().invert()),tip=outline[index],projections=[-1,1].map(offset=>{const v=outline[(index+offset+outline.length)%outline.length],edge=new THREE.Vector3(v[0]-tip[0],v[1]-tip[1],0).normalize();return edge.dot(outward);});
  support.push({q,side:s.activePallet,projections});
  if(s.activePallet==='C')assert.ok(Math.max(...projections)<-1e-3,'C reaction must lie in actual finite tip normal cone');
  
 }assert.equal(d.contactQualification.completeTransmissionValidated,false);assert.equal(d.contactQualification.B.closestFlankImpulseValidated,true);console.log(JSON.stringify({maxGap,minWheel,minPallet,support}));
});
test('238 drop and handoff are position/velocity continuous with no hidden contact schedule jumps',()=>{
 const d=create({id:238}).root.userData,g=d.geometry;
 for(const q of[0,.1,.34,.4,.58,.82,.88,1]){const a=d.stateAtCycleCoordinate(q-1e-7),b=d.stateAtCycleCoordinate(q+1e-7);assert.ok(Math.abs(a.wheelAngle-b.wheelAngle)<1e-5);assert.ok(Math.abs(a.palletAngle-b.palletAngle)<1e-5);assert.ok(Math.abs(a.wheelAngularSpeed-b.wheelAngularSpeed)<1e-6);}
 assert.ok(g.palletAmplitude>=THREE.MathUtils.degToRad(4));assert.equal(d.dynamics.forceValidated,false);assert.ok(d.workingParts.profile.qualification.areaLossFraction<.15);assert.ok(d.workingParts.profile.qualification.maximumTipLoss<1e-12);assert.ok(d.workingParts.profile.qualification.smoothingOutsideArea<1e-12);
});
test('238 rear attachments join the source body to C and B without floating standoffs; bores clear arbors',()=>{
 const m=create({id:238}),d=m.root.userData,b=d.blocks,p=d.workingParts,a=audit(),body=solidSurface(b.palletBody.geometry);
 for(const attachment of p.attachments){assert.ok(body.inside(new THREE.Vector3(...attachment.mid,0)));assert.ok(body.inside(new THREE.Vector3(...attachment.carrier,0)));}
 for(let i=0;i<=16;i++){m.update(i/16*4);m.root.updateMatrixWorld(true);for(const part of[b.palletBody,b.palletHub,p.bearing])a.check(shaftMesh(b.palletShaft),part,'pallet arbor',true);for(const part of[b.escapeWheel.userData.body,b.escapeWheel.userData.hub])a.check(shaftMesh(b.escapeShaft),part,'wheel arbor',true);}
 console.log(a.report());
});
test('238 source display settings and geometry buffers remain stable',()=>{
 const m=create({id:238}),d=m.root.userData,meshes=[];m.root.traverseVisible(o=>{if(o.isMesh)meshes.push(o);});const buffers=meshes.map(o=>o.geometry.attributes.position.array);for(let i=0;i<=32;i++)m.update(i/32*4);let triangles=0;meshes.forEach((o,i)=>{assert.equal(o.geometry.attributes.position.array,buffers[i]);assert.ok(o.castShadow);for(const mat of[].concat(o.material))assert.equal(mat.fog,false);triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});assert.equal(d.hideGround,true);assert.ok(d.minimumDisplayCycleSeconds>=6);assert.ok(m.cameraDirection.z>15);console.log({triangles});
});
