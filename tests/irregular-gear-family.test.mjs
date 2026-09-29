import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createAuthoredGearMovement} from '../src/simulation/authored-gears.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';
const catalog=JSON.parse(fs.readFileSync('src/data/movements.json')).movements,create=id=>createAuthoredGearMovement(catalog[id-1]);
const clear=(a,b)=>{const surface=solidSurface(b.geometry),matrix=b.matrixWorld.clone().invert().multiply(a.matrixWorld);for(const p of surfacePoints(a.geometry)){const q=p.clone().applyMatrix4(matrix);assert.ok(!surface.inside(q)||surface.distance(q)<1e-6,`${a.userData.role} into ${b.userData.role}`);}};
test('191 and196 render the baked mating contours and disable obsolete tooth overlays',()=>{
 {const b=create(196).root.userData.blocks;assert.equal(b.wheelBody.geometry.userData.toothProfile,'offline-swept-mating-gear-envelope');assert.ok(b.wheelBody.geometry.userData.outline.length>800);assert.ok(b.wheelToothMeshes.every(mesh=>!mesh.visible));}
 // 191: both scrolls are hobbed by one rack, so both render baked contours.
 const b=create(191).root.userData.blocks;
 for(const [body,teeth] of[[b.drivenBody,b.drivenTeeth],[b.driverBody,b.driverTeeth]]){assert.equal(body.geometry.userData.toothProfile,'offline-rack-hobbed-conjugate-scroll');assert.ok(body.geometry.userData.outline.length>2000);assert.ok(teeth.every(mesh=>!mesh.visible));}
});
test('201 driver carries the pinion-generated teeth on a smooth outline and both gears shade smoothly',()=>{
 const m=create(201),g=m.root.userData.geometry,b=m.root.userData.blocks,body=b.eccentricGear.userData.rotor.children[0],pinion=b.pinion.userData.rotor.children[0];
 const u=body.geometry.userData;assert.equal(u.toothProfile,'offline-rolling-pinion-generated-envelope');assert.ok(u.outline.length>1500);
 // Smooth flanks: no stair-step zigzags between neighbouring outline points.
 const o=u.outline.slice(0,-1),turn=i=>{const a=o[(i+o.length-1)%o.length],p=o[i],c=o[(i+1)%o.length],x=[p[0]-a[0],p[1]-a[1]],y=[c[0]-p[0],c[1]-p[1]];return Math.atan2(x[0]*y[1]-x[1]*y[0],x[0]*y[0]+x[1]*y[1]);};
 let zigzags=0,largest=0;for(let i=0;i<o.length;i++){const t=turn(i),n=turn((i+1)%o.length);largest=Math.max(largest,Math.abs(t));if(Math.abs(t)>.09&&Math.abs(n)>.09&&Math.sign(t)!==Math.sign(n))zigzags++;}
 assert.equal(zigzags,0);assert.ok(largest<.35,`outline corner ${largest}`);
 assert.ok(Math.min(...o.map(p=>Math.hypot(...p)))-u.boreRadius>.2,'solid wall round the bore');
 // Brown's 18 teeth: runs of outline beyond the pitch curve.
 const drive=m.root.userData.transmission.irregularDrive,pitch=drive.pitchOutline(4096),outside=p=>{let best=Infinity,k=0;pitch.forEach((q,i)=>{const d=(q.x-p[0])**2+(q.y-p[1])**2;if(d<best){best=d;k=i;}});const n=drive.pitchPoint(2*Math.PI*k/4096).normal;return (p[0]-pitch[k].x)*n.x+(p[1]-pitch[k].y)*n.y>.5*drive.addendum;};
 let teeth=0;const flags=o.map(outside);flags.forEach((f,i)=>{if(f&&!flags[(i+flags.length-1)%flags.length])teeth++;});assert.equal(teeth,18);
 // Both bodies are welded, indexed extrusions whose side walls shade smoothly and caps flat.
 for(const mesh of[body,pinion]){const geo=mesh.geometry,n=geo.attributes.normal;assert.ok(geo.index);let caps=0;for(let i=0;i<n.count;i++)if(Math.abs(n.getZ(i))>.999999)caps++;assert.ok(caps>0);
  for(let i=0;i<n.count;i++){const z=Math.abs(n.getZ(i));assert.ok(z>.999999||z<1e-6,'flat caps meet straight walls');}}
 assert.equal(pinion.geometry.userData.toothProfile,'involute-8-tooth-generating-pinion');
});
test('191 and 196 baked envelopes are smooth: no per-pose stair-step zigzags',()=>{
 const zigzags=outline=>{const o=outline.slice(0,-1),turn=i=>{const a=o[(i+o.length-1)%o.length],p=o[i],c=o[(i+1)%o.length],x=[p[0]-a[0],p[1]-a[1]],y=[c[0]-p[0],c[1]-p[1]];return Math.atan2(x[0]*y[1]-x[1]*y[0],x[0]*y[0]+x[1]*y[1]);};let count=0;for(let i=0;i<o.length;i++){const t=turn(i),n=turn((i+1)%o.length);if(Math.abs(t)>.09&&Math.abs(n)>.09&&Math.sign(t)!==Math.sign(n))count++;}return count;};
 const b196=create(196).root.userData.blocks,b191=create(191).root.userData.blocks;
 assert.equal(zigzags(b196.wheelBody.geometry.userData.outline),0);
 // 191: the seam step is one straight wall topped by a filleted square tooth (p96): no jogs left.
 for(const body of[b191.drivenBody,b191.driverBody])assert.equal(zigzags(body.geometry.userData.outline),0);
 for(const body of[b196.wheelBody,b191.drivenBody,b191.driverBody])assert.ok(body.geometry.index,'welded smooth-shaded extrusion');
});
test('201 finite follower fits its slot at every sampled input pose',()=>{
 const m=create(201),b=m.root.userData.blocks,period=m.root.userData.transmission.inputCyclePeriod;
 const slot=b.carrierBody.userData.slot,r=b.slotFollower.geometry.parameters.radiusTop;assert.equal(r,.125);
 for(let i=0;i<=16;i++){m.update(period*i/16);m.root.updateMatrixWorld(true);
  // The pin's centre, in the bell-crank's frame, stays inside the slot with clearance.
  const c=b.slotFollower.getWorldPosition(new THREE.Vector3()).applyMatrix4(b.carrierBody.matrixWorld.clone().invert());
  assert.ok(Math.abs(c.y)+r<slot.halfWidth-.002,`slot side ${c.y}`);assert.ok(c.x-r>slot.start-slot.halfWidth+.002&&c.x+r<slot.end+slot.halfWidth-.002,`slot end ${c.x}`);
  const z=b.slotFollower.getWorldPosition(new THREE.Vector3()).z,h=b.slotFollower.geometry.parameters.height/2;assert.ok(z-h<slot.low&&z+h>slot.high,'pin spans the eye');}
});
test('196 carrier eye and fixed bearing clear their actual shafts and each other',()=>{
 const m=create(196),b=m.root.userData.blocks;
 for(let i=0;i<=16;i++){m.update(m.root.userData.transmission.cyclePeriod*i/16);m.root.updateMatrixWorld(true);clear(b.carrierPivotPin,b.boredCarrierLink);clear(b.carrierPivotPin,b.carrierBearing);clear(b.wheelShaft.userData.rotor.children[0],b.boredCarrierLink);clear(b.boredCarrierLink,b.carrierBearing);}
});
test('all three models expose the reconstruction limits and hide ground/fog',()=>{
 for(const id of[191,196,201]){const m=create(id);assert.equal(m.root.userData.hideGround,true);assert.ok(m.root.userData.minimumDisplayCycleSeconds>=10);assert.ok(m.root.userData.reconstructionNote.length>100);m.root.traverse(o=>{for(const material of(Array.isArray(o.material)?o.material:[o.material]))if(material)assert.equal(material.fog,false);});}
 assert.match(create(191).root.userData.reconstructionNote,/disengagement.*sudden speed reset/);
});
test('saved audit checks actual rendered finite planar solids at interleaved full-cycle poses',()=>{
 const report=JSON.parse(fs.readFileSync('docs/validation/191-196-201-contact.json'));for(const source of report.sources)assert.equal(createHash('sha256').update(fs.readFileSync(source.file)).digest('hex'),source.sha256,source.file);
 for(const row of report.results){assert.equal(row.poses,513);assert.equal(row.penetratingPoses,0);assert.ok(row.maximumOverlapArea<1e-10);assert.ok(row.maximumGap<(row.id===191?.0105:.0021));assert.ok(row.minimumGap>0);}
});

