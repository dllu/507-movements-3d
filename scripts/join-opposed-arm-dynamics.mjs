import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const files=JSON.parse(process.env.PROBE_INPUTS??'["artifacts/review/079-load6-finest-initial.json","artifacts/review/079-load6-finest-continuation.json"]'),
 prefix=process.env.PROBE_PREFIX??'079-load6-finest',runs=await Promise.all(files.map(async file=>JSON.parse(await readFile(file,'utf8')))),first=runs[0],rows=[...first.rows],sources=[];
if(runs.some(r=>r.failures.length))throw Error('Cannot join incomplete dynamics');
for(let i=1;i<runs.length;i++){
 const previous=runs[i-1],next=runs[i];
 for(const key of ['geometry','parameters','contactParameters','dt'])if(JSON.stringify(first[key])!==JSON.stringify(next[key]))throw Error('Different continuation inputs: '+key);
 for(const key of ['time','x','v','active'])if(JSON.stringify(previous.rows.at(-1)[key])!==JSON.stringify(next.rows[0][key]))throw Error('Continuation seam differs: '+key);
 if(next.resume!==files[i-1])throw Error('Continuation names a different source report');
 rows.push(...next.rows.slice(1));
}
for(let i=1;i<rows.length;i++)if(Math.abs(rows[i].time-rows[i-1].time-first.dt)>1e-12)throw Error('Nonuniform or unordered trajectory');
for(const file of ['scripts/join-opposed-arm-dynamics.mjs',...files]){
 const bytes=await readFile(file),archive=`artifacts/review/${prefix}-join-source-${sources.length}.txt`;await writeFile(archive,bytes,{flag:'wx'});sources.push({file,archive,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const report={...first,status:'finite-dynamics-joined-study',productionChanged:false,mechanicsPassed:false,rows,sources,failures:[],
 duration:rows.at(-1).time-rows[0].time,startTime:rows[0].time,endTime:rows.at(-1).time,resume:null,joined:files,
 minimumGap:Math.min(...runs.map(r=>r.minimumGap)),maximumIterations:Math.max(...runs.map(r=>r.maximumIterations)),maximumResidual:Math.max(...runs.map(r=>r.maximumResidual)),
 qualification:'Exact concatenation of completed dynamics reports. Geometry, physics, time step and complete resumed state agree without numerical alteration. Separate refinement, energy, physical reaction and playback clearance checks are still required.'};
await writeFile(`artifacts/review/${prefix}.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({prefix,states:rows.length,startTime:report.startTime,endTime:report.endTime,minimumGap:report.minimumGap});
