import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import {makeBeamSurface} from '../src/simulation/mujoco/beam-surface.js';
import {createMujocoSimulation} from '../src/simulation/mujoco/simulation.js';
import {inspectWeightedClutchSolid} from '../scripts/lib/weighted-clutch-solid-audit.mjs';

const mujoco = await loadMujoco();
const key = triangle => [...triangle].sort((a,b)=>a-b).join(',');

test('a refined oblique beam end stays closed and matches the native flex boundary', t => {
  const rows = [];
  for (const count of [8,24,48]) {
    const length = 1/count, points = Array.from({length:count+1},(_,i)=>new THREE.Vector3(i*length,0,0));
    const frames = Array.from({length:count},()=>({length,quaternion:new THREE.Quaternion()}));
    const endNormal = new THREE.Vector3(.5,1,0).normalize();
    const surface = makeBeamSurface({name:'leaf',points,frames,depth:.2,
      widths:points.map((_,i)=>.12-.04*i/count),endNormal,
      contact:{mask:2,other:4,friction:.5,time:.002,impedance:.999}});
    let bodies = '';
    for (let i = 0; i < count; i++) bodies += `<body name="leaf${i}" pos="${i ? length : 0} 0 0">
      <joint axis="0 0 1" stiffness="10"/><inertial pos="${length/2} 0 0" mass=".01" diaginertia=".001 .001 .001"/>`;
    bodies += '</body>'.repeat(count);
    let physics;
    try {
      physics = createMujocoSimulation(mujoco,{xml:`<mujoco><compiler angle="radian"/>
        <worldbody>${bodies}</worldbody><deformable>${surface.xml}</deformable></mujoco>`});
      const {model,data} = physics;
      assert.equal(model.nq,count,'contact volume must not add coordinates');
      assert.equal(model.nflex,1);
      const nativeFaces = Array.from({length:model.flex_shellnum[0]},(_,i)=>
        Array.from(model.flex_shell.slice(model.flex_shelldataadr[0]+3*i,model.flex_shelldataadr[0]+3*i+3)));
      assert.deepEqual(nativeFaces.map(key).sort(),surface.faces.map(key).sort());
      const cap = Array.from(data.flexvert_xpos.slice(-12));
      for (let i = 0; i < 4; i++) assert.ok(Math.abs(new THREE.Vector3().fromArray(cap,3*i).dot(endNormal)-endNormal.x) < 1e-10);
      for (let i = 0; i < data.qpos.length; i++) data.qpos[i] = .025*Math.sin(i*.5);
      mujoco.mj_forward(model,data);surface.update(data.flexvert_xpos,model.flex_vertadr[0]);
      assert.ok(surface.minimumVolumeRatio > .9,'small bending must not invert terminal elements');
      const p = surface.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) for (let k = 0; k < 3; k++)
        assert.ok(Math.abs(p.array[3*i+k]-data.flexvert_xpos[3*surface.renderVertexIds[i]+k]) < 1e-7);
      const solid = inspectWeightedClutchSolid(surface.geometry);
      assert.equal(solid.components,1);assert.ok(solid.volume>0);
      for (const field of ['degenerate','wrongNormals','nonfinite','unmatchedEdges']) assert.equal(solid[field],0,field);
      rows.push({count,vertices:model.nflexvert,capLength:surface.capLength,minimumVolumeRatio:surface.minimumVolumeRatio});
    } finally {physics?.dispose();surface.geometry.dispose();}
  }
  t.diagnostic(JSON.stringify(rows));
  for (const row of rows) assert.ok(Math.abs(row.capLength-.12)<1e-12,'cap span must be independent of cell count');
});
