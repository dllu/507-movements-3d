import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const sources=[],main=await readFile('src/simulation/authored-intermittent.js','utf8'),tests=await readFile('tests/models.test.mjs','utf8'),
 start=main.indexOf('function crossedHookPawlSlottedRackDrive()'),end=main.indexOf('\nfunction ',start+1),
 testStart=tests.indexOf("test('movement 80 raises one slotted rack with alternating crossed hooked pawls'"),testEnd=tests.indexOf('\ntest(',testStart+1);
if(start<0||end<0||testStart<0||testEnd<0)throw Error('Baseline extraction anchors missing');
await writeFile('artifacts/review/080-original-factory.txt',main.slice(start,end),{flag:'wx'});
await writeFile('artifacts/review/080-original-test.txt',tests.slice(testStart,testEnd),{flag:'wx'});
const reference='artifacts/reference/brown-page-28-6000.png',crop='artifacts/reference/brown-080-detail.png',rectangle=[410,2520,1320,1290],
 result=spawnSync('convert',[reference,'-crop',`${rectangle[2]}x${rectangle[3]}+${rectangle[0]}+${rectangle[1]}`,'+repage',crop],{encoding:'utf8'});
if(result.status!==0)throw Error(result.stderr);
for(const file of ['scripts/prepare-crossed-rack-baseline.mjs','src/simulation/authored-intermittent.js','tests/models.test.mjs','src/simulation/registry.js','src/simulation/primitives.js',reference,crop,'public/engravings/mm_080.png']){
 const bytes=await readFile(file),archive=file.endsWith('.png')?file:`artifacts/review/080-baseline-input-${sources.length}.txt`;
 if(archive!==file)await writeFile(archive,bytes,{flag:'wx'});sources.push({file,archive,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const catalog=JSON.parse(await readFile('src/data/movements.json','utf8')),
 report={movement:80,status:'baseline-inputs-prepared',productionChanged:false,mechanicsPassed:false,source:catalog.movements[79],reference:{page:reference,crop,rectangle,inspected:false},
 originalFactory:'artifacts/review/080-original-factory.txt',originalTest:'artifacts/review/080-original-test.txt',sources,
 findings:['Output rack displacement follows an authored active-hook constraint and prescribed return-pawl angles.',
  'The finite rack is rendered modulo tooth pitch, resetting its whole slotted body each tooth.',
  'Visible base, rear post, guide blocks, face ticks and slot-ring hardware are added to the engraving.'],
 qualification:'Preliminary source/code inspection while 079 verification continues. Source crop and actual model views still require inspection; no 080 reconstruction has been implemented.'};
await writeFile('artifacts/review/080-baseline-inputs.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({factoryCharacters:end-start,testCharacters:testEnd-testStart,crop,rectangle,sources:sources.length});
