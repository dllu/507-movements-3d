import fs from 'node:fs';
import assert from 'node:assert/strict';
import {readStudyReport,freezeStudySources,verifyStudySources,hashStudyFile} from './lib/study-report-io.mjs';

const prefix='artifacts/review/087-assembled-seating',profileFiles=['087-reused-forward-seating-profile','087-wide-return-seating-profile'].map(n=>'artifacts/review/'+n+'.json'),
 profiles=profileFiles.map(readStudyReport),inputs={
 first:['087-first-forward-seating-events','087-continued-return-seating'],
 quarter:['087-quarter-forward-seating-events','087-continued-quarter-return-seating'],
 },allFiles=[...profileFiles,'scripts/assemble-weighted-clutch-seating.mjs'],outputs=[];
for(const p of profiles){verifyStudySources(p.sources);allFiles.push(...p.sources.map(s=>s.file));}
for(const names of Object.values(inputs))for(const name of names){
 const file='artifacts/review/'+name+'.json',r=readStudyReport(file);verifyStudySources(r.sources);
 assert(r.summaries.every(s=>!s.error&&s.seat));allFiles.push(file,...r.sources.map(s=>s.file));
}
const sources=freezeStudySources(allFiles,prefix);
fs.writeFileSync('artifacts/review/087-loaded-seating-profiles.json',JSON.stringify({movement:87,productionChanged:false,mechanicsPassed:false,
 sources,profiles:profiles.flatMap(p=>p.profiles)})+'\n',{flag:'wx'});
for(const[level,names]of Object.entries(inputs)){
 const summaries=names.flatMap(name=>readStudyReport('artifacts/review/'+name+'.json').summaries),aliases=[];
 for(const s of summaries){
  const name=names[s.direction==='CCW'?0:1],from='artifacts/review/'+name+'-'+s.direction+'.json.gz',
   to='artifacts/review/087-'+level+'-step-seating-'+s.direction+'.json.gz';
  fs.linkSync(from,to);aliases.push({file:to,original:from,sha256:hashStudyFile(from)});
 }
 const file='artifacts/review/087-'+level+'-step-seating.json';
 fs.writeFileSync(file,JSON.stringify({movement:87,productionChanged:false,mechanicsPassed:false,sources,summaries,aliases})+'\n',{flag:'wx'});
 outputs.push({file,aliases});
}
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify({sources,outputs})+'\n',{flag:'wx'});
console.log(outputs);
