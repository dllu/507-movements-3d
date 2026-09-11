import{readFile,writeFile}from'node:fs/promises';
import{createHash}from'node:crypto';
import{makeJointedTappetContactStudy,vadd,vrotate}from'./lib/jointed-tappet-contact-study.mjs';

const study=makeJointedTappetContactStudy({nosePixels:[800,711],seatHolding:true}),p=study.parameters,
  theta=p.wheelStart+p.pitch,restQ=Number(process.env.REST_Q??0),rows=[],failures=[],releases=[];
let alpha=0;
for(let i=0;i<=4000;i++){
  const q=-1.86+(restQ+1.86)*i/4000,previousAlpha=alpha,previousContact=rows.at(-1)?.B.contacts.length>0;
  if(study.gap(q,theta,alpha)< -1e-11){
    let high=alpha,low=null;
    for(let j=1;j<=1500;j++){const trial=alpha-.002*j;if(study.gap(q,theta,trial)>=0){low=trial;break;}high=trial;}
    if(low===null){failures.push({kind:'trapped-return-dog',q,alpha});break;}
    for(let j=0;j<40;j++){const mid=(low+high)/2;if(study.gap(q,theta,mid)<0)high=mid;else low=mid;}alpha=low;
  }
  try{
    const B=study.wheel.closeCircle(vadd(p.C,vrotate(p.B,q)),vrotate(p.V,q),theta,p.noseRadius,
      {lower:Math.max(-1.3,alpha-1e-10),upper:0});
    alpha=B.angle;if(previousContact&&B.stop)releases.push({q,previousAlpha,alpha});rows.push({q,B});
  }catch(error){failures.push({q,alpha,error:error.message});break;}
}
const report={movement:76,status:'tracked-return-branch-study',productionChanged:false,mechanicsPassed:false,
  parameters:{...p,restQ},rows,failures,releases,returnEnd:rows.at(-1),endpointClosed:Math.abs(rows.at(-1)?.B.angle??Infinity)<1e-8&&failures.length===0,
  source:{file:'scripts/study-jointed-tappet-tracked-return.mjs',sha256:createHash('sha256').update(await readFile('scripts/study-jointed-tappet-tracked-return.mjs')).digest('hex')},
  qualification:'Preserves the previously occupied angular clearance interval. Each new small overlap is repaired clockwise, then gravity closure searches only from the resulting current angle toward the stop. Earlier independent-pose closure restarted from alpha=-1.3 and could incorrectly jump back to a different exterior interval after the dog had already cleared a tooth. This corrects that diagnostic assumption; finite release time, forces, actual bodies, stud return and continuous wheel rollback are still unverified.'};
await writeFile(process.env.PROBE_OUTPUT??'artifacts/review/076-tracked-return-branch-study.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({poses:rows.length,endpointClosed:report.endpointClosed,returnEnd:report.returnEnd,releases,failures});
