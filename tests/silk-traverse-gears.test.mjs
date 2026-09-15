import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {makeSilkTraverseGears} from '../src/simulation/silk-traverse-gears.js';
import {polygonClipping as clip} from '../src/simulation/finite-plate-geometry.js';
test('142 gear evidence uses six fixed teeth and a three-carrier-turn modulation',()=>{
 const r=JSON.parse(fs.readFileSync('docs/validation/142-gear-prototype.json'));
 for(const s of r.sources)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(s.file)).digest('hex'),s.sha256,s.file);
 assert.equal(r.sunTeeth,6);assert.equal(r.planetTeeth,18);assert.equal(r.carrierTurnsPerModulation,3);
 assert.equal(r.interferingPoses,0);assert.equal(r.samples,720);
 assert(Math.abs(r.sunOuterRadiusPixels-35)<1);assert(Math.abs(r.planetOuterRadiusPixels-73)<1);
});
test('142 refined involute outlines retain tooth counts and clear an independent phase grid',()=>{
 const g=makeSilkTraverseGears({samples:256,cutterSteps:8192});
 const shape=(outline,a,center=[0,0])=>[[outline.map(p=>[center[0]+p.x*Math.cos(a)-p.y*Math.sin(a),center[1]+p.x*Math.sin(a)+p.y*Math.cos(a)])]];
 try{
  for(const [gear,count]of [[g.sun,6],[g.planet,18]]){
   const points=gear.userData.outline,radii=points.map(p=>p.length()),threshold=Math.max(...radii)*.98;
   assert.equal(radii.filter((r,i)=>r>threshold&&radii[(i+radii.length-1)%radii.length]<=threshold).length,count);
  }
  const sun=shape(g.sun.userData.outline,g.sunPhase);
  for(let i=0;i<180;i++){
   const a=(i+.173)*6*Math.PI/180,c=Math.cos(a),s=Math.sin(a),center=[g.orbit[0]*c-g.orbit[1]*s,g.orbit[0]*s+g.orbit[1]*c];
   assert.deepEqual(clip.intersection(sun,shape(g.planet.userData.outline,g.planetPhase+(1+g.ratio)*a,center)),[]);
   const planetRadius=g.planet.userData.pitchRadius;
   const velocity=[-center[1]+(1+g.ratio)*center[1]*planetRadius/g.distance,center[0]-(1+g.ratio)*center[0]*planetRadius/g.distance];
   assert(Math.hypot(...velocity)<1e-12,'planet contact velocity at the fixed sun');
  }
 }finally{g.sun.dispose();g.planet.dispose();}
});
