import fs from 'node:fs';
import {createAuthoredDualBandRatchetMovement as create} from '../src/simulation/authored-dual-band-ratchets.js';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
const file=process.argv[2],result=JSON.parse(fs.readFileSync(file)),m=create({id:390}),b=m.root.userData.blocks;
const pairs=[['open',b.openCarrier,b.openRatchet],['crossed',b.crossedCarrier,b.crossedRatchet]].flatMap(([name,c,w])=>[
  {name:name+' pawl/wheel',a:c.userData.pawlBody,target:w},
  {name:name+' pawl/stop',a:c.userData.pawlBody,target:c.userData.pawlStop},
]).map(p=>({...p,points:surfacePoints(p.a.geometry),field:solidSurface(p.target.geometry)}));
const phase=result.summary.options.inputPhase??0,omega=2*Math.PI/8,A=m.root.userData.geometry.carrierAmplitude;
const eligible=result.samples.filter(s=>s.time>=8-1e-6),stride=Math.max(1,Math.floor(eligible.length/1024)),samples=eligible.filter((_,i)=>i%stride===0),report=[];
for(const mode of['native-carriers','exact-band-carriers']){
  const minima=Object.fromEntries(pairs.map(p=>[p.name,{gap:Infinity}]));
  for(const s of samples){
    const C=mode==='native-carriers'?s.q[0]:A*Math.sin(omega*s.time+phase),D=mode==='native-carriers'?s.q[2]:-C;
    b.openCarrier.rotation.z=C;b.crossedCarrier.rotation.z=D;b.flywheelRotor.rotation.z=s.q[4];
    b.openPawl.rotation.z=b.openPawl.userData.baseAngle+s.q[1];b.crossedPawl.rotation.z=b.crossedPawl.userData.baseAngle+s.q[3];m.root.updateMatrixWorld(true);
    for(const p of pairs){const tr=p.target.matrixWorld.clone().invert().multiply(p.a.matrixWorld);for(const point of p.points){const q=point.clone().applyMatrix4(tr);if(p.field.box.distanceToPoint(q)>minima[p.name].gap)continue;const gap=p.field.signedDistance(q);if(gap<minima[p.name].gap)minima[p.name]={gap,time:s.time};}}
  }
  report.push({mode,samples:samples.length,minima});
}
fs.writeFileSync(file.replace(/\.json$/,'-solids.json'),JSON.stringify(report,null,2)+'\n');console.log(report);
