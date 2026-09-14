import fs from 'node:fs';
import crypto from 'node:crypto';
const coarse=JSON.parse(fs.readFileSync(process.argv[2]??'/dev/shm/137-coarse.json'));
const fine=JSON.parse(fs.readFileSync(process.argv[3]??'/dev/shm/137-fine.json'));
let maximumForkAngleDifference=0;
for(const row of coarse.rows){
 if(row[0]<8||row[0]>19.99)continue;
 const k=(row[0]-fine.rows[0][0])/.002,i=Math.floor(k),f=k-i;
 const q=fine.rows[i][2]*(1-f)+fine.rows[i+1][2]*f;
 maximumForkAngleDifference=Math.max(maximumForkAngleDifference,Math.abs(row[2]-q));
}
const sources=['src/data/expansion-eccentric-outline.js','src/simulation/expansion-eccentric-profile.js','src/simulation/mujoco-expansion-eccentric/physics.js','src/simulation/mujoco/simulation.js','package-lock.json'].map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
const report={sources,coarse:{...coarse,rows:undefined},fine:{...fine,rows:undefined},maximumForkAngleDifference,maximumRollerPositionDifferencePixels:maximumForkAngleDifference*367,settledComparisonSeconds:[8,19.99],caveat:'Timestep and cam tessellation were refined together; this is a combined sensitivity check, not separate convergence certification.'};
fs.writeFileSync('docs/validation/137-physics-prototype.json',JSON.stringify(report,null,2)+'\n');
console.log({maximumRollerPositionDifferencePixels:report.maximumRollerPositionDifferencePixels});
