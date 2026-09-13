import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {cubicPolyline} from '../src/simulation/cubic-polyline.js';
import {tracedRatchetProfile} from '../scripts/lib/spring-ratchet-traced-profile.mjs';

test('source ratchet flanks retain corners with a subpixel chord error', t => {
  const tolerance=.1;
  let vertices=0,maximumDistance=0,maximumErrorBound=0;
  for (const control of tracedRatchetProfile.flanks) {
    const result=cubicPolyline(control,tolerance),{points}=result;
    assert.deepEqual(points[0],control[0]);assert.deepEqual(points.at(-1),control[3]);
    vertices+=points.length;maximumErrorBound=Math.max(maximumErrorBound,result.maximumErrorBound);
    const curve=new THREE.CubicBezierCurve(...control.map(p=>new THREE.Vector2(...p)));
    const lines=points.slice(1).map((p,i)=>new THREE.Line3(new THREE.Vector3(...points[i],0),new THREE.Vector3(...p,0)));
    const nearest=new THREE.Vector3();
    for (let i=0;i<=2000;i++) {
      const p=curve.getPoint(i/2000),v=new THREE.Vector3(p.x,p.y,0);
      maximumDistance=Math.max(maximumDistance,Math.min(...lines.map(line=>v.distanceTo(line.closestPointToPoint(v,true,nearest)))));
    }
  }
  assert(maximumDistance<=tolerance);assert(maximumErrorBound<=tolerance);
  assert(vertices<10*129/2,'subpixel curves should not need the former dense uniform sampling');
  t.diagnostic(JSON.stringify({vertices,maximumDistance,maximumErrorBound}));
});

test('curve flattening preserves an excursion beyond coincident endpoints', () => {
  const {points}=cubicPolyline([[0,0],[3,0],[3,0],[0,0]],.01);
  assert(Math.max(...points.map(p=>p[0]))>=2.25-.01);
  assert.deepEqual(points.at(-1),[0,0]);
  for (const tolerance of [0,-1,NaN,Infinity]) assert.throws(()=>cubicPolyline([[0,0],[1,1],[2,1],[3,0]],tolerance),RangeError);
});
