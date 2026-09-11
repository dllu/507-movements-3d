import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {makeJointedTappetContactStudy} from './lib/jointed-tappet-contact-study.mjs';

const rows=[];
for(const nosePixels of [[805,711],[805,699],[811,686],[803,680]])for(const phaseOffset of [-.035,0,.035]){
  const study=makeJointedTappetContactStudy({nosePixels,phaseOffset}),result=study.traceDrive({steps:600});
  rows.push({parameters:study.parameters,...result});
}
const report={movement:76,status:'isolated-locked-dog-drive-study',productionChanged:false,rows,
  source:{file:'scripts/lib/jointed-tappet-contact-study.mjs',sha256:createHash('sha256').update(await readFile('scripts/lib/jointed-tappet-contact-study.mjs')).digest('hex')},
  qualification:'Circular noses at four provisional readings are fixed to the tappet through a hypothetical unilateral joint stop. The wheel advances only when actual polygon/nose penetration requires a positive rotation. This study neither prescribes a one-tooth advance nor establishes that the stop reaction is admissible. Stud contact, holding pawl, return and 3D solids remain outside its scope.'};
await writeFile('artifacts/review/076-locked-dog-drive-study.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(rows.map(r=>({nose:r.parameters.nosePixels,phase:r.parameters.phaseOffset,maximumTeeth:r.maximumTeeth,
  contacts:r.contacts,largestJump:r.largestJump,failures:r.failures})));
