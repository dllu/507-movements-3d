import { readFile,writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { makeOpenRimTappetCandidate } from './lib/open-rim-tappet-candidate.mjs';
import { makeOpenRimTappetIndex } from '../src/simulation/open-rim-tappet.js';
import { createMovementModel } from '../src/simulation/registry.js';
const candidate=makeOpenRimTappetCandidate(),production=makeOpenRimTappetIndex();
const bytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength),hash=a=>createHash('sha256').update(bytes(a)).digest('hex');
const rows=[];let maximumMatrixError=0;
for(const name of Object.keys(candidate.root.userData.parts)){
  const a=candidate.root.userData.parts[name].geometry,b=production.root.userData.parts[name].geometry;
  const attributes=Object.keys(a.attributes).map(key=>({name:key,count:a.attributes[key].count,
    sha256:hash(a.attributes[key].array),exact:bytes(a.attributes[key].array).equals(bytes(b.attributes[key].array))}));
  const indexEqual=a.index?Boolean(b.index&&bytes(a.index.array).equals(bytes(b.index.array))):!b.index;
  rows.push({name,attributes,indexEqual,exact:indexEqual&&attributes.every(a=>a.exact)});
}
const p=production.motion.parameters,times=[0,.04,.2,.4,.51,.58376,1.03,1.04,3,p.period,p.period*10,-p.period];
for(const time of times){candidate.update(time);production.update(time);candidate.root.updateMatrixWorld(true);production.root.updateMatrixWorld(true);
  for(const name of Object.keys(candidate.root.userData.parts)){
    const a=candidate.root.userData.parts[name].matrixWorld.elements,b=production.root.userData.parts[name].matrixWorld.elements;
    maximumMatrixError=Math.max(maximumMatrixError,...a.map((v,i)=>Math.abs(v-b[i])));
  }
}
const catalog=JSON.parse(await readFile('src/data/movements.json','utf8')),registry=createMovementModel(catalog.movements[69]);
const registryChecked=registry.root.userData.mechanism==='open-rim-tappet-stud-index'&&Object.keys(registry.root.userData.parts).length===18;
const display=registry.root.userData.animationTiming,report={movement:70,status:'integrated-equivalence',rows,poses:times.length,
  maximumMatrixError,registryChecked,exact:rows.every(r=>r.exact)&&maximumMatrixError===0&&registryChecked,
  animationTiming:display,mainStrokeDisplaySeconds:(p.releaseAngle-p.entryAngle)/p.period*display.displayCycleDuration,
  internalPauseDisplaySeconds:(p.rimEntryAngle-p.releaseAngle)/p.period*display.displayCycleDuration,
  closingStrokeDisplaySeconds:(p.exitAngle-p.rimEntryAngle)/p.period*display.displayCycleDuration};
await writeFile('artifacts/review/070-integrated-candidate-equivalence.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({exact:report.exact,solids:rows.length,poses:times.length,maximumMatrixError,registryChecked,animationTiming:display,
  mainStrokeDisplaySeconds:report.mainStrokeDisplaySeconds,internalPauseDisplaySeconds:report.internalPauseDisplaySeconds,closingStrokeDisplaySeconds:report.closingStrokeDisplaySeconds});
if(!report.exact)process.exitCode=1;
