import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredGearMovement as create} from '../src/simulation/authored-gears.js';
import {partialLanternContacts} from '../src/simulation/partial-lantern-rack-parts.js';
import data from '../src/simulation/baked/partial-lantern-rack.js';
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

const shaftMesh = group => group.userData.rotor.children.find(o => o.isMesh);

test('199 rendered pins clear every finite tooth over a full cycle, including the old .375 witness',()=>{
  const m=create({id:199}),d=m.root.userData,b=d.blocks,a=audit();let maxNearest=0;
  const phases=[...Array.from({length:65},(_,i)=>i/64),.4995,.9995];
  for(const q of phases){m.update(q*d.transmission.cyclePeriod);m.root.updateMatrixWorld(true);let nearest=.1;
    for(const pin of b.lanternPins)for(const tooth of d.workingParts.teeth){
      nearest=Math.min(nearest,a.check(pin,tooth,'pin/tooth'));a.check(tooth,pin,'tooth/pin');
    }maxNearest=Math.max(maxNearest,nearest);assert.ok(nearest<.001,`${q}: ${nearest}`);
  }console.log({maxNearest,...a.report()});
});

test('199 actual early drive faces carry the right force and moment; late transfer remains explicitly failed',()=>{
  const m=create({id:199}),d=m.root.userData;
  for(const q of [.01,.25,.375,.51,.75,.875]){
    m.update(q*d.transmission.cyclePeriod);m.root.updateMatrixWorld(true);
    const s=d.kinematics,c=s.finiteContact.driving;assert.ok(c.gap<.0004);assert.ok(c.driveForce>.1);assert.ok(c.resistingMoment>.05);
    const tooth=(c.side>0?d.blocks.topRackTeeth:d.blocks.bottomRackTeeth)[c.tooth];
    const world=new THREE.Vector3(...c.point,0),point=world.clone().applyMatrix4(tooth.matrixWorld.clone().invert());
    let best=Infinity,normal;const nearest=new THREE.Vector3();
    for(const triangle of surfaceTriangles(tooth.geometry)){const gap=triangle.closestPointToPoint(point,nearest).distanceTo(point);if(gap<best){best=gap;normal=triangle.getNormal(new THREE.Vector3());}}
    normal.transformDirection(tooth.matrixWorld);assert.ok(best<1e-6);
    assert.ok(-normal.x*s.frameDirection>.1,'surface reaction must drive frame');
    assert.ok(world.x*normal.y-world.y*normal.x>.05,'surface reaction must resist clockwise input');
  }
  const failed=partialLanternContacts(d.stateAtInputTravel(.99951171875*2*Math.PI));
  assert.ok(failed.active<.0004);assert.ok(failed.closest.driveForce<0);assert.ok(failed.driving.gap>.09);
  assert.equal(failed.loadedTransferValidated,false);assert.match(d.reconstructionNote,/retards/);
  console.log({failedTransfer:failed});
});

test('199 finite shaft journals and extended spokes are clear and physically connected',()=>{
  const m=create({id:199}),d=m.root.userData,b=d.blocks,a=audit();
  for(let i=0;i<=16;i++){m.update(i/16*d.transmission.cyclePeriod);m.root.updateMatrixWorld(true);
    for(const part of [...b.lanternHubs,...b.lanternSpokes,b.pinionBearing])a.check(shaftMesh(b.pinionShaft),part,'lantern journals',true);
    b.guideRollers.forEach((r,j)=>a.check(shaftMesh(b.guideRollerShafts[j]),r.userData.hub,'roller journal',true));
    for(const r of b.guideRollers)a.check(r.userData.tread,b.rackFrameBody,'roller/frame');
  }
  for(const spoke of b.lanternSpokes){const p=spoke.geometry.attributes.position;let radius=0;for(let i=0;i<p.count;i++)radius=Math.max(radius,Math.hypot(p.getX(i),p.getY(i)));assert.ok(radius>d.geometry.pinionBodyRadius-.042);}
  console.log(a.report());
});

test('199 source pin count, entry teeth, continuous position, stable geometry and explicit timing are retained',()=>{
  const m=create({id:199}),d=m.root.userData,b=d.blocks;
  assert.equal(b.lanternPins.length,4);assert.ok(d.transmission.installedPinFraction<.5);
  for(const side of[1,-1]){const t=data.teeth.filter(t=>t.side===side);assert.ok(t[0].tipHeight<Math.min(...t.slice(1).map(t=>t.tipHeight))-.2);}
  for(const q of[0,.5,1]){const a=d.stateAtInputTravel((q-1e-7)*2*Math.PI),z=d.stateAtInputTravel((q+1e-7)*2*Math.PI);assert.ok(a.frameTranslation.distanceTo(z.frameTranslation)<1e-5);assert.ok(a.frameVelocity.dot(z.frameVelocity)<0);}
  const meshes=[];m.root.traverseVisible(o=>{if(o.isMesh)meshes.push(o);});const geometries=meshes.map(o=>o.geometry),buffers=meshes.map(o=>o.geometry.attributes.position.array);
  for(let i=0;i<=64;i++)m.update(i/64*d.transmission.cyclePeriod);
  let triangles=0;meshes.forEach((o,i)=>{assert.equal(o.geometry,geometries[i]);assert.equal(o.geometry.attributes.position.array,buffers[i]);assert.ok(o.castShadow);for(const mat of[].concat(o.material))assert.equal(mat.fog,false);if([].concat(o.material).some(mat=>mat.visible))triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});
  assert.ok(triangles<50000);assert.equal(d.hideGround,true);assert.ok(d.minimumDisplayCycleSeconds>=8);assert.ok(m.cameraDirection);assert.equal(d.contactQualification.loadedTransmissionValidated,false);
  console.log({triangles});
});
