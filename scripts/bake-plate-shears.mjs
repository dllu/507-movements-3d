import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {gzipSync} from 'node:zlib';import {BufferGeometry} from 'three';
import {makePlateShearsGeometry} from '../src/simulation/mujoco-plate-shears/geometry.js';import {disposeObject3D} from '../src/simulation/dispose-model.js';
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'),file=process.env.REPORT??'/dev/shm/130-recording.json',r=JSON.parse(fs.readFileSync(file));
assert.equal(r.resets,0);assert(r.penetration<.001);assert(r.mass.jaw.centroid[0]<0);assert.deepEqual(r.options,{timestep:.0005,period:4});for(const s of r.sources)assert.equal(hash(s.file),s.sha256,s.file);
const v=makePlateShearsGeometry();try{
 const rows=[[0,0,0],...r.rows],period=4,turns=[-2*Math.PI,0];let best;
 for(let i=1;i+4000<rows.length;i++){if(rows[i][0]<4)continue;const end=rows[i+4000];assert(Math.abs(end[0]-rows[i][0]-period)<1e-7);const error=Math.max(Math.abs(end[1]-rows[i][1]-turns[0])*75,Math.abs(end[2]-rows[i][2])*320);if(!best||error<best.error)best={start:i,end:i+4000,error};}
 assert(best&&best.error<.01);const motion=rows.slice(0,best.end+1).map(row=>[Number(row[0].toFixed(6)),...row.slice(1)]);
 for(const[n,b]of Object.entries(v.root.userData.blocks))b.name='body:'+n;
 v.root.traverse(o=>{o.userData={};if(o.geometry){const g=new BufferGeometry().copy(o.geometry);g.userData={};o.geometry.dispose();o.geometry=g;}});v.root.updateMatrixWorld(true);
 const metadata={version:1,names:['cam','jaw'],period,loopStart:Number(rows[best.start][0].toFixed(6)),loopEnd:Number(rows[best.end][0].toFixed(6)),turns,bounds:{min:[-3.5,-1.7,-.3],max:[2,1.5,.3]},focus:[-.65,-.3,0],cameraDirection:[.2,.15,10],source:{reportSha256:hash(file),simulationSources:r.sources,options:r.options,mass:r.mass,maximumLoopSeamPixels:best.error,maximumPenetrationPixels:r.penetration*100}};
 const output='src/simulation/baked/assets/130.json.gz';fs.writeFileSync(output,gzipSync(JSON.stringify({...metadata,motion,object:v.root.toJSON()}),{level:9}));
 const result={...metadata,samples:motion.length,bytes:fs.statSync(output).size,assetSha256:hash(output)};fs.writeFileSync('src/simulation/baked/assets/130.provenance.json',JSON.stringify(result,null,2)+'\n');console.log({output,samples:motion.length,bytes:result.bytes,seamPixels:best.error});
}finally{disposeObject3D(v.root);}
