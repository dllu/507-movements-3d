import fs from 'node:fs';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';
const names=['077-initial-finite-dynamics','077-extended-stroke-dynamics','077-inertial-wide-stroke','077-inertial-short-stroke','077-inertial-slow-stroke',
 '077-two-second-wide-stroke','077-two-second-medium-stroke','077-shallow-seat-short','077-shallow-seat-wide','077-short-lip-short','077-short-lip-wide',
 '077-dry-friction-wide-stroke','077-friction-eight-wide','077-friction-fifteen-wide','077-friction-eight-short',
 '077-friction-eight-short-lip','077-friction-fifteen-short-lip'],pitch=Math.PI/12,studies=[];
for(const name of names){
 const file='artifacts/review/'+name+'.json';if(!fs.existsSync(file))continue;
 const bytes=fs.readFileSync(file),data=JSON.parse(bytes),cycles=[];
 for(let i=0;i<Math.ceil(data.duration/data.parameters.period);i++){
  const rows=data.rows.filter(r=>r.time>=i*data.parameters.period-1e-7&&r.time<=(i+1)*data.parameters.period+1e-7);
  if(!rows.length)continue;
  cycles.push({cycle:i,complete:rows.at(-1).time>=(i+1)*data.parameters.period-1e-7,netPitches:(rows.at(-1).x[0]-rows[0].x[0])/pitch,
   reversePitches:rows.slice(1).reduce((sum,row,j)=>sum+Math.min(0,row.x[0]-rows[j].x[0]),0)/pitch,
   stoppedFraction:rows.filter(r=>Math.abs(r.v[0])<1e-7).length/rows.length,
   minimumSpeed:Math.min(...rows.map(r=>r.v[0])),maximumSpeed:Math.max(...rows.map(r=>r.v[0]))});
 }
 studies.push({name,file,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),parameters:data.parameters,geometry:data.geometry,
  solverFailures:data.failures.map(f=>({reason:f.reason,time:f.time})),minimumGap:data.minimumGap,cycles,
  plot:data.rows.filter((_,i)=>i%10===0).map(r=>[r.time/data.parameters.period,r.x[0]/pitch])});
}
const width=1440,panelWidth=480,panelHeight=240,height=Math.ceil(studies.length/3)*panelHeight+40,
 escape=t=>t.replaceAll('&','&amp;').replaceAll('<','&lt;'),panels=studies.map((s,i)=>{
  const ox=i%3*panelWidth,oy=Math.floor(i/3)*panelHeight+30,last=Math.min(3,s.plot.at(-1)[0]),points=s.plot.filter(p=>p[0]<=last),
   ymin=Math.floor(Math.min(0,...points.map(p=>p[1]))),ymax=Math.max(1,Math.ceil(Math.max(...points.map(p=>p[1])))),
   X=x=>ox+48+x/last*405,Y=y=>oy+195-(y-ymin)/(ymax-ymin)*145,
   grid=Array.from({length:4},(_,k)=>{const value=ymin+(ymax-ymin)*k/3;return`<path d="M${ox+48},${Y(value)}h405" stroke="#dce1e5"/><text x="${ox+5}" y="${Y(value)+5}" font-size="12">${value.toFixed(1)}</text>`;}).join(''),
   path=points.map((p,j)=>(j?'L':'M')+X(p[0])+','+Y(p[1])).join('');
  return `<text x="${ox+12}" y="${oy+18}" font-size="15">${escape(s.name.replace('077-',''))}</text>${grid}<path d="${path}" fill="none" stroke="#246c8b" stroke-width="2"/><text x="${ox+40}" y="${oy+220}" font-size="12">0</text><text x="${ox+405}" y="${oy+220}" font-size="12">${Number(last.toFixed(2))} cycles</text>`;
 }).join(''),prefix=process.env.PROBE_OUTPUT||'artifacts/review/077-dynamics-studies-summary';
fs.writeFileSync(prefix+'.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" font-family="DejaVu Sans"><rect width="100%" height="100%" fill="white"/><text x="12" y="20" font-size="17">077 exploratory output in pin pitches; solver completion is not a mechanism pass</text>${panels}</svg>`);
const converted=spawnSync('convert',[prefix+'.svg',prefix+'.png']);if(converted.status)throw Error(String(converted.stderr));
for(const s of studies)delete s.plot;
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:77,productionChanged:false,mechanicsPassed:false,studies,
 qualification:'Comparative diagnostics only. Constant resisting torque, viscous damping and dry friction are different load models. A completed solver run is not accepted as a faithful reconstruction.',
 plot:{file:prefix+'.png',sha256:crypto.createHash('sha256').update(fs.readFileSync(prefix+'.png')).digest('hex'),inspected:false},
 source:{file:'scripts/summarize-alternating-peg-dynamics.mjs',sha256:crypto.createHash('sha256').update(fs.readFileSync('scripts/summarize-alternating-peg-dynamics.mjs')).digest('hex')}},null,2)+'\n');
console.log({prefix,studies:studies.length});