test('196 strap arm is one flat tapered extrusion and the stand pivot is a plain pin, not a barrel', () => {
  const model = createAuthoredGearMovement({id: 196}), b = model.root.userData.blocks;
  const strap = b.boredCarrierLink;
  assert.equal(strap.userData.role, 'flat-tapered-strap-arm-A-to-stand');
  strap.geometry.computeBoundingBox();
  const size = strap.geometry.boundingBox.getSize(new THREE.Vector3());
  // p102: proportioned from Brown's small eyes (0.115 at A, 0.18 at the stand).
  assert.ok(size.y > 0.35 && size.y < 0.37 && size.z < 0.151, `strap ${size.toArray()}`);
  assert.deepEqual(strap.geometry.userData.eyes, [0.18, 0.115]);
  const eye = new THREE.Box3().setFromObject(b.carrierBearing);
  // p93: pedestal, stand eye and pin stand in the strap's plane, just behind it.
  assert.ok(eye.max.z - eye.min.z < 0.25 && eye.max.z < strap.position.z - 0.075 && eye.min.z > 0, 'stand eye sits just behind the strap');
  const pedestal = new THREE.Box3().setFromObject(b.carrierStandard);
  assert.ok(pedestal.max.z <= eye.max.z && pedestal.min.z > 0, 'pedestal in the arm plane');
  const pin = b.carrierPivotPin.geometry.parameters;
  assert.ok(b.carrierPivotPin.position.z - pin.height / 2 >= eye.min.z - 1e-5, 'pin spans only the eye and strap');
  assert.ok(pin.radiusTop < 0.08 && b.carrierPivotPin.position.z + pin.height / 2 < 0.51);
});

test('p102: 196 wheel A and pinion B are the regular square-tooth conjugate pair', () => {
  const b = createAuthoredGearMovement({id: 196}).root.userData.blocks;
  const pinion = b.pinion.userData.rotor.children[0].geometry.userData;
  assert.equal(pinion.toothProfile, 'rack-cut-square-pinion-with-rounded-tips');
  // Ten teeth: count tip crossings of the outline.
  const r = pinion.outline.map(([x, y]) => Math.hypot(x, y)), mid = (Math.max(...r) + Math.min(...r)) / 2;
  let tips = 0; r.forEach((v, i) => { if (v > mid && r[(i + r.length - 1) % r.length] <= mid) tips++; });
  assert.equal(tips, 10);
  // Wheel A is the offline envelope of this pinion (contact audited in 191-196-201-contact).
  const a = b.wheelBody.geometry.userData.outline;
  assert.ok(a.length > 800);
});
