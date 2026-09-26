import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {Box3,Vector3} from 'three';
import {makeSilkTraverseGeometry} from '../src/simulation/silk-traverse-geometry.js';
import {makeSilkTraverseModel} from '../src/simulation/baked/silk-traverse.js';
import {silkTraverseGeometry as g,silkTraverseAtTime} from '../src/simulation/silk-traverse-kinematics.js';
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
test('142 completed hardware has current clearance evidence and prebuilt provenance',()=>{
 const report=JSON.parse(fs.readFileSync('docs/validation/142-clearance.json'));
 for(const s of report.sources)assert.equal(hash(fs.readFileSync(s.file)),s.sha256,s.file);
 assert.equal(report.samples,721);assert.deepEqual(report.overlaps,{});
 const bytes=fs.readFileSync('src/simulation/baked/assets/142.json.gz'),bundle=JSON.parse(gunzipSync(bytes));
 for(const s of bundle.sources)assert.equal(hash(fs.readFileSync(s.file)),s.sha256,s.file);
 assert.equal(hash(bytes),JSON.parse(fs.readFileSync('src/simulation/baked/assets/142.provenance.json')).assetSha256);
 assert(bytes.length<600000);
});
test('142 baked geometry follows closed rigid joints through the three-turn pattern',()=>{
 const bundle=JSON.parse(gunzipSync(fs.readFileSync('src/simulation/baked/assets/142.json.gz'))),v=makeSilkTraverseModel(bundle),b=v.root.userData.blocks;
 const rod=b.rod.getObjectByName('connecting-rod');rod.geometry.computeBoundingBox();
 try{
  for(let i=0;i<=720;i++){
   const time=15*i/720;v.update(time);const s=silkTraverseAtTime(time);
   const wrist=b.planet.localToWorld(new Vector3(...g.crank,0)),start=b.rod.localToWorld(new Vector3()),end=b.rod.localToWorld(new Vector3(g.rodLength,0,0));
   assert(wrist.distanceTo(start)<1e-12);assert(end.distanceTo(b.slider.getWorldPosition(new Vector3()))<1e-12);
   assert(Math.abs(Math.hypot(s.wrist[0]-s.slider[0],s.wrist[1]-s.slider[1])-g.rodLength)<1e-12);
   // The fit follows the disk and gears down to the plate's cropped lower
   // edge; the whole rod always runs downward past its guided joint, and its
   // clean end stays below the view.
   assert(v.root.userData.cameraFitBounds.containsBox(new Box3().setFromObject(b.carrier,true)));
   assert(s.slider[1]<s.wrist[1]-1.5,'the rod never points up freely');
   assert(s.rodAngle<-Math.PI/4&&s.rodAngle>-3*Math.PI/4,'the rod runs downward to the traverse');
   assert(s.slider[1]<v.root.userData.cameraFitBounds.max.y);
   const tip=b.rod.localToWorld(new Vector3(rod.geometry.boundingBox.max.x,0,0));
   assert(tip.y<v.root.userData.presentedCrop.plateEdge-.2,'the rod end stays out of the default view');
  }
  assert.equal(v.root.userData.cameraFitBounds.min.y,v.root.userData.presentedCrop.plateEdge);
  assert(rod.geometry.boundingBox.max.x>g.rodLength,'the complete rod is presented');
  const a=silkTraverseAtTime(0),z=silkTraverseAtTime(15);assert(Math.hypot(...a.wrist.map((x,i)=>x-z.wrist[i]))<1e-12);
  assert(Math.abs(a.slider[1]-z.slider[1])<1e-12);v.reset();assert.equal(v.root.userData.state.angle,0);
 }finally{v.dispose();}
});
test('142 draws no undrawn guide stand; the stud cap clears the working gears',()=>{
 const v=makeSilkTraverseGeometry(),{parts}=v.root.userData;
 try{
  // p62: Brown draws no guide rail, stand, stud post, rear bearing or slider.
  assert.deepEqual(Object.keys(parts).filter(n=>/guide|post|bridge|cross-arm|rear-bearing|shoe|slider/.test(n)),[]);
  assert(parts['visible-stud-cap'].geometry.userData.plate.low>parts['planet-gear'].geometry.userData.depth/2);
  assert(parts['wrist-pin'].geometry.userData.plate.low>parts['visible-stud-cap'].geometry.userData.plate.high);
 }finally{v.dispose();}
});
