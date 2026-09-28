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
test('143 worm is left-handed: its front crests slope up to the right, as Brown draws',()=>{
 const model=makeSlidingWormModel(JSON.parse(gunzipSync(fs.readFileSync(asset))));
 try{
  model.update(0);const worm=model.root.getObjectByName('bored-worm'),p=worm.geometry.attributes.position,v=new Vector3(),crest=[];let rmax=0;
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(worm.matrixWorld);const r=Math.hypot(v.y-g.shaftY,v.z);rmax=Math.max(rmax,r);crest.push([v.x,v.y-g.shaftY,v.z,r]);}
  const tips=crest.filter(q=>q[3]>rmax-.01&&q[2]>0),front=tips.filter(q=>Math.abs(q[1])<.03),up=tips.filter(q=>q[1]>.08&&q[1]<.12);
  let sum=0,n=0;
  for(const f of front){let best=null;for(const u of up){const d=u[0]-f[0];if(Math.abs(d)<.08&&(best===null||Math.abs(d)<Math.abs(best)))best=d;}if(best!==null){sum+=best;n++;}}
  assert.ok(n>100&&sum/n>.005,`front crest rises to the right (${sum/n})`);
 }finally{model.dispose();}
});
