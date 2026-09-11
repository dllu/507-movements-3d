import{readFile,writeFile}from'node:fs/promises';
import{createHash}from'node:crypto';
import{makeJointedTappetContactStudy}from'./lib/jointed-tappet-contact-study.mjs';

const study=makeJointedTappetContactStudy({nosePixels:[800,711],seatHolding:true}),p=study.parameters,
  drive=study.traceDrive({minimumQ:-1.86,steps:1200}),returnRows=[],holdingRows=[],failures=[];
for(let i=0;i<=1200;i++){
  const q=-1.86*(1-i/1200);
  try{returnRows.push({q,...study.closeB(q,p.wheelStart+p.pitch)});}catch(error){failures.push({kind:'return',q,error:error.message});}
}
for(let i=0;i<=1000;i++){
  const theta=p.wheelStart+drive.maximumAdvance*i/1000;
  try{holdingRows.push({theta,...study.closeH(theta)});}catch(error){failures.push({kind:'holding',theta,error:error.message});}
}
const report={movement:76,status:'isolated-seated-holding-and-return-contact-study',productionChanged:false,
  parameters:p,drive,returnRows,holdingRows,failures,
  source:{file:'scripts/lib/jointed-tappet-contact-study.mjs',sha256:createHash('sha256').update(await readFile('scripts/lib/jointed-tappet-contact-study.mjs')).digest('hex')},
  qualification:'The holding pawl nose radius and orbit determine its loaded rest tooth phase. The dog folds only when its finite circle encounters the wheel on the first exterior branch reached by CCW gravity closure, with a hypothetical upper stop at zero relative angle. The counting wheel is held at one pitch for the return study. The driven trace still retains its maximum overtravel; continuous rollback, reactions, body masses, stud dynamics and 3D interference remain unresolved.'};
await writeFile('artifacts/review/076-seated-holding-return-study.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({maximumTeeth:drive.maximumTeeth,driveFailures:drive.failures,holdingNoseSourceError:p.holdingNoseSourceError,
  returnPoses:returnRows.length,holdingPoses:holdingRows.length,returnAngleRange:[Math.min(...returnRows.map(r=>r.angle)),Math.max(...returnRows.map(r=>r.angle))],
  returnEnd:returnRows.at(-1),failures});
