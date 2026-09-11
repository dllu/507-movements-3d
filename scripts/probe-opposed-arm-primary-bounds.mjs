import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {makeOpposedArmCandidate} from './lib/opposed-arm-candidate.mjs';
import {makeOpposedArmForceStudy} from './lib/opposed-arm-forces-study.mjs';
import {makeOpposedArmContactStudy} from './lib/opposed-arm-contact-study.mjs';
import {makeOpposedArmPrimaryBounds} from './lib/opposed-arm-primary-bounds.mjs';
const input=process.env.PROBE_INPUT??'artifacts/review/079-load6-dynamics.json',prefix=process.env.PROBE_PREFIX??'079-coarse-primary-bounds',r=JSON.parse(await readFile(input,'utf8')),
 model=makeOpposedArmCandidate(r.geometry),f=makeOpposedArmForceStudy(model,r.parameters),c=makeOpposedArmContactStudy(model),bounds=makeOpposedArmPrimaryBounds(model,f,c),sources=[],failures=[],
 rows=r.rows.filter(row=>row.time>=Number(process.env.PROBE_START_TIME??-Infinity)-1e-8&&row.time<=Number(process.env.PROBE_END_TIME??Infinity)+1e-8),
 totals={intervals:0,certifiedPairs:0,angularlyExcludedPairs:0,boxExcludedPairs:0,subdivisions:0,maximumDepth:0,minimumLowerBound:Infinity};
for(const file of ['scripts/probe-opposed-arm-primary-bounds.mjs','scripts/lib/opposed-arm-primary-bounds.mjs','scripts/lib/opposed-arm-candidate.mjs','scripts/lib/opposed-arm-forces-study.mjs','scripts/lib/opposed-arm-contact-study.mjs',input]){
 const bytes=await readFile(file),archive=`artifacts/review/${prefix}-geometry-source-${sources.length}.txt`;
 await writeFile(archive,bytes,{flag:'wx'});sources.push({file,archive,sha256:createHash('sha256').update(bytes).digest('hex')});
}
for(let i=1;i<rows.length;i++){
 const result=bounds.interval(rows[i-1],rows[i]);if(!result.passed){failures.push({index:i,...result});break;}
 totals.intervals++;for(const key of ['certifiedPairs','angularlyExcludedPairs','boxExcludedPairs','subdivisions'])totals[key]+=result.stats[key];
 totals.maximumDepth=Math.max(totals.maximumDepth,result.stats.maximumDepth);totals.minimumLowerBound=Math.min(totals.minimumLowerBound,result.stats.minimumLowerBound);
 if(i%250===0)console.log({index:i,time:rows[i].time,...totals});
}
const passed=failures.length===0&&totals.intervals===rows.length-1,report={movement:79,status:passed?'continuous-primary-bounds-passed':'continuous-primary-bounds-failed',productionChanged:false,mechanicsPassed:false,passed,
 startTime:rows[0].time,endTime:rows.at(-1).time,dt:r.dt,parameters:bounds.parameters,totals,failures,sources,qualification:bounds.qualification+' Secondary hardware and complete playback remain unverified.'};
await writeFile(`artifacts/review/${prefix}.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({passed,...totals,failures:failures.slice(0,1)});if(!passed)process.exitCode=1;
