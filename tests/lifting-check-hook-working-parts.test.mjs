import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createAuthoredPileDriverMovement } from '../src/simulation/authored-pile-drivers.js';
import { createAuthoredCheckHookMovement } from '../src/simulation/authored-check-hooks.js';
import { surfacePoints, surfaceTriangles, solidSurface } from './helpers/solid-surface.mjs';
const create = id => id === 251 ? createAuthoredPileDriverMovement({id}) : createAuthoredCheckHookMovement({id});
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


test('251 pliers jaws clear the T head, slot B, the stop lugs and the rope block over grip, release, fall and re-catch', () => {
  const m=create(251),d=m.root.userData,b=d.blocks,tl=d.timeline,a=audit();let seatedStop=Infinity,seatedTee=Infinity;
  const times=new Set(Array.from({length:33},(_,i)=>10*i/32));
  // update() takes display time; sample canonical phases around the contacts.
  for(const [start,end] of [[2.8,tl.releaseTime+.05],[7.2,8.2],[8.5,9.2],[9.3,10]]) for(let i=0;i<=16;i++) times.add(start+(end-start)*i/16);
  for(const u of times){m.update(u-d.displayTimeOffset);m.root.updateMatrixWorld(true);const s=d.kinematics;
    for(const jaw of b.jawBodies){
      const tee=Math.min(a.check(jaw,b.tee,'jaw/T head'),a.check(b.tee,jaw,'T head/jaw'));
      if(s.gripped&&s.jawOpeningAngle===0) seatedTee=Math.min(seatedTee,tee);
      for(const fixed of [...b.beamHalves,b.stopLug,b.casting,b.weightBody]) {a.check(jaw,fixed,'jaw/fixed');a.check(fixed,jaw,'fixed/jaw');}
      if(s.jawOpeningAngle===0) seatedStop=Math.min(seatedStop,a.check(b.stopLug,jaw,'stop seat'));
    }
    a.check(b.tee,b.casting,'T/rope block');a.check(b.stopLug,b.tee,'lug/T');
  }
  assert.ok(seatedTee<.002,seatedTee);assert.ok(seatedStop<.01,seatedStop);
  console.log({id:251,seatedTee,seatedStop,...a.report()});
});

test('251 pins fill their jaw bores through the jaw and into the rope-block ears', () => {
  const m=create(251),d=m.root.userData,a=audit();
  for(let i=0;i<=16;i++){m.update(10*i/16);m.root.updateMatrixWorld(true);
    for(let j=0;j<2;j++){
      const gap=a.check(d.blocks.pins[j],d.blocks.jawBodies[j],'pin/bored jaw',true);assert.ok(gap<.01,gap);
      const pin=new THREE.Box3().setFromObject(d.blocks.pins[j]),jaw=new THREE.Box3().setFromObject(d.blocks.jawBodies[j]),ear=new THREE.Box3().setFromObject(d.blocks.casting);
      assert.ok(pin.min.z<ear.max.z&&pin.max.z>jaw.max.z);
    }
  }console.log({id:251,...a.report()});
});

test('253 active face supplies resisting drum torque and seats the hook against its deployment stop',()=>{
  const d=create(253).root.userData,g=d.geometry,n=g.contactNormalAtCatch,c=g.contactCenterAtCatch,p=g.hookContactLocal;
  const cross=(a,b)=>a.x*b.y-a.y*b.x;
  // Brown's forward-leaning hooks fold forward; the stud's reaction (-n) turns
  // each hook clockwise, back onto its clockwise deployment stop.
  assert.ok(cross(c,n)>.2);assert.ok(cross(p,n)>.15);
  for(let i=0;i<=2400;i++) assert.ok(d.stateAtTime(12*i/2400).minimumHookStudGap>=-1e-12);
  assert.equal(d.dynamics.validatedPassiveCatch,false);
  assert.ok(d.stateAtTime(7.2).flangeAngle<-.17);
  assert.equal(d.stateAtTime(7.2).hookAngle,0);
});

