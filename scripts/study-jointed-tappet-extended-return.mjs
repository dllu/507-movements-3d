import{readFile,writeFile}from'node:fs/promises';
import{createHash}from'node:crypto';
import{makeJointedTappetContactStudy}from'./lib/jointed-tappet-contact-study.mjs';

const study=makeJointedTappetContactStudy({nosePixels:[800,711],seatHolding:true}),p=study.parameters,
  restQ=.30,minimumQ=-1.86,theta=p.wheelStart+p.pitch,rows=[],failures=[],releaseTransitions=[];
let previous=null;
for(let i=0;i<=1600;i++){
  const q=minimumQ+(restQ-minimumQ)*i/1600;
  try{
    const B=study.closeB(q,theta),row={q,B};rows.push(row);
    if(previous&&B.stop&&!previous.B.stop)releaseTransitions.push({previousQ:previous.q,q,previousAngle:previous.B.angle,angle:B.angle});
    previous=row;
  }catch(error){failures.push({q,error:error.message});}
}
const sourceSetup={q:0,alpha:0,wheelAngle:p.wheelStart,initialGap:study.gap(0,p.wheelStart),
  holding:study.closeH(p.wheelStart)},start=study.closeB(restQ,p.wheelStart),end=study.closeB(restQ,theta),
  endpointError=Math.max(Math.abs(start.angle-end.angle),Math.hypot(...start.center.map((x,i)=>x-end.center[i]))),
  report={movement:76,status:'extended-return-geometry-candidate',productionChanged:false,mechanicsPassed:false,
    parameters:{...p,restQ,minimumQ},sourceSetup,rows,failures,releaseTransitions,start,end,endpointError,
    source:{file:'scripts/study-jointed-tappet-extended-return.mjs',sha256:createHash('sha256').update(await readFile('scripts/study-jointed-tappet-extended-return.mjs')).digest('hex')},
    qualification:'Additional return travel to q=0.30 rad allows the ideal dog to reach its assumed stop at both cycle endpoints. Source setup q=0, alpha=0 is separately nonpenetrating and may be used as a released initial condition; it is not the repeated resting state. The contact branch loses support near q=0.259 rad and the quasistatic angle then jumps. Gravity dynamics must replace that jump. Actual stop geometry, free return, full loaded drive/rollback, startup transient and finite 3D hardware remain unverified.'};
await writeFile('artifacts/review/076-extended-return-geometry.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({restDegrees:restQ*180/Math.PI,poses:rows.length,endpointError,sourceSetupGap:sourceSetup.initialGap,releaseTransitions,failures});
