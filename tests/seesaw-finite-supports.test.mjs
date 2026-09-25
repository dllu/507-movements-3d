import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createAuthoredSeesawMovement } from '../src/simulation/authored-seesaws.js';
import { solidSurface, surfacePoints } from './helpers/solid-surface.mjs';

const model = createAuthoredSeesawMovement({id:363});
const data = model.root.userData;
const b = data.blocks;

test('363 source-proportioned fulcrum keeps the entire moving body above the foundation over its full swing', (t) => {
  assert.ok(Math.abs((data.geometry.pivot.y - .18) / data.geometry.beamHalfLength - 4/4.5) < 1e-14);
  let minimum = Infinity;
  for (let i=0;i<=128;i++) {
    model.update(i/32); model.root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(b.beamRotor);
    minimum = Math.min(minimum, bounds.min.y);
    assert.ok(data.cameraFitBounds.containsBox(bounds), 'swept moving body is framed');
  }
  t.diagnostic(`minimum moving height ${minimum}`);
  assert.ok(minimum > 1.15, `moving minimum height ${minimum}`);
  assert.ok(b.centerPost.position.y+b.centerPost.geometry.parameters.height/2 < data.geometry.pivot.y-.30);
});

test('363 actual bored boss and plank clear the fixed axle throughout the cosine cycle', (t) => {
  const moving = [b.pivotBoss,b.plank];
  const pairs = moving.flatMap(mesh=>[[mesh,b.pivotAxle],[b.pivotAxle,mesh]])
    .map(([a,c])=>({a,c,points:surfacePoints(a.geometry),field:solidSurface(c.geometry)}));
  let minimum = Infinity;
  for(let i=0;i<=64;i++) {
    model.update(i/16);model.root.updateMatrixWorld(true);
    for(const p of pairs) {
      const tr=p.c.matrixWorld.clone().invert().multiply(p.a.matrixWorld);
      for(const point of p.points) {
        const q=point.clone().applyMatrix4(tr);
        if(p.field.box.distanceToPoint(q)>.01)continue;
        minimum=Math.min(minimum,p.field.signedDistance(q));
      }
    }
  }
  t.diagnostic(`minimum axle clearance ${minimum}`);
  assert.ok(minimum>.003, `axle running clearance ${minimum}`);
  assert.ok(minimum<.0042, 'retain finite bearing contact proximity');
});

test('363 moving solids clear all fixed support solids over the full cycle', (t) => {
  const fixed=[];
  for(const part of [b.base,b.centerPost,...b.apexCaps,...b.frameLegs,...b.axleCaps]) part.traverse(o=>{if(o.geometry)fixed.push(o);});
  const moving=[];b.beamRotor.traverse(o=>{if(o.geometry)moving.push(o);});
  const fields=new Map([...fixed,...moving].map(o=>[o,{field:solidSurface(o.geometry),points:surfacePoints(o.geometry)}]));
  let minimum=Infinity;
  for(let i=0;i<=64;i++) {
    model.update(i/16);model.root.updateMatrixWorld(true);
    for(const a of moving)for(const c of fixed) {
      const ab=new THREE.Box3().setFromObject(a),cb=new THREE.Box3().setFromObject(c);
      if(!ab.expandByScalar(.08).intersectsBox(cb))continue;
      for(const [p,q]of [[a,c],[c,a]]) {
        const tr=q.matrixWorld.clone().invert().multiply(p.matrixWorld),f=fields.get(q).field;
        for(const point of fields.get(p).points) {
          const sample=point.clone().applyMatrix4(tr);
          if(f.box.distanceToPoint(sample)>.08)continue;
          minimum=Math.min(minimum,f.signedDistance(sample));
        }
      }
    }
  }
  t.diagnostic(`minimum support clearance ${minimum}`);
  assert.ok(minimum>.065, `moving / fixed support clearance ${minimum}`);
  assert.ok(Number.isFinite(minimum));
  // Fixed cheek bores also receive the axle rather than hiding it in a solid.
  const field=solidSurface(b.apexCaps[0].geometry);
  const gap=field.signedDistance(new THREE.Vector3(.105,data.geometry.pivot.y,-.43));
  assert.ok(gap>.0028 && gap<.0031, `fixed cheek bore gap ${gap}`);
});

test('363 state queries preserve geometry and enforce source-period, fogless playback', () => {
  const before=[];model.root.traverse(o=>before.push([o,o.geometry]));
  for(let i=0;i<40;i++){data.stateAtTime(i*.1);model.update(i*.1);}
  const after=[];model.root.traverse(o=>after.push([o,o.geometry]));
  assert.deepEqual(after,before);
  assert.equal(data.minimumDisplayCycleSeconds,4);
  assert.equal(data.hideGround,true);
  assert.match(data.reconstructionNote,/rider forces and bearing friction are not simulated/);
  model.root.traverse(o=>{for(const m of [].concat(o.material??[]))assert.equal(m.fog,false);});
});
