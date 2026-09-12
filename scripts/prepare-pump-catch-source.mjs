import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {hashStudyFile} from './lib/study-report-io.mjs';

const page='artifacts/reference/brown-page-30-6000.png',output='artifacts/reference/brown-086-detail.png';
if(!fs.existsSync(page))execFileSync('pdftoppm',['-f','30','-singlefile','-scale-to','6000','-png','artifacts/reference/brown-scan.pdf',page.slice(0,-4)]);
assert.equal(execFileSync('identify',['-format','%wx%h',page],{encoding:'utf8'}),'4814x6000');
if(!fs.existsSync(output))execFileSync('convert',[page,'-crop','1200x1240+400+1160','+repage',output]);
const recreated=execFileSync('convert',[page,'-crop','1200x1240+400+1160','+repage','-depth','8','rgb:-'],{maxBuffer:1200*1240*3+1024});
assert.deepEqual(execFileSync('convert',[output,'-depth','8','rgb:-'],{maxBuffer:recreated.length+1024}),recreated);
const report={movement:86,source:page,sourceSha256:hashStudyFile(page),pdf:'artifacts/reference/brown-scan.pdf',pdfSha256:hashStudyFile('artifacts/reference/brown-scan.pdf'),
  pdfPage:30,printedPage:26,crop:[400,1160,1200,1240],output,sha256:hashStudyFile(output),official:'https://507movements.com/mm_086.html',
  qualification:'Native rectangular extraction from the Brown scan. The complete mechanism and numeral are retained. No generated image content or rescaling.'};
fs.writeFileSync('artifacts/review/086-source-provenance.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(report);
