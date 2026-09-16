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

test('421 finite trunk, piston and pitman clear the coaxial gland and fixed head throughout the stroke',()=>{
  const model=builders[0]({id:421}),{root}=model,{blocks:b}=root.userData;
  const trunkSides=[];root.traverse(o=>{if(o.userData.role==='cutaway-side-of-hollow-trunk-attached-to-piston')trunkSides.push(o);});
  const head=[];root.traverse(o=>{if(o.userData.role==='fixed-cylinder-head-half-around-trunk-opening')head.push(o);});
  audit(model,[...head.flatMap(h=>[...trunkSides,b.trunkTopRim,b.piston].map(p=>[p,h])),...trunkSides.map(s=>[s,b.stuffingBox]),[b.trunkTopRim,b.stuffingBox],
    ...trunkSides.map(s=>[s,b.pitman]),[b.trunkTopRim,b.pitman],[b.stuffingBox,b.pitman],[b.piston,b.pitman]]);
  for(let i=0;i<=32;i++) {
    model.update(i/8);root.updateMatrixWorld(true);
    const centers=b.pitman.geometry.userData.bores.map(p=>b.pitman.localToWorld(new THREE.Vector3(p.x,p.y,0)));
    const pin=b.pistonPinMarker.getWorldPosition(new THREE.Vector3());
    assert.ok(Math.hypot(centers[1].x-pin.x,centers[1].y-pin.y)<1e-12);
    assert.equal(b.pistonAndTrunk.position.z,b.stuffingBox.position.z);
  }
});

test('422 finite vane and seal clear sector walls, and slide valve clears its real chest opening',()=>{
  const model=builders[1]({id:422}),{root}=model,{blocks:b}=root.userData;
  const endWalls=['clockwise','counterclockwise'].map(s=>role(root,`${s}-end-wall-of-sector-cylinder-A`));
  const vane=role(root,'radial-oscillating-piston-B'),seal=role(root,'outer-sealing-head-of-piston-B');
  const chest=role(root,'fixed-valve-D-chest'),block=role(root,'working-block-of-slide-valve-D');
  audit(model, [ ...[vane,seal].flatMap(p=>[b.outerArc,...endWalls].map(w=>[p,w])),
    [block,chest],[role(root,'external-stem-of-slide-valve-D'),chest],
    [block,role(root,'horizontal-guide-for-slide-valve-D')]]);
});

test('423 bored rods occupy separate planes, engage the same crank pin and clear finite piston housings',()=>{
  const model=builders[2]({id:423}),{root}=model,{blocks:b}=root.userData;
  audit(model,[[b.topConnectingRod,b.bottomConnectingRod],
    ...['top','bottom'].flatMap(s=>[
      [b[`${s}PistonArm`],b[`${s}EndWall`]],[b[`${s}PistonSeal`],b[`${s}EndWall`]],
      [b[`${s}PistonSeal`],b[`${s}CylinderWall`]],[b[`${s}ConnectingRod`],b.commonCrankPin],
      [b[`${s}ConnectingRod`],b[`${s}PistonSeal`]],[b[`${s}ConnectingRod`],b.crankArm],
      [role(root,`${s}-bored-piston-hub`),b[`${s}PivotShaft`]]
    ])]);
  for(let i=0;i<=32;i++) {
    model.update(i/8);root.updateMatrixWorld(true);
    const pin=b.commonCrankPin.getWorldPosition(new THREE.Vector3());
    for(const rod of [b.topConnectingRod,b.bottomConnectingRod]) {
      const center=rod.localToWorld(new THREE.Vector3());
      assert.ok(Math.hypot(pin.x-center.x,pin.y-center.y)<1e-12);
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
