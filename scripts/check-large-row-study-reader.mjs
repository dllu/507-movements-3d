import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {readLargeRowStudyReport} from './lib/large-row-study-reader.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix='artifacts/review/086-large-row-reader-controls',directory=fs.mkdtempSync(path.join(os.tmpdir(),'pump-catch-json-reader-')),
  rows=[{text:'a comma, quote " and escaped backslash \\ with unicode 雪',nested:[1,{rows:[{x:1}],brackets:'[]{}'}]},
    {time:2,q:[0,-1e-12,3.4],active:[{kind:'cam',impulse:1e-9}]},null,3,'a,]b'],
  fixture={nested:{rows:[{test:true}]},rows},cases=[];
try{
  for(const compressed of [false,true])for(const chunkBytes of [1,7,32,1024]){
    const file=path.join(directory,compressed?'fixture.json.gz':'fixture.json'),text=JSON.stringify(fixture);
    fs.writeFileSync(file,compressed?gzipSync(text):text);
    assert.deepEqual(readLargeRowStudyReport(file,{chunkBytes}),fixture);cases.push({compressed,chunkBytes});
  }
  const invalid=path.join(directory,'invalid.json');
  for(const text of ['{"movement":86,"rows":[{"x":1}', '{"movement":86,"rows":[],"late":true}']){
    fs.writeFileSync(invalid,text);assert.throws(()=>readLargeRowStudyReport(invalid));
  }
  const empty=path.join(directory,'empty.json');fs.writeFileSync(empty,'{"movement":86,"rows":[]}');
  assert.deepEqual(readLargeRowStudyReport(empty),{movement:86,rows:[]});
  const input='artifacts/review/086-quarter-ms-hybrid.json.gz',original=readStudyReport(input),batched=readLargeRowStudyReport(input,{chunkBytes:1024*1024});
  assert.deepEqual(batched,original);
  const sources=freezeStudySources([input,'scripts/check-large-row-study-reader.mjs','scripts/lib/large-row-study-reader.mjs','scripts/lib/study-report-io.mjs'],prefix);
  verifyStudySources(sources);const report={passed:true,cases,malformedRejected:2,emptyArrayChecked:true,referenceRows:original.rows.length,
    exactWholeReportAgreement:true,sources,qualification:'Batched parsing matches ordinary JSON.parse for every value of an existing full study, plus escaped strings, unicode, nested rows members and forced tiny batches. Truncation and a nonfinal rows member are rejected. The actual long study remains an independent audit input.'};
  fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:undefined});
}finally{fs.rmSync(directory,{recursive:true,force:true});}
