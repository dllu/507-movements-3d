import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
const root='artifacts/review/',backup=root+'079-prior-browser-evidence/',latest=root+'079-browser-regression-captures/';
const hash=async file=>createHash('sha256').update(await readFile(file)).digest('hex');
if(process.argv[2]==='restore'){
 const exit=JSON.parse(await readFile(root+'079-browser-tests-exit-status.json'));if(exit.code!==0||exit.signal!==null)throw new Error('Browser run has not passed');
 const saved=JSON.parse(await readFile(backup+'manifest.json')),rows=[];await mkdir(latest);
 for(const item of saved.frames){
  if(await hash(backup+item.file)!==item.sha256)throw new Error('Archived evidence changed');
  await copyFile(root+item.file,latest+item.file,constants.COPYFILE_EXCL);rows.push({file:item.file,sha256:await hash(latest+item.file),inspectedInThisRun:false});
  await copyFile(backup+item.file,root+item.file);if(await hash(root+item.file)!==item.sha256)throw new Error('Restore failed');
 }
 await writeFile(latest+'manifest.json',JSON.stringify({priorEvidenceRestored:true,rows},null,2)+'\n',{flag:'wx'});console.log({restored:rows.length});
}else{
 const previous=JSON.parse(await readFile(root+'078-prior-browser-evidence/manifest.json'));await mkdir(backup);const frames=[];
 for(const item of previous.frames){await copyFile(root+item.file,backup+item.file,constants.COPYFILE_EXCL);frames.push({file:item.file,sha256:await hash(root+item.file)});}
 await writeFile(backup+'manifest.json',JSON.stringify({reason:'Preserve previously inspected historical frames before the 079 browser regression run.',frames},null,2)+'\n',{flag:'wx'});console.log({preserved:frames.length});
}
