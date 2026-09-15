import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {kneePressGeometry,kneePressState,kneePressAtAngle} from '../src/simulation/knee-press-motion.js';
import {makeKneePress} from '../src/simulation/knee-press.js';
test('164 source linkage keeps both lengths and the vertical upper guide',()=>{
 const g=kneePressGeometry(),a=Math.hypot(...g.upper);let min=Infinity,max=-Infinity;
 for(let i=0;i<=1000;i++){const s=kneePressState(g.period*i/1000,g);assert.ok(Math.abs(Math.hypot(s.knee[0]-s.top[0],s.knee[1]-s.top[1])-a)<1e-12);assert.ok(Math.abs(Math.hypot(s.knee[0]-s.foot[0],s.knee[1]-s.foot[1])-g.lowerLength)<1e-12);assert.equal(s.top[0],g.top[0]);assert.ok(s.angle<g.straightAngle);min=Math.min(min,s.top[1]);max=Math.max(max,s.top[1]);}
 assert.ok(max-min>.09&&max-min<.12);assert.ok(kneePressState(g.period/2,g).topSlope>0);
 const open=kneePressAtAngle(0,g),closed=kneePressAtAngle(g.closedAngle,g);assert.ok(Math.abs(closed.handleSlope/closed.topSlope)>10*Math.abs(open.handleSlope/open.topSlope));
});
test('164 source-shaped solids follow the analytic joints, fit bounds and restart exactly',()=>{
 const v=makeKneePress(),g=v.root.userData.geometry;try{
  const initial=JSON.stringify(v.root.userData.state);v.root.traverse(o=>{if(o.isMesh)assert.equal(o.material.fog,false);});assert.equal(v.root.userData.hideGround,true);
  for(let i=0;i<129;i++){v.update(g.period*(i+.371)/129);const s=v.root.userData.state,pin=v.root.getObjectByName('kneePin').getWorldPosition(new THREE.Vector3());assert.ok(pin.distanceTo(new THREE.Vector3(...s.knee,0))<1e-12);assert.ok(v.root.userData.cameraFitBounds.containsBox(new THREE.Box3().setFromObject(v.root,true)));}
  v.reset();assert.equal(JSON.stringify(v.root.userData.state),initial);
 }finally{v.dispose();}
});
