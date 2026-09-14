import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const runs=Object.fromEntries(['coarse','time-refined','mesh-refined','fine'].map(name=>{
 const r=JSON.parse(fs.readFileSync(`/dev/shm/137-${name}.json`));
 for(const s of r.sources)assert.equal(hash(s.file),s.sha256,s.file);
 assert.equal(r.resets,0);assert(r.penetration<.001);
 return [name,r];
}));
const comparisons={};
for(const name of ['time-refined','mesh-refined','fine']){
 const fine=runs[name];let maximumForkAngleDifference=0,maximumRodAngleDifference=0;
 for(const row of runs.coarse.rows){
  if(row[0]<8||row[0]>19.99)continue;
  const k=row[0]/.002,i=Math.floor(k),f=k-i;
  const q=col=>fine.rows[i][col]*(1-f)+fine.rows[i+1][col]*f;
  maximumForkAngleDifference=Math.max(maximumForkAngleDifference,Math.abs(row[2]-q(2)));
  maximumRodAngleDifference=Math.max(maximumRodAngleDifference,Math.abs(row[5]-q(5)));
 }
 comparisons[name]={maximumForkAngleDifference,maximumRollerPositionDifferencePixels:maximumForkAngleDifference*367,maximumRodAngleDifference};
 assert(comparisons[name].maximumRollerPositionDifferencePixels<.25);
}
const report={sources:runs.coarse.sources,runs:Object.fromEntries(Object.entries(runs).map(([name,r])=>[name,{...r,rows:undefined,sources:undefined}])),comparisons,settledComparisonSeconds:[8,19.99],caveat:'Separate timestep and tessellation sensitivity checks; inferred contour closure, roller spacing and inertial properties remain reconstruction assumptions.'};
fs.writeFileSync('docs/validation/137-physics-prototype.json',JSON.stringify(report,null,2)+'\n');console.log(comparisons);
