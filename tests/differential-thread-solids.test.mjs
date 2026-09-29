import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createAuthoredDifferentialDriveMovement} from '../src/simulation/authored-differential-drives.js';
import {createAuthoredDifferentialScrewMovement} from '../src/simulation/authored-differential-screws.js';
import {createAuthoredWormRackMovement} from '../src/simulation/authored-worm-racks.js';
import {solidSurface,surfacePoints} from './helpers/solid-surface.mjs';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const catalog=JSON.parse(fs.readFileSync('src/data/movements.json')).movements;
const factories={260:createAuthoredDifferentialDriveMovement,266:createAuthoredDifferentialScrewMovement,275:createAuthoredWormRackMovement};
for(const id of[260,266,275])test(`${id} uses finite thread solids without scene fog or a generated floor`,()=>{
 const model=factories[id](catalog[id-1]),u=model.root.userData;
 assert.equal(u.hideGround,true);assert.ok(u.minimumDisplayCycleSeconds>=8);assert.ok(u.threadProfiles);
 model.root.traverse(o=>{for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(m)assert.equal(m.fog,false);if(o.geometry){const a=o.geometry.attributes.position;for(const n of a.array)assert.ok(Number.isFinite(n));}});
 disposeObject3D(model.root);
});
test('260 uses equal-base-pitch involutes with contact ratios above one',()=>{
 const model=factories[260](catalog[259]),b=model.root.userData.blocks;
 for(const[a,c]of[[b.longPinionF,b.wheelD],[b.pinionB,b.wheelE]]){
  const x=a.userData,y=c.userData,basePitch=2*Math.PI*x.baseRadius/x.teeth;
  assert.ok(Math.abs(basePitch-2*Math.PI*y.baseRadius/y.teeth)<1e-12);
  const ratio=(Math.sqrt(x.outerRadius**2-x.baseRadius**2)+Math.sqrt(y.outerRadius**2-y.baseRadius**2)-(x.radius+y.radius)*Math.sin(x.pressureAngle))/basePitch;
  assert.ok(ratio>1.32&&ratio<1.37);assert.equal(x.pressureAngle,Math.PI/6);
 }
 assert.equal(b.wheelE.userData.rotor.rotation.z,0);
 for(const gear of[b.longPinionF,b.wheelD,b.pinionB,b.wheelE])assert.ok(gear.userData.rotor.children[0].geometry.parameters.shapes.holes.length);
 disposeObject3D(model.root);
});
test('260 shafts stay seated and its rotating nut journal clears its actual crosshead and uprights',()=>{
 const model=factories[260](catalog[259]),b=model.root.userData.blocks;
 for(const time of[0,3,6,9,12]){
  model.update(time);model.root.updateMatrixWorld(true);
  for(const[shaft,housing]of[[b.inputShaft,b.leftInputBearing],[b.screwCore,b.leftScrewGuide]]){const s=new THREE.Box3().setFromObject(shaft),h=new THREE.Box3().setFromObject(housing);assert.ok(s.min.x<h.min.x&&s.max.x>h.max.x);}
  const points=surfacePoints(b.nutJournal.geometry);
  for(const target of[b.rightStandardTop,b.fixedNutBearing,...b.rightStandardBars]){
   const surface=solidSurface(target.geometry),matrix=target.matrixWorld.clone().invert().multiply(b.nutJournal.matrixWorld);
   for(const p of points){const q=p.clone().applyMatrix4(matrix);assert.ok(!surface.inside(q)||surface.distance(q)<1e-6);}
  }
 }
 disposeObject3D(model.root);
});
test('266 uses complementary same-hand coarse and fine solid trapezoid nut threads',()=>{
 const model=factories[266](catalog[265]),u=model.root.userData;
 for(const[key,pitch]of[['fixed',.3],['moving',.24]]){const p=u.threadProfiles[key];assert.ok(Math.abs(p.external.lead*2*Math.PI-pitch)<1e-12);assert.equal(p.internal.lead,p.external.lead);assert.ok(p.internal.inner>p.external.inner);assert.ok(p.internal.outer>p.external.outer);for(let r=p.internal.inner;r<=p.external.outer+1e-12;r+=.01)assert.ok(Math.abs(p.widthAt(r)+p.internalWidthAt(r)-pitch+.004)<1e-12);assert.ok(p.external.rootWidth>2*p.external.crestWidth,'V-flanked trapezoid thread');assert.ok(p.external.outer-p.external.inner>.08,'thread depth');assert.ok(u.blocks[`${key}InternalThread`].geometry.attributes.position.count>1000);}
 disposeObject3D(model.root);
});
test('275 rack is clear at the correct phase and intersects after a half-turn phase error',()=>{
 const model=factories[275](catalog[274]),u=model.root.userData,b=u.blocks,point=new THREE.Vector3(-.15,u.geometry.sourceActiveToothY,0),surface=solidSurface(b.wormThread.geometry);
 model.root.updateMatrixWorld(true);assert.equal(surface.inside(point.clone().applyMatrix4(b.wormThread.matrixWorld.clone().invert())),false);
 b.wormThread.parent.rotation.y+=Math.PI;model.root.updateMatrixWorld(true);assert.equal(surface.inside(point.clone().applyMatrix4(b.wormThread.matrixWorld.clone().invert())),true);
 assert.ok(u.sampledMotionBounds.max[1]>=u.geometry.rackSpineTopY);assert.ok(u.sampledMotionBounds.min[1]<=u.geometry.rackSpineBottomY-u.geometry.maximumRackTravel);
 disposeObject3D(model.root);
});
test('saved 33-pose finite-surface audit matches production and keeps active contacts close',()=>{
 const report=JSON.parse(fs.readFileSync('docs/validation/260-266-275-thread-solids.json'));
 for(const source of report.sources)assert.equal(createHash('sha256').update(fs.readFileSync(source.file)).digest('hex'),source.sha256,source.file);
 for(const row of report.results){assert.equal(row.poses,33);assert.equal(row.penetrations,0);assert.ok(row.queries>100000);for(const p of row.pairs.filter(p=>p.activePoses===33))assert.ok(p.maximumSampledGap<.003,p.pair);}
});