test('253 finite hook faces and studs clear over approach, arrest and backed-off retraction (Brown draws no hook stops)',()=>{
  const m=create(253),d=m.root.userData,a=audit();let maximumContactGap=0;
  const times=new Set(Array.from({length:33},(_,i)=>12*i/32));
  for(let i=0;i<=16;i++){times.add(4.4+.2*i/16);times.add(7+.8*i/16);}
  // update() takes display time; the audit samples canonical cycle time.
  for(const t of times){m.update(t-d.displayTimeOffset);m.root.updateMatrixWorld(true);
    for(const journal of [d.blocks.flangeDisk,d.blocks.fixedBacking,d.blocks.ropeDrumBody]) a.check(d.blocks.centerShaft,journal,'common shaft/journals',true);
    for(let i=0;i<3;i++){
      const body=d.workingHooks.plates[i];
      for(const stud of d.blocks.studs)a.check(body,stud,'hook/stud');
      const pivot=d.blocks.hookPivots[i].children.find(o=>o.userData.role?.endsWith('pivot-pin'));
      a.check(pivot,body,'pin/bored hook',true);
      if(t>=4.6&&t<=7){const gap=a.check(body,d.blocks.studs[i],'arresting face');maximumContactGap=Math.max(maximumContactGap,gap);assert.ok(gap<.002,gap);}
    }
  }
  m.update(4.6-d.displayTimeOffset);m.root.updateMatrixWorld(true);
  const body=d.workingHooks.plates[0],g=d.geometry;
  const expected=g.hookContactLocal.clone().addScaledVector(g.contactNormalAtCatch,g.hookBarRadius);
  const point=new THREE.Vector3(expected.x,expected.y,0),nearest=new THREE.Vector3();
  let distance=Infinity,normal;
  for(const triangle of surfaceTriangles(body.geometry)) {const value=triangle.closestPointToPoint(point,nearest).distanceTo(point);if(value<distance){distance=value;normal=triangle.getNormal(new THREE.Vector3());}}
  assert.ok(distance<.002);assert.ok(normal.x*g.contactNormalAtCatch.x+normal.y*g.contactNormalAtCatch.y>.99);
  assert.ok(g.contactCenterAtCatch.x*normal.y-g.contactCenterAtCatch.y*normal.x>.15);
  assert.ok(g.hookContactLocal.x*normal.y-g.hookContactLocal.y*normal.x>.1);
  console.log({id:253,maximumContactGap,actualReactionNormal:normal.toArray(),...a.report()});
});

for(const id of [251,253])test(`${id} stable geometry buffers, outward new plates, no fog, shadows and cycle fit`,()=>{
  const m=create(id),d=m.root.userData,meshes=visibleMeshes(m.root),buffers=meshes.map(o=>o.geometry.attributes.position.array);
  for(const mesh of [...(d.workingHooks?.bodies??[]),...(d.workingHooks?.plates??[]),...(d.blocks.jawBodies??[])]){
    let volume=0;for(const t of surfaceTriangles(mesh.geometry))volume+=t.a.dot(new THREE.Vector3().crossVectors(t.b,t.c))/6;assert.ok(volume>0);
  }
  for(let i=0;i<=16;i++){m.update((id===251?10:12)*i/16);m.root.updateMatrixWorld(true);meshes.forEach((mesh,j)=>{
    assert.equal(mesh.geometry.attributes.position.array,buffers[j]);assert.ok(mesh.castShadow&&mesh.receiveShadow);
    for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material])assert.equal(mat.fog,false);
    if(mesh.userData.beyondPlateCrop)return;
    const p=mesh.geometry.attributes.position;for(let k=0;k<p.count;k++){const v=new THREE.Vector3().fromBufferAttribute(p,k).applyMatrix4(mesh.matrixWorld);assert.ok(d.cameraFitBounds.clone().expandByScalar(.001).containsPoint(v),`${mesh.userData.role} outside: ${v.toArray()}`);}
  });}
  assert.ok(d.hideGround);assert.ok(d.minimumDisplayCycleSeconds>=10);assert.ok(m.cameraDirection);
});
