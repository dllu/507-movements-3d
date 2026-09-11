import{readFile,writeFile}from'node:fs/promises';
import{createHash}from'node:crypto';
import{makeJointedTappetContactStudy,vsub}from'./lib/jointed-tappet-contact-study.mjs';

const s=makeJointedTappetContactStudy({nosePixels:[800,711],seatHolding:true}),p=s.parameters,N=s.noseAt(0),rows=[];
let cases=0,clear=0;
for(let dx=-40;dx<=40;dx+=2)for(let dy=-30;dy<=60;dy+=2){
  cases++;const pivotPixels=[994+dx,671+dy],P=[(pivotPixels[0]-p.center[0])/p.scale,(p.center[1]-pivotPixels[1])/p.scale],V=vsub(N,P);
  try{const B=s.wheel.closeCircle(P,V,p.wheelStart,p.noseRadius,{lower:-1.3,upper:0});if(!B.stop)continue;}
  catch{continue;}clear++;rows.push({pivotPixels,dx,dy,displacement:Math.hypot(dx,dy)});
}
rows.sort((a,b)=>a.displacement-b.displacement);
const report={movement:76,status:'provisional-joint-reset-range',productionChanged:false,cases,clear,parameters:p,rows,
  source:{file:'scripts/study-jointed-tappet-joint-range.mjs',sha256:createHash('sha256').update(await readFile('scripts/study-jointed-tappet-joint-range.mjs')).digest('hex')},
  qualification:'Changes only the dog hinge position relative to the fixed C and fixed source-pose nose. The source-pose rigid nose orbit about C, and therefore the locked-stop drive envelope, are unchanged. This diagnoses how far the joint must move to make the first CCW-closing dog orbit reach the assumed stop. No shifted joint is accepted as source-faithful or mechanically verified.'};
await writeFile('artifacts/review/076-joint-reset-range.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({cases,clear,best:rows.slice(0,12)});
