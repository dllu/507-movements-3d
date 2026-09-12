import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {hashStudyFile,freezeStudySources} from './lib/study-report-io.mjs';

const page='artifacts/reference/brown-page-30-6000.png',output='artifacts/reference/brown-087-detail.png',crop=[1640,1160,2780,1320];
assert.equal(execFileSync('identify',['-format','%wx%h',page],{encoding:'utf8'}),'4814x6000');
const specification=`${crop[2]}x${crop[3]}+${crop[0]}+${crop[1]}`;
if(!fs.existsSync(output))execFileSync('convert',[page,'-crop',specification,'+repage',output]);
const raw=execFileSync('convert',[page,'-crop',specification,'+repage','-depth','8','rgb:-'],{maxBuffer:crop[2]*crop[3]*3+1024});
assert.deepEqual(execFileSync('convert',[output,'-depth','8','rgb:-'],{maxBuffer:raw.length+1024}),raw);
const prefix='artifacts/review/087-source-provenance',sources=freezeStudySources(['scripts/prepare-weighted-clutch-source.mjs',page,
 'artifacts/reference/brown-scan.pdf','scripts/lib/study-report-io.mjs'],prefix),report={movement:87,pdfPage:30,printedPage:26,crop,output,
 sha256:hashStudyFile(output),sources,qualification:'Exact native pixel extraction from the Brown scan. Complete drawing and numeral retained, with no rescaling or reconstructed image content.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:undefined});
