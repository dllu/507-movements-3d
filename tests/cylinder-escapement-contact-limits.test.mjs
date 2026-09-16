import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createAuthoredCylinderEscapementMovement as create} from '../src/simulation/authored-cylinder-escapements.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0],sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
function polygon(mesh,points){return points.map(p=>{const v=new T.Vector3(Math.fround(p[0]),Math.fround(p[1]),0).applyMatrix4(mesh.matrixWorld);return[v.x,v.y];});}
function closest(A,B){let best={gap:Infinity};for(const[points,edges,swap]of[[A,B,false],[B,A,true]])for(let i=0;i<points.length;i++){const p=points[i];for(let j=0;j<edges.length;j++){const a=edges[j],b=edges[(j+1)%edges.length],v=sub(b,a),u=Math.max(0,Math.min(1,dot(sub(p,a),v)/dot(v,v))),q=[a[0]+u*v[0],a[1]+u*v[1]],gap=Math.hypot(...sub(p,q));if(gap<best.gap)best={gap,a:swap?q:p,b:swap?p:q};}}return best;}
function supports(points,p,n){const distance=points.map(q=>Math.hypot(...sub(q,p))),i=distance.indexOf(Math.min(...distance));if(distance[i]<1e-6){for(const j of[(i+points.length-1)%points.length,(i+1)%points.length])assert.ok(dot(sub(points[j],p),n)<1e-6,'actual vertex reaction belongs to its supporting normal cone');}}

test('294 finite actual tooth, stems and shell clear all neighbors through both impulses and drops',()=>{
 const m=create({id:294}),d=m.root.userData,b=d.blocks,shell=b.workingShell,solid=solidSurface(shell.geometry),shellPoints=surfacePoints(shell.geometry),headSolid=solidSurface(b.palletHeads[0].geometry),cache=new Map();let minimum=1,queries=0;
 for(let i=0;i<=128;i++){m.update(i/128*4);m.root.updateMatrixWorld(true);for(const part of[...b.palletHeads,...b.palletStems]){if(!cache.has(part.geometry))cache.set(part.geometry,surfacePoints(part.geometry));const tr=shell.matrixWorld.clone().invert().multiply(part.matrixWorld);for(const point of cache.get(part.geometry)){const local=point.clone().applyMatrix4(tr);if(solid.box.distanceToPoint(local)>.01)continue;const gap=solid.signedDistance(local,.1);minimum=Math.min(minimum,gap);queries++;assert.ok(gap>=-2e-6,`${i} ${part.userData.index} ${gap}`);}if(b.palletHeads.includes(part)){const back=part.matrixWorld.clone().invert().multiply(shell.matrixWorld);for(const point of shellPoints){const local=point.clone().applyMatrix4(back);if(headSolid.box.distanceToPoint(local)>.01)continue;const gap=headSolid.signedDistance(local,.1);minimum=Math.min(minimum,gap);queries++;assert.ok(gap>=-2e-6,`${i} reverse ${part.userData.index} ${gap}`);}}}}
 assert.ok(minimum>.0005);console.log({minimum,queries});
});

test('294 actual nearest finite pairs support both opposed impulses and loaded inner/outer locking directions',()=>{
 const m=create({id:294}),d=m.root.userData,b=d.blocks,data=d.cylinderContactBake;
 for(const[q,kind]of[[.1,'outer'],[.22,'entry'],[.25,'entry'],[.5,'inner'],[.74,'exit'],[.78,'exit'],[.9,'outer']]){m.update(q*4);m.root.updateMatrixWorld(true);const shell=polygon(b.workingShell,data.shell);let pair={gap:Infinity},tooth;
  for(const head of b.palletHeads){const p=polygon(head,data.head),c=closest(p,shell);if(c.gap<pair.gap){pair=c;tooth=p;}}
  const n=sub(pair.a,pair.b).map(v=>v/pair.gap),wheelRadius=sub(pair.a,d.geometry.wheelCenter.toArray()),cylinderRadius=sub(pair.b,d.geometry.cylinderCenter.toArray()),wm=cross(wheelRadius,n),cm=-cross(cylinderRadius,n);
  assert.ok(pair.gap>.0005&&pair.gap<.0012);assert.ok(wm>1);supports(tooth,pair.a,n.map(v=>-v));supports(shell,pair.b,n);
  if(kind==='entry')assert.ok(cm<-.2);else if(kind==='exit')assert.ok(cm>.2);else assert.ok(Math.abs(cm)<.012);
  console.log({q,kind,gap:pair.gap,wheelMoment:wm,cylinderMoment:cm});
 }
});

test('294/295 closed C1 baked motion has finite drops and preserves buffers without force-validation claims',()=>{
 for(const id of[294,295]){const m=create({id}),d=m.root.userData,arrays=[];m.root.traverse(o=>{if(o.geometry)arrays.push([o.geometry,o.geometry.attributes.position.array]);});
  for(const q of[0,1,...d.cylinderContactBake.knots]){const a=d.stateAtTime((q-1e-8)*4),z=d.stateAtTime((q+1e-8)*4);assert.ok(Math.abs(a.wheelAngle-z.wheelAngle)<1e-5);assert.ok(Math.abs(a.balanceAngle-z.balanceAngle)<1e-5);assert.ok(Math.abs(a.wheelAngularSpeed-z.wheelAngularSpeed)<.0001);assert.ok(Math.abs(a.balanceAngularSpeed-z.balanceAngularSpeed)<.0001);}
  for(let i=0;i<=64;i++)m.update(i/16);for(const[g,a]of arrays)assert.equal(g.attributes.position.array,a);
  assert.equal(d.finiteContactReview.noPassiveForceValidation,true);assert.equal(d.transmission.geometricOppositeImpulses,true);assert.match(d.reconstructionNote,/running clearance/);
  assert.ok(d.cylinderContactBake.qualification.maxOverlapArea<1e-12);assert.equal(d.cylinderContactBake.dropIntervals.length,2);
 }
});
