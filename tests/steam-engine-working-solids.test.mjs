import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createAuthoredTrunkEngineMovement } from '../src/simulation/authored-trunk-engines.js';
import { createAuthoredSectorPistonEngineMovement } from '../src/simulation/authored-sector-piston-engines.js';
import { createAuthoredDoubleQuadrantEngineMovement } from '../src/simulation/authored-double-quadrant-engines.js';
import { solidSurface, surfacePoints } from './helpers/solid-surface.mjs';

const builders = [createAuthoredTrunkEngineMovement, createAuthoredSectorPistonEngineMovement, createAuthoredDoubleQuadrantEngineMovement];
const role = (root, name) => {
  let result; root.traverse(o => { if(o.userData.role === name) result=o; });
  assert.ok(result, name); return result;
};
function audit(model, pairs) {
  const surfaces = new Map(), points = new Map();
  const prepare = mesh => {
    if(!surfaces.has(mesh)) {
      surfaces.set(mesh, solidSurface(mesh.geometry));
      const all=surfacePoints(mesh.geometry);
      points.set(mesh, all.filter((_, i) => i % Math.max(1, Math.floor(all.length / 600)) === 0));
    }
  };
  pairs.flat().forEach(prepare);
  for(let i=0;i<=64;i++) {
    model.update(i * model.root.userData.animationTiming.authoredCyclePeriod / 64);
    model.root.updateMatrixWorld(true);
    for(const [a,b] of pairs) for(const [from,to] of [[a,b],[b,a]]) {
      const transform=to.matrixWorld.clone().invert().multiply(from.matrixWorld);
      let minimum=Infinity;
      for(const point of points.get(from)) {
        minimum=Math.min(minimum,surfaces.get(to).signedDistance(point.clone().applyMatrix4(transform),.01));
      }
      assert.ok(minimum>=-2e-5, `${i}: ${from.userData.role} in ${to.userData.role}: ${minimum}`);
    }
  }
}

test('421 finite trunk piston, closed under its pin, clears the head, gland, bottom and pitman throughout the stroke',()=>{
  const model=builders[0]({id:421}),{root}=model,{blocks:b}=root.userData;
  audit(model,[[b.trunkBack,b.upperHead],[b.piston,b.upperHead],[b.trunkBack,b.stuffingBox],[b.piston,b.lowerFlange],
    [b.trunkBack,b.pitman],[b.piston,b.pitman],[b.pistonPinMarker,b.pitman],[b.stuffingBox,b.pitman],[b.backShell,b.piston]]);
  for(let i=0;i<=32;i++) {
    model.update(i/8);root.updateMatrixWorld(true);
    const centers=b.pitman.geometry.userData.bores.map(p=>b.pitman.localToWorld(new THREE.Vector3(p.x,p.y,0)));
    const pin=b.pistonPinMarker.getWorldPosition(new THREE.Vector3());
    assert.ok(Math.hypot(centers[1].x-pin.x,centers[1].y-pin.y)<1e-12);
  }
});

test('422 vane B clears casing A through its swing and valve D clears its chest, rod bore and gland',()=>{
  const model=builders[1]({id:422}),{root}=model,{blocks:b}=root.userData;
  audit(model,[[b.pistonB,b.casingA],[b.pistonB,b.backCover],[b.valveBody,b.casingA],[b.valveBody,b.chestRodWall],
    [b.valveRod,b.chestRodWall],[b.valveRod,b.gland],[b.shaftC,b.backCover],[b.shaftC,b.casingA]]);
});

test('423 pistons, rods, crank and valve plug clear the casing and each other, and both rods share one crank pin',()=>{
  const model=builders[2]({id:423}),{root}=model,{blocks:b}=root.userData;
  const top=b.topPiston,bottom=b.bottomPiston;
  audit(model,[[top.vane,b.casing],[bottom.vane,b.casing],[top.lug,b.casing],[bottom.lug,b.casing],[b.plug,b.casing],
    [b.topRod,b.bottomRod],[b.topRod,top.vane],[b.bottomRod,bottom.vane],[b.topRod,bottom.vane],[b.bottomRod,top.vane],
    [b.topRod,top.lug],[b.bottomRod,bottom.lug],[b.topRod,bottom.lug],[b.bottomRod,top.lug],
    [top.vane,bottom.vane],[top.lug,bottom.lug]]);
  for(let i=0;i<=32;i++) {
    model.update(i/8);root.updateMatrixWorld(true);
    const pin=role(root,'common-crank-pin-of-both-rods').getWorldPosition(new THREE.Vector3());
    for(const rod of [b.topRod,b.bottomRod]) {
      const center=rod.localToWorld(new THREE.Vector3());
      assert.ok(Math.hypot(pin.x-center.x,pin.y-center.y)<1e-9);
    }
  }
});

test('all three engine cutaways use full-cycle framing and no ground or fog',()=>{
  for(let i=0;i<3;i++) {
    const model=builders[i]({id:421+i}),data=model.root.userData;
    assert.equal(data.hideGround,true); assert.equal(data.cameraFov,8);
    assert.ok(model.cameraDirection.z>10);
    model.root.traverse(o=>{for(const m of [].concat(o.material??[]))assert.equal(m.fog,false);});
  }
});
