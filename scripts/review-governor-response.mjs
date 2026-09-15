import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {governorGeometry,governorEquilibrium} from '../src/simulation/mujoco-ball-governor/equilibrium.js';
const file='/dev/shm/161-settled-0.00025.json',rows=JSON.parse(fs.readFileSync(file)).filter(r=>r.time>=1591.999),g=governorGeometry();let maxSpreadError=0,maxSleeveError=0,minSpread=Infinity,maxSpread=-Infinity;
for(const row of rows){
 let lo=.1,hi=.9;for(let i=0;i<48;i++){const a=(lo+hi)/2;if(governorEquilibrium(a,g).speed<row.speed)lo=a;else hi=a;}const angle=(lo+hi)/2,e=governorEquilibrium(angle,g);
 maxSpreadError=Math.max(maxSpreadError,Math.abs(row.leftSpread-angle));maxSleeveError=Math.max(maxSleeveError,Math.abs(row.sleeveY-e.sleeveY));minSpread=Math.min(minSpread,row.leftSpread);maxSpread=Math.max(maxSpread,row.leftSpread);
}
const report={movement:161,method:'Final settled native cycle compared to independent full-linkage equilibrium at the measured instantaneous spindle speed. Diagnostic comparison, not a replacement motion law.',samples:rows.length,maximumTransientSpreadDifference:maxSpreadError,maximumTransientSleeveDifference:maxSleeveError,maximumTransientSleeveDifferencePixels:maxSleeveError/.018,nativeSpreadRange:[minSpread,maxSpread],sources:[file,'scripts/review-governor-response.mjs','src/simulation/mujoco-ball-governor/equilibrium.js','docs/validation/161-settled-linkage.json'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};fs.writeFileSync('docs/validation/161-equilibrium-response.json',JSON.stringify(report,null,2)+'\n');console.log({...report,sources:undefined});
