import{readFile,writeFile}from'node:fs/promises';
import{createHash}from'node:crypto';
import{makeJointedTappetContactStudy,vsub,vcross,vdot,vrotate}from'./lib/jointed-tappet-contact-study.mjs';

const rows=[],geometries=[];let cases=0;
for(const rootRadius of [.87,.88,.89,.90])for(const faceAngle of [.025,.0375,.05,.0625,.075]){
  const base=makeJointedTappetContactStudy({rootRadius,faceAngle,nosePixels:[800,711],seatHolding:true}),p=base.parameters,
    arm=vsub(p.holdingSeat,p.PH),seatAngle=Math.atan2(vcross(p.VH,arm),vdot(p.VH,arm)),H=base.closeH(p.wheelStart),
    seatError=H.angle-seatAngle,d=Math.hypot(...p.C),axisAngle=Math.atan2(p.C[1],p.C[0]);
  geometries.push({rootRadius,faceAngle,seatError,holdingSourceError:p.holdingNoseSourceError,contacts:H.contacts});
  if(Math.abs(seatError)>1e-8)continue;
  for(const x of [792,795,798,801,804,807])for(const y of [705,711,717,723]){
    cases++;const N=[(x-p.center[0])/p.scale,(p.center[1]-y)/p.scale],L=Math.hypot(...vsub(N,p.C)),
      cosine=(1+d*d-(L+p.noseRadius)**2)/(2*d);if(cosine>1||cosine< -1)continue;
    const maximumAngle=axisAngle+Math.acos(cosine),tipAtRest=p.wheelStart+faceAngle+
      Math.ceil((Math.atan2(N[1],N[0])-p.wheelStart-faceAngle)/p.pitch)*p.pitch,
      maximumTeeth=(maximumAngle-tipAtRest)/p.pitch,gap=base.wheel.closest(vrotate(N,-p.wheelStart)).signedDistance-p.noseRadius;
    if(maximumTeeth<1.015||maximumTeeth>1.3||gap<0)continue;
    const B=base.wheel.closeCircle(p.PB,vsub(N,p.PB),p.wheelStart,p.noseRadius,{lower:-1.3,upper:0}),
      sourceDisplacement=Math.hypot(x-805,y-711),score=sourceDisplacement+p.holdingNoseSourceError;
    rows.push({rootRadius,faceAngle,nosePixels:[x,y],maximumTeeth,gap,holdingSourceError:p.holdingNoseSourceError,
      sourceDisplacement,score,globalResetAtSource:B.stop,globalReturnAngle:B.angle});
  }
}
rows.sort((a,b)=>a.score-b.score);
const validations=[];
for(const candidate of rows.slice(0,5)){
  const s=makeJointedTappetContactStudy({...candidate,seatHolding:true}),trace=s.traceDrive({steps:1600});
  validations.push({candidate,maximumTeeth:trace.maximumTeeth,failures:trace.failures,contactCount:trace.contacts});
}
const report={movement:76,status:'compatible-holding-seat-and-drive-screen',productionChanged:false,cases,geometries,candidates:rows,validations,
  source:{file:'scripts/study-jointed-tappet-compatible-seats.mjs',sha256:createHash('sha256').update(await readFile('scripts/study-jointed-tappet-compatible-seats.mjs')).digest('hex')},
  qualification:'Positive short-face angles are included because the visible holding-pawl tooth differs from the initially chosen lower-right tooth. The holding seat must be reachable from CCW gravity closure before drive capacity is screened. At most five closest source candidates receive finite stepped drive checks. Body shapes, actual masses, force equilibrium and tracked return still require verification.'};
await writeFile('artifacts/review/076-compatible-holding-drive-study.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({cases,geometries:geometries.length,candidates:rows.length,best:rows.slice(0,8),validations});
