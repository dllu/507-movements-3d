import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import loadMujoco from '@mujoco/mujoco';
import {makeRigidPlateContact} from '../src/simulation/mujoco/plate-contact.js';
import {createMujocoSimulation} from '../src/simulation/mujoco/simulation.js';
import {plate,poly,polygonClipping as clip} from '../src/simulation/finite-plate-geometry.js';
import {inspectWeightedClutchSolid} from '../scripts/lib/weighted-clutch-solid-audit.mjs';

const mujoco = await loadMujoco();

test('rigid plate contact preserves a hole and concave notch through body rotation', t => {
  const outline = poly([[-1,-1],[1,-1],[1,0],[.5,0],[.5,.5],[1,.5],[1,1],[-1,1]]);
  const hole = poly([[-.2,-.2],[.2,-.2],[.2,.2],[-.2,.2]]);
  const geometry = plate(clip.difference(outline,hole),-.1,.1);
  const contact = makeRigidPlateContact({name:'plate',body:'plate',geometry,
    contact:{mask:1,other:2,friction:.5,time:.002,impedance:.999}});
  let physics;
  try {
    physics = createMujocoSimulation(mujoco,{xml:`<mujoco><compiler angle="radian"/>
      <option gravity="0 0 0"/>
      <worldbody><body name="plate"><joint name="angle" axis="0 0 1"/>
        <inertial pos="0 0 0" mass="1" diaginertia="1 1 1"/></body>
        <body name="probe"><freejoint/><geom type="sphere" size=".05" contype="2" conaffinity="1"/></body>
      </worldbody><deformable>${contact.xml}</deformable></mujoco>`});
    const {model,data} = physics;
    assert.equal(model.nq,8,'the plate flex adds no coordinates');assert.equal(model.nflex,1);
    const nativeFaces = Array.from({length:model.flex_shellnum[0]},(_,i)=>
      Array.from(model.flex_shell.slice(model.flex_shelldataadr[0]+3*i,model.flex_shelldataadr[0]+3*i+3)));
    const key = f => [...f].sort((a,b)=>a-b).join(',');
    assert.deepEqual(nativeFaces.map(key).sort(),contact.faces.map(key).sort());
    const shell = new THREE.BufferGeometry();
    shell.setAttribute('position',new THREE.Float32BufferAttribute(contact.vertices,3));
    shell.setIndex(nativeFaces.flat());shell.computeVertexNormals();
    const solid = inspectWeightedClutchSolid(shell);shell.dispose();
    assert.equal(solid.components,1);
    for (const field of ['degenerate','wrongNormals','nonfinite','unmatchedEdges']) assert.equal(solid[field],0,field);
    assert.ok(Math.abs(contact.volume-(4-.25-.16)*.2)<1e-7);
    assert.ok(Math.abs(solid.volume-contact.volume)<1e-10);
    for (const angle of [0,.73]) {
      data.qpos[0]=angle;
      for (const {point,touch,label,normal} of [
        {point:[0,0,0],touch:false,label:'shaft hole'},
        {point:[.75,.25,0],touch:false,label:'concave notch'},
        {point:[-.5,.5,.13],touch:true,label:'plate face',normal:[0,0,1]},
        {point:[.17,0,0],touch:true,label:'hole wall',normal:[1,0,0]},
        {point:[.53,.25,0],touch:true,label:'notch wall',normal:[1,0,0]},
      ]) {
        const rotated = new THREE.Vector3(...point).applyAxisAngle(new THREE.Vector3(0,0,1),angle);
        data.qpos.set(rotated.toArray(),1);mujoco.mj_forward(model,data);
        assert.equal(data.ncon>0,touch,`${label}, angle ${angle}`);
        if (touch) {
          const expected = new THREE.Vector3(...normal).applyAxisAngle(new THREE.Vector3(0,0,1),angle);
          const contacts = data.contact;
          try {
            for (let i = 0; i < contacts.size(); i++) {
              const c = contacts.get(i);
              try {assert.ok(Math.abs(expected.dot(new THREE.Vector3().fromArray(c.frame)))>1-1e-10,
                `${label} contact must use the exterior normal`);} finally {c.delete();}
            }
          } finally {contacts.delete();}
        }
      }
      for (let i = 0; i < contact.vertices.length; i+=3) {
        const expected = new THREE.Vector3().fromArray(contact.vertices,i).applyAxisAngle(new THREE.Vector3(0,0,1),angle);
        assert.ok(expected.distanceTo(new THREE.Vector3().fromArray(data.flexvert_xpos,i))<1e-10);
      }
    }
    t.diagnostic(JSON.stringify({vertices:model.nflexvert,tetrahedra:contact.tetrahedra.length,volume:contact.volume}));
  } finally {physics?.dispose();geometry.dispose();}
});
