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


test('251 actual toes and hook cheeks clear the complete moving head throughout squeeze, fall and reload', () => {
  const m=create(251),d=m.root.userData,b=d.blocks,a=audit(); let maximumGap=0;
  const targets=visibleMeshes(b.liftHead);
  const times=new Set(Array.from({length:33},(_,i)=>10*i/32));
  for(const [start,end] of [[2.05,3.45],[3.45,3.65],[6.25,6.95]]) for(let i=0;i<=16;i++) times.add(start+(end-start)*i/16);
  for(const t of times){m.update(t);m.root.updateMatrixWorld(true);
    for(const body of [...d.workingHooks.bodies,...d.workingHooks.toes]) for(const target of targets) a.check(body,target,'hook/head');
    if(t<=3.45) for(let i=0;i<2;i++){const gap=Math.min(a.check(d.workingHooks.toes[i],d.workingHooks.shelves[i],'working toe/shelf'),a.check(d.workingHooks.shelves[i],d.workingHooks.toes[i],'shelf/toe'));maximumGap=Math.max(maximumGap,gap);assert.ok(gap<.0003,gap);}
  }
  console.log({id:251,maximumGap,...a.report()});
});

test('251 load-bearing normals support the weight until the finite edge release, without pose jumps',()=>{
  const d=create(251).root.userData;
  for(let i=0;i<1000;i++){const s=d.stateAtTime(3.45*i/1000);assert.ok(Math.abs(s.leftLatchContact.gap)<1e-12);assert.ok(s.leftLatchContact.normal.y>0);}
  for(const t of [2.05,3.45,4.45,5.15,6.25,6.95,8.75,10]){
    const a=d.stateAtTime(t-1e-7),b=d.stateAtTime(t+1e-7);
    assert.ok(Math.abs(a.liftHeadY-b.liftHeadY)<1e-5);assert.ok(Math.abs(a.hookOpeningAngle-b.hookOpeningAngle)<1e-6);
  }
  const initial=d.stateAtTime(0),n=initial.leftLatchContact.normal,p=d.geometry.leftLatchBearingLocal;
  assert.ok(p.x*n.y-p.y*n.x>.49, 'initial load must seat the left hook against its closing stop');
  assert.equal(d.dynamics.validatedPassiveRelease,false);
  assert.equal(d.stateAtTime(3.45).weightSupported,false);
  assert.ok(d.stateAtTime(3.46).leftLatchContact.gap>0);
});

test('251 actual pins clear bored cheeks and span their thickness; hook tips remain clear of guides',()=>{
  const m=create(251),d=m.root.userData,a=audit();
  for(let i=0;i<=16;i++){m.update(10*i/16);m.root.updateMatrixWorld(true);
    for(let j=0;j<2;j++){
      a.check(d.blocks.pivotPins[j],d.workingHooks.bodies[j],'pivot/cheek',true);
      for(const fixed of [d.blocks.yoke,d.workingHooks.closingStops[j],d.workingHooks.stopBrackets[j]]) {
        a.check(d.workingHooks.bodies[j],fixed,'hook/closing stop and yoke');
        const gap=a.check(fixed,d.workingHooks.bodies[j],'closing stop and yoke/hook');
        if(i===0&&fixed===d.workingHooks.closingStops[j])assert.ok(gap<.004,gap);
      }
      for(const guide of [d.blocks.leftGuide,d.blocks.rightGuide]) for(const body of [d.workingHooks.bodies[j],d.workingHooks.toes[j]]) a.check(body,guide,`hook/guide t=${10*i/16}`);
      const pin=new THREE.Box3().setFromObject(d.blocks.pivotPins[j]),body=new THREE.Box3().setFromObject(d.workingHooks.bodies[j]);assert.ok(pin.min.z<body.min.z&&pin.max.z>body.max.z);
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
  for(const mesh of [...(d.workingHooks.bodies??[]),...(d.workingHooks.plates??[])]){
    let volume=0;for(const t of surfaceTriangles(mesh.geometry))volume+=t.a.dot(new THREE.Vector3().crossVectors(t.b,t.c))/6;assert.ok(volume>0);
  }
  for(let i=0;i<=16;i++){m.update((id===251?10:12)*i/16);m.root.updateMatrixWorld(true);meshes.forEach((mesh,j)=>{
    assert.equal(mesh.geometry.attributes.position.array,buffers[j]);assert.ok(mesh.castShadow&&mesh.receiveShadow);
    for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material])assert.equal(mat.fog,false);
    const p=mesh.geometry.attributes.position;for(let k=0;k<p.count;k++){const v=new THREE.Vector3().fromBufferAttribute(p,k).applyMatrix4(mesh.matrixWorld);assert.ok(d.cameraFitBounds.clone().expandByScalar(.001).containsPoint(v),`${mesh.userData.role} outside: ${v.toArray()}`);}
  });}
  assert.ok(d.hideGround);assert.ok(d.minimumDisplayCycleSeconds>=10);assert.ok(m.cameraDirection);
});
