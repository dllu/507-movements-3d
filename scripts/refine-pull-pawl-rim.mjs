import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {circleFit} from './lib/source-circle-fit.mjs';

const input='artifacts/review/078-source-inner-rim-fit.json',prefix='artifacts/review/078-source-inner-rim-masked',
 prior=JSON.parse(await readFile(input,'utf8')),excludedDegrees=[6,132],
 rows=prior.rows.filter(r=>!excludedDegrees.includes(r.degrees)),fit=circleFit(rows.map(r=>r.point)),
 report={movement:78,status:'masked-source-inner-rim-fit',productionChanged:false,mechanicsPassed:false,
  source:prior.source,prior:{file:input,sha256:createHash('sha256').update(await readFile(input)).digest('hex')},
  method:'Repeat the same least-squares circle fit after explicitly excluding the two rays observed on spoke material. No automatic residual threshold; preserve the first rejected fit.',
  excludedDegrees,rows,fit,inspected:false,visualPassed:false};
const background=(await readFile(prior.source.file)).toString('base64'),svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1270" height="1300" viewBox="0 0 1270 1300">
 <image href="data:image/png;base64,${background}" width="1270" height="1300"/>
 <circle cx="${fit.center[0]}" cy="${fit.center[1]}" r="${fit.radius}" fill="none" stroke="#00ffff" stroke-width="2"/>
 ${rows.map(r=>`<circle cx="${r.point[0]}" cy="${r.point[1]}" r="3" fill="#00ff40"/>`).join('')}
 ${prior.rows.filter(r=>excludedDegrees.includes(r.degrees)).map(r=>`<circle cx="${r.point[0]}" cy="${r.point[1]}" r="9" fill="none" stroke="#ff3030" stroke-width="3"/><text x="${r.point[0]+12}" y="${r.point[1]}" font-size="20" fill="#ff3030">excluded ${r.degrees}°</text>`).join('')}
 </svg>`;
await writeFile(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
await writeFile(prefix+'.svg',svg,{flag:'wx'});
console.log({points:rows.length,center:fit.center,radius:fit.radius,rms:fit.rmsResidual,max:fit.maximumResidual});
