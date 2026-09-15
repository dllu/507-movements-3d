import test from 'node:test';
import assert from 'node:assert/strict';
import {makeWaveCamContactSolver} from '../src/simulation/mujoco-wave-cam/quasistatic.js';
import {waveCamSampledGap} from '../src/simulation/mujoco-wave-cam/clearance.js';

test('165 equal sinusoidal lobes admit the same seated roller pose',()=>{
 const solver=makeWaveCamContactSolver({margin:0}),s=solver.solve(0),g=solver.geometry;
 for(let i=1;i<=g.lobes;i++)assert.ok(Math.abs(solver.solve(i*2*Math.PI/g.lobes).rocker-s.rocker)<1e-10);
 assert.ok(Math.hypot(s.rollerCenter[0]-g.rollerX,s.rollerCenter[1]-g.rollerY)<.02);
});

test('165 quasi-static follower clears independent finite-roller samples and closes its loop',()=>{
 const solver=makeWaveCamContactSolver();
 for(let i=0;i<=48;i++){
  const s=solver.solve(2*Math.PI*i/48),gap=waveCamSampledGap(s,{samples:2048,profileType:'radial'}).gap;
  assert.ok(gap>.0059&&gap<.0064,'seated within the numerical clearance allowance');
  assert.ok(Math.abs(s.residual)<2e-10);
 }
 assert.ok(Math.abs(solver.solve(0).outputY-solver.solve(2*Math.PI).outputY)<1e-10);
});

test('165 does not miss an interior minimum beside the annulus edge',()=>{
 const coarse=makeWaveCamContactSolver({samples:128}),fine=makeWaveCamContactSolver({samples:1024});
 const a=.17738328778879336,b=.17738338141555043;
 for(const angle of [a,b])assert.ok(Math.abs(coarse.solve(angle).rocker-fine.solve(angle).rocker)<1e-9);
 assert.ok(Math.abs(coarse.solve(a).rocker-coarse.solve(b).rocker)<1e-6);
});
