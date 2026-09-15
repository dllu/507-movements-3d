import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {waveCamGeometry,waveCamTraceY} from '../src/simulation/mujoco-wave-cam/profile.js';
import {waveCamProjectedHeight} from '../src/simulation/mujoco-wave-cam/projected-profile.js';
import {makeWaveCamSolids} from '../src/simulation/mujoco-wave-cam/solids.js';
import {solidSurface} from './helpers/solid-surface.mjs';

test('165 complete-depth profile preserves the traced front outline outside the roller',()=>{
 const g=waveCamGeometry();
 for(let i=0;i<=1024;i++){
  const x=-g.outerRadius+2*g.outerRadius*i/1024,dx=x-g.rollerX,raw=g.topY+(177-waveCamTraceY(g.axisPixelX+x/g.scale))*g.scale,height=waveCamProjectedHeight(x,g);
  if(Math.abs(dx)>=g.rollerRadius)assert.ok(Math.abs(raw-height)<1e-12);
  else assert.ok(height>=g.rollerY+Math.sqrt(g.rollerRadius**2-dx**2)-1e-12);
 }
});

test('165 visible cam is a closed outward-facing rim with a separate top web',()=>{
 const v=makeWaveCamSolids();try{
  const p=v.root.userData.parts,surface=solidSurface(p.wavedCam.geometry);
  assert.ok(surface.inside(new THREE.Vector3(0,3.8,2.72)));
  assert.ok(!surface.inside(new THREE.Vector3(0,2,2.72)));
  assert.ok(!surface.inside(new THREE.Vector3(0,3.8,0)));
  assert.equal(Object.keys(p).length,13);
  assert.ok(v.root.userData.hideGround);
  for(const mesh of Object.values(p))assert.equal(mesh.material.fog,false);
 }finally{v.dispose();}
});
