import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Vector3} from 'three';
import {makeSlidingWormModel} from '../src/simulation/baked/sliding-worm.js';
import {slidingWormDimensions as g} from '../src/simulation/sliding-worm-kinematics.js';
const asset='src/simulation/baked/assets/143.json.gz';
test('143 packaged geometry keeps its measured pin joints, bounds and restart through a full cycle',()=>{
 const bundle=JSON.parse(gunzipSync(fs.readFileSync(asset))),model=makeSlidingWormModel(bundle);
 let instanceDisposals=0;model.root.getObjectByName('generated-wheel').addEventListener('dispose',()=>instanceDisposals++);
 try{
  const rod=model.root.getObjectByName('connecting-rod'),pin=model.root.getObjectByName('wrist-pin'),fixed=model.root.getObjectByName('fixed-rod-pin');
  for(const mesh of [pin,fixed])mesh.geometry.computeBoundingBox();
  const fixedLocal=fixed.geometry.boundingBox.getCenter(new Vector3()),pinLocal=pin.geometry.boundingBox.getCenter(new Vector3());
  const first=model.root.userData.state;
  for(let i=0;i<=120;i++){
   model.update(g.period*i/120);
   const a=new Vector3(0,0,.495).applyMatrix4(rod.matrixWorld),b=new Vector3(g.rodLength,0,.495).applyMatrix4(rod.matrixWorld),wrist=pinLocal.clone().applyMatrix4(pin.matrixWorld),anchor=fixedLocal.clone().applyMatrix4(fixed.matrixWorld);
   assert.ok(Math.hypot(a.x-wrist.x,a.y-wrist.y)<1e-6);assert.ok(Math.hypot(b.x-anchor.x,b.y-anchor.y)<1e-6);
   assert.ok(Math.abs(a.distanceTo(b)-g.rodLength)<1e-10);
   assert.ok(model.root.userData.cameraFitBounds.containsBox(new Box3().setFromObject(model.root,true)));
  }
  model.reset();assert.deepEqual(model.root.userData.state,first);
  assert.equal(model.root.getObjectByName('generated-wheel').count,22);
  model.root.traverse(o=>{if(o.material)assert.equal(o.material.fog,false);});
 }finally{model.dispose();model.dispose();assert.equal(instanceDisposals,1);assert.throws(()=>model.update(0),/disposed/i);}
});
test('143 asset and validation provenance match the current sources',()=>{
 const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
 const provenance=JSON.parse(fs.readFileSync('src/simulation/baked/assets/143.provenance.json'));
 assert.equal(hash(asset),provenance.assetSha256);assert.ok(provenance.bytes<1_500_000);
 for(const source of [...provenance.sources,...provenance.validation])assert.equal(hash(source.file),source.sha256,source.file);
});
