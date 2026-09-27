import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createAuthoredPersonTreadmillMovement} from '../src/simulation/authored-person-treadmills.js';
import {solidSurface, surfacePoints} from './helpers/solid-surface.mjs';
const model = createAuthoredPersonTreadmillMovement({id:377});
const data = model.root.userData, b = data.blocks;
function rectangle(mesh) {
  const p = mesh.geometry.attributes.position, points = [];
  for (let i=0;i<p.count;i++) points.push(new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld));
  return {points, axes:[new T.Vector3(1,0,0),new T.Vector3(0,1,0)].map(a=>a.transformDirection(mesh.matrixWorld))};
}
// Exact separating-axis test for these finite rectangular parts, all rotating
// about Z. Their axial intervals overlap, so XY separation is required.
function separatingGap(x,y) {
  let gap = -Infinity;
  for (const axis of [...x.axes,...y.axes]) {
    const a=x.points.map(p=>p.dot(axis)), c=y.points.map(p=>p.dot(axis));
    gap=Math.max(gap,Math.min(...a)-Math.max(...c),Math.min(...c)-Math.max(...a));
  }
  return gap;
}
test('377 finite soles and legs clear all boards throughout 1401 wheel poses',()=>{
  let minimum=Infinity, planted=0;
  for(let i=0;i<=1400;i++) {
    model.update(4*i/1400); model.root.updateMatrixWorld(true);
    const boards=b.treadBoards.map(rectangle);
    for(const part of b.feet) {
      const actual=rectangle(part);
      for(const board of boards) {
        const gap=separatingGap(actual,board); minimum=Math.min(minimum,gap);
        assert.ok(gap>=-2e-7,`${part.userData.role} penetrates board at ${i}: ${gap}`);
      }
    }
    // The continuous trouser legs bend at the knee, so each actual vertex is
    // tested against every board's finite box instead.
    if(i%4===0)for(const leg of b.legs)for(const board of b.treadBoards) {
      const box=board.geometry.boundingBox??(board.geometry.computeBoundingBox(),board.geometry.boundingBox);
      const toBoard=board.matrixWorld.clone().invert().multiply(leg.matrixWorld),p=leg.geometry.attributes.position,q=new T.Vector3();
      for(let k=0;k<p.count;k++){q.fromBufferAttribute(p,k).applyMatrix4(toBoard);assert.ok(!box.containsPoint(q),`trouser leg penetrates board at ${i}`);}
    }
    assert.ok(data.currentState.legStates.some(s=>s.planted),'at least one supporting foot');
    for(let j=0;j<2;j++) {
      const state=data.currentState.legStates[j]; if(!state.planted)continue;
      planted++;
      const board=b.treadBoards[state.treadIndex], foot=b.feet[j];
      // The actual sole corners, not nominal ankle metadata, lie just above
      // the working face and within its finite radial and axial extents.
      for(const x of [-.14,.14])for(const z of[-.055,.055]) { // the sole's corners
        const p=board.worldToLocal(foot.localToWorld(new T.Vector3(x,-.05,z)));
        assert.ok(Math.abs(p.y-.053)<1e-7,'sole/board fit');
        assert.ok(Math.abs(p.x)<.180001 && Math.abs(p.z)<1.102001,'sole is supported by board');
      }
    }
  }
  assert.ok(planted>1400); console.log({minimumBoardGap:minimum,plantedChecks:planted});
});
test('377 free feet and trouser legs clear the body and rail, without deforming limb lengths',()=>{
  const cache=new Map(); const get=o=>{if(!cache.has(o))cache.set(o,{s:solidSurface(o.geometry),p:surfacePoints(o.geometry)});return cache.get(o);};
  for(let i=0;i<=280;i++) {
    model.update(4*i/280);model.root.updateMatrixWorld(true);
    for(const a of b.feet)for(const c of [b.torso,b.handRail])for(const[x,y]of[[a,c],[c,a]]) {
      const matrix=y.matrixWorld.clone().invert().multiply(x.matrixWorld);
      for(const p of get(x).p){const distance=get(y).s.signedDistance(p.clone().applyMatrix4(matrix));assert.ok(distance>=-2e-6,`${i}: ${a.userData.role}/${c.userData.role} ${distance}`);}
    }
    // The bending trouser legs' actual vertices stay out of the jacket and rail.
    if(i%4===0)for(const leg of b.legs)for(const c of [b.torso,b.handRail]) {
      const matrix=c.matrixWorld.clone().invert().multiply(leg.matrixWorld),p=leg.geometry.attributes.position,q=new T.Vector3();
      for(let k=0;k<p.count;k++){const distance=get(c).s.signedDistance(q.fromBufferAttribute(p,k).applyMatrix4(matrix));assert.ok(distance>=-2e-6,`${i}: ${leg.userData.role}/${c.userData.role} ${distance}`);}
    }
    for(let j=0;j<2;j++) {
      const hip=b.legRoots[j].getWorldPosition(new T.Vector3());
      const knee=b.kneePivots[j].getWorldPosition(new T.Vector3());
      // Brown's long legs: 0.74 thigh and 0.70 shin.
      const ankle=b.kneePivots[j].localToWorld(new T.Vector3(0,-data.geometry.lowerLegLength,0));
      assert.ok(Math.abs(data.geometry.upperLegLength-.74)<1e-12&&Math.abs(data.geometry.lowerLegLength-.70)<1e-12);
      assert.ok(Math.abs(hip.distanceTo(knee)-data.geometry.upperLegLength)<1e-12);
      assert.ok(Math.abs(knee.distanceTo(ankle)-data.geometry.lowerLegLength)<1e-12);
    }
  }
});
test('377 touchdown and lift-off preserve joint position and velocity in both time directions',()=>{
  const g=data.geometry, step=1e-7;
  const offset=(g.gaitGeometry.touchdownAngle-g.wheelStartAngle-g.treadPitch)/(2*g.treadPitch);
  for(const index of[0,1])for(let cycle=-2;cycle<=8;cycle++)for(const edge of[0,.60]) {
    const time=(cycle+edge-offset-index/2)*g.wheelPeriod/7;
    const before=data.stateAtTime(time-step).legStates[index],after=data.stateAtTime(time+step).legStates[index];
    for(const name of['upperAngle','lowerAngle'])assert.ok(Math.abs(after[name]-before[name])<1e-5,`${name} jumps`);
    for(const name of['upperAngularSpeed','lowerAngularSpeed'])assert.ok(Math.abs(after[name]-before[name])<.001,`${name} jumps`);
  }
});

test('377 each trouser leg is one continuous surface from hip to shoe: it follows the knee pivot and its cuff reaches the shoe',()=>{
  for(let i=0;i<=64;i++) {
    model.update(4*i/64);model.root.updateMatrixWorld(true);
    for(let j=0;j<2;j++) {
      const leg=b.legs[j],p=leg.geometry.attributes.position,q=new T.Vector3();
      // The bent mesh reaches the ankle: its lowest cuff point lies within the
      // cuff radius of the ankle, and the shoe's top sits inside that cuff.
      const ankle=leg.worldToLocal(b.kneePivots[j].localToWorld(new T.Vector3(0,-data.geometry.lowerLegLength,0)));
      let nearest=Infinity;for(let k=0;k<p.count;k++)nearest=Math.min(nearest,q.fromBufferAttribute(p,k).distanceTo(ankle));
      assert.ok(nearest<.065,`cuff reaches the ankle: ${nearest}`);
      const shoeTop=leg.worldToLocal(b.feet[j].localToWorld(new T.Vector3(0,.015,0)));
      assert.ok(shoeTop.distanceTo(ankle)<.06,'shoe top lies inside the trouser cuff');
    }
  }
});
