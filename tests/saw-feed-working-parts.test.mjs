import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createAuthoredSawFeedMovement as create } from '../src/simulation/authored-saw-feeds.js';
import { nearestSawFeedContact } from '../src/simulation/saw-feed-working-parts.js';
import { sawFeedHoldingPath } from '../src/simulation/baked/saw-feed-holding-path.js';
import { surfacePoints, surfaceTriangles, solidSurface } from './helpers/solid-surface.mjs';
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

const visibleMeshes = root => { const result = []; root.traverseVisible(o => { if (o.isMesh) result.push(o); }); return result; };



test('284 drive and holding noses meet actual load-bearing faces without finite penetration',()=>{
  const m=create({id:284}),d=m.root.userData,g=d.geometry,b=d.blocks,p=d.workingParts,a=audit();let maxDrive=0,maxHold=0;
  for(let i=0;i<=64;i++){
    m.update((i/64-g.sourceCycleCoordinate)*g.inputCyclePeriod);m.root.updateMatrixWorld(true);
    const s=d.kinematics;
    const drive=a.check(b.pawlNose,p.rim,'driving nose/ratchet');
    const hold=a.check(p.holdingNose,p.rim,'holding nose/ratchet');
    a.check(p.rim,b.pawlNose,'ratchet/driving nose');a.check(p.rim,p.holdingNose,'ratchet/holding nose');
    for(const body of [b.pawlBody,p.holdingBody])a.check(body,p.rim,'pawl body/ratchet');
    if(s.driving){maxDrive=Math.max(maxDrive,drive);assert.ok(drive<.002);assert.ok(s.outputContactMomentArm<-.8);}
    else{maxHold=Math.max(maxHold,hold);assert.ok(hold<.002);assert.ok(s.holdingContact.outputMomentArm<-.8);}
  }
  for(const q of [.2,.7]){
    m.update((q-g.sourceCycleCoordinate)*g.inputCyclePeriod);m.root.updateMatrixWorld(true);
    const s=d.kinematics,contact=q<g.driveEndPhase?s.ratchetContactPoint:s.holdingContact.point;
    const point=new THREE.Vector3(contact.x,contact.y,.24).applyMatrix4(p.rim.matrixWorld.clone().invert());
    let minimum=Infinity,normal;const nearest=new THREE.Vector3();
    for(const triangle of surfaceTriangles(p.rim.geometry)){const gap=triangle.closestPointToPoint(point,nearest).distanceTo(point);if(gap<minimum){minimum=gap;normal=triangle.getNormal(new THREE.Vector3());}}
    normal.transformDirection(p.rim.matrixWorld);
    assert.ok(minimum<1e-6);assert.ok(-(contact.x*normal.y-contact.y*normal.x)<-.8,'Actual load-bearing face must resist reverse rotation');
  }
  console.log({maxDrive,maxHold,...a.report()});
});

test('284 finite involute pinion and rack remain meshed throughout one indexed feed',()=>{
  const m=create({id:284}),d=m.root.userData,g=d.geometry,b=d.blocks,p=d.workingParts,a=audit();let maximumGap=0;
  for(let i=0;i<=32;i++){
    m.update((i/32-g.sourceCycleCoordinate)*g.inputCyclePeriod);m.root.updateMatrixWorld(true);let gap=.1;
    for(const rack of b.rackTeeth){gap=Math.min(gap,a.check(rack,p.pinion,'rack/pinion'));
      const c=rack.getWorldPosition(new THREE.Vector3());if(Math.abs(c.x)<.5)a.check(p.pinion,rack,'pinion/rack');}
    a.check(p.pinion,b.rackBody,'pinion/rack backing');maximumGap=Math.max(maximumGap,gap);assert.ok(gap<.003,gap);
  }
  console.log({maximumGap,...a.report()});
});

test('284 bored working pivots and output journals clear their actual shafts',()=>{
  const m=create({id:284}),d=m.root.userData,g=d.geometry,b=d.blocks,p=d.workingParts,a=audit();
  for(let i=0;i<=16;i++){m.update(g.inputCyclePeriod*i/16);m.root.updateMatrixWorld(true);
    a.check(p.hinge,b.pawlBody,'driver hinge',true);a.check(p.holdingPin,p.holdingBody,'holding hinge',true);
    for(const part of [p.hub,p.pinion,p.journal])a.check(b.outputShaft,part,'output shaft',true);
    a.check(b.slider,b.pawlBody,'slider/pawl');
    a.check(b.inputBearing,p.crankPlate,'input spindle/crank',true);
    a.check(b.crankPin,p.crankPlate,'input crank pin',true);
  }console.log(a.report());
});

test('284 one-tooth feed and finite return are continuous, and the holding click has no tooth-tip jump',()=>{
  const m=create({id:284}),d=m.root.userData,g=d.geometry;
  let previous;
  for(let i=0;i<=4096;i++){
    m.update((i/4096-g.sourceCycleCoordinate)*g.inputCyclePeriod);const s=d.kinematics;
    const contact=nearestSawFeedContact(s.pawlGeometry.pawlContactCenter,s.wheelAngle,d.workingParts.outline);
    assert.ok(contact.distance-g.pawlNoseRadius>=.00019);
    assert.ok(s.holdingContact.gap>=.0005);
    if(previous)assert.ok(Math.abs(s.holdingContact.angle-previous.holdingContact.angle)<.004);
    previous=s;
  }
  for(const q of [0,g.driveEndPhase,1]){const a=d.stateAtCycleCoordinate(q-1e-7),b=d.stateAtCycleCoordinate(q+1e-7);
    assert.ok(a.pawlGeometry.pawlContactCenter.distanceTo(b.pawlGeometry.pawlContactCenter)<1e-5);
    assert.ok(Math.abs(a.wheelAngle-b.wheelAngle)<1e-5);}
  const a=d.stateAtCycleCoordinate(0),b=d.stateAtCycleCoordinate(1);
  assert.ok(Math.abs(b.wheelAngle-a.wheelAngle+g.ratchetToothPitch)<1e-12);
  assert.equal(d.dynamics.forceValidated,false);
  assert.ok(sawFeedHoldingPath.minimumValidatedGap>.0005);
});

test('284 new working meshes have outward normals, stable buffers, no fog and full-cycle framing',()=>{
  const m=create({id:284}),d=m.root.userData,meshes=visibleMeshes(m.root),buffers=meshes.map(o=>o.geometry.attributes.position.array);
  for(const mesh of [d.workingParts.rim,d.workingParts.pinion,d.workingParts.holdingBody,d.blocks.pawlBody]){
    let volume=0;for(const t of surfaceTriangles(mesh.geometry))volume+=t.a.dot(new THREE.Vector3().crossVectors(t.b,t.c))/6;assert.ok(volume>0);
  }
  for(let i=0;i<=16;i++){m.update(5*i/16);m.root.updateMatrixWorld(true);meshes.forEach((mesh,j)=>{
    assert.equal(mesh.geometry.attributes.position.array,buffers[j]);assert.ok(mesh.castShadow&&mesh.receiveShadow);
    for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material])assert.equal(mat.fog,false);
    const p=mesh.geometry.attributes.position;for(let k=0;k<p.count;k++){const v=new THREE.Vector3().fromBufferAttribute(p,k).applyMatrix4(mesh.matrixWorld);assert.ok(d.cameraFitBounds.clone().expandByScalar(.001).containsPoint(v),`${mesh.userData.role} outside ${v.toArray()}`);}
  });}
});
