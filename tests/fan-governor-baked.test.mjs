import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Vector3} from 'three';
import {makeFanGovernorModel,fanGovernorTubTop} from '../src/simulation/baked/fan-governor.js';
import {makeFanGovernorGeometry} from '../src/simulation/mujoco-fan-governor/geometry.js';
import {solidSurface} from './helpers/solid-surface.mjs';
const bundle=JSON.parse(gunzipSync(fs.readFileSync(new URL('../src/simulation/baked/assets/147.json.gz',import.meta.url))));
test('147 baked interpolation retains track contact and closes the lift cycle',()=>{
 const model=makeFanGovernorModel(bundle),reference=makeFanGovernorGeometry({segments:320});
 try{
  const tracks=Object.entries(reference.root.userData.parts).filter(([n])=>n.startsWith('track_')).map(([,m])=>solidSurface(m.geometry));
  let separation=0,penetration=0;
  for(let i=0;i<=1200;i++){
   model.update(bundle.period*i/1200);
   const {blocks:b}=model.root.userData,center=b.roller0.getWorldPosition(new Vector3()).applyMatrix4(b.shaft.matrixWorld.clone().invert());
   const gap=Math.min(...tracks.map(s=>s.distance(center)))-.21;
   separation=Math.max(separation,gap);penetration=Math.max(penetration,-gap);
  }
  assert.ok(separation<.0005,`interpolated separation ${separation}`);
  assert.ok(penetration<.0005,`interpolated penetration ${penetration}`);
  model.update(bundle.period-1e-7);const before=model.root.userData.state;
  model.update(bundle.period+1e-7);const after=model.root.userData.state;
  assert.ok(Math.abs(before.lift-after.lift)<1e-6&&Math.abs(before.yaw-after.yaw)<1e-6);
 }finally{model.dispose();reference.dispose();}
});
test('147 baked bodies stay framed, ignore fog, and reset deterministically',()=>{
 const model=makeFanGovernorModel(bundle);
 try{
  const bounds=model.root.userData.cameraFitBounds.clone().expandByScalar(1e-6);let count=0;
  model.root.traverse(o=>{if(o.isMesh){count++;assert.equal(o.material.fog,false);}});assert.equal(count,12);
  // Brown's stepped finial caps the bulb neck (one body with the carrier);
  // the spindle ends inside the carrier's bore at every lift.
  const finial=model.root.userData.blocks.crosshead.getObjectByName('bulb-neck-finial');assert.ok(finial);
  const spindle=model.root.userData.blocks.shaft.children.find(o=>o.isMesh&&!o.name);spindle.geometry.computeBoundingBox();
  for(let i=0;i<=64;i++){model.update(bundle.period*i/64);assert.ok(bounds.containsBox(new Box3().setFromObject(model.root,true)));
   assert.ok(spindle.geometry.boundingBox.max.y<3.1+model.root.userData.state.lift-.02,'spindle stands above the neck');}
  model.reset();const initial=structuredClone(model.root.userData.state);
  model.update(123);model.reset();assert.deepEqual(model.root.userData.state,initial);
 }finally{model.dispose();model.dispose();}
});

test('147 displayed trough is straight-sided and its humps carry the rollers exactly where they run',()=>{
 const model=makeFanGovernorModel(bundle);
 try{
  const {blocks:b}=model.root.userData,trough=b.shaft.getObjectByName('tub-trough');
  assert.ok(trough&&b.shaft.getObjectByName('tub-ring'));
  let worst=0,lowestArm=Infinity;
  for(let i=0;i<=600;i++){
   model.update(bundle.period*i/600);
   for(const roller of [b.roller0,b.roller1]){
    const c=roller.getWorldPosition(new Vector3()).applyMatrix4(b.shaft.matrixWorld.clone().invert());
    // Fold to the ramp's own angle; the baked ramp there is base+curvature*a^2.
    const angle=Math.atan2(-c.z,c.x),a=((angle+2.2)%Math.PI+Math.PI)%Math.PI-2.2;
    assert.ok(a>-1&&a<0,`roller outside the working flank at ${a}`);
    worst=Math.max(worst,Math.abs(fanGovernorTubTop(angle)-(-.55+.6*a*a)));
   }
   lowestArm=Math.min(lowestArm,model.root.userData.state.lift-.09);
  }
  // Where the rollers run, the displayed hump is exactly the baked ramp.
  assert.ok(worst<1e-12,`roller/hump offset ${worst}`);
  // And the displayed solid keeps the rollers seated within the bake's tolerance.
  const ring=solidSurface(b.shaft.getObjectByName('tub-ring').geometry);let gap=0;
  for(let i=0;i<=300;i++){model.update(bundle.period*i/300);for(const roller of [b.roller0,b.roller1]){const c=roller.getWorldPosition(new Vector3()).applyMatrix4(b.shaft.matrixWorld.clone().invert());gap=Math.max(gap,Math.abs(ring.distance(c)-.21));}}
  assert.ok(gap<.0005,`roller seating ${gap}`);
  // The flat rim stays below the arms at all lifts.
  trough.geometry.computeBoundingBox();assert.ok(trough.geometry.boundingBox.max.y<lowestArm);
 }finally{model.dispose();}
});
