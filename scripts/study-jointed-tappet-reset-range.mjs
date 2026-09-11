import{readFile,writeFile}from'node:fs/promises';
import{createHash}from'node:crypto';
import{makeJointedTappetContactStudy,vsub,vrotate}from'./lib/jointed-tappet-contact-study.mjs';

const rows=[],errors=[];let cases=0,initialClear=0,resetClear=0,fullStep=0;
for(const rootRadius of [.84,.87,.90])for(const faceAngle of [-.06,-.025,0])for(const noseRadius of [.006,.012])
for(const holdingNosePixels of [[170,345],[173,352],[176,359]]){
  const study=makeJointedTappetContactStudy({rootRadius,faceAngle,noseRadius,holdingNosePixels,seatHolding:true}),p=study.parameters,
    d=Math.hypot(...p.C),axisAngle=Math.atan2(p.C[1],p.C[0]);
  for(let x=795;x<=825;x+=3)for(let y=690;y<=738;y+=4){
    cases++;const nosePixels=[x,y],N=[(x-p.center[0])/p.scale,(p.center[1]-y)/p.scale],V=vsub(N,p.PB),
      L=Math.hypot(...vsub(N,p.C)),cosine=(1+d*d-(L+noseRadius)**2)/(2*d);
    if(cosine>1||cosine< -1)continue;
    const maximumAngle=axisAngle+Math.acos(cosine),tipAtRest=p.wheelStart+faceAngle+
      Math.ceil((Math.atan2(N[1],N[0])-p.wheelStart-faceAngle)/p.pitch)*p.pitch,
      maximumTeeth=(maximumAngle-tipAtRest)/p.pitch,gap=study.wheel.closest(vrotate(N,-p.wheelStart)).signedDistance-noseRadius;
    if(gap< -1e-9)continue;initialClear++;
    let closed;try{closed=study.wheel.closeCircle(p.PB,V,p.wheelStart,noseRadius,{lower:-1.3,upper:0});}
    catch(error){errors.push({rootRadius,faceAngle,noseRadius,holdingNosePixels,nosePixels,error:error.message});continue;}
    if(closed.stop)resetClear++;if(maximumTeeth>=1.01&&maximumTeeth<1.9)fullStep++;
    if(closed.stop&&maximumTeeth>=1.01&&maximumTeeth<1.9)rows.push({rootRadius,faceAngle,noseRadius,holdingNosePixels,nosePixels,
      maximumTeeth,sourceNoseDisplacement:Math.hypot(x-805,y-711),holdingNoseSourceError:p.holdingNoseSourceError,gap});
  }
}
rows.sort((a,b)=>(a.sourceNoseDisplacement+a.holdingNoseSourceError)-(b.sourceNoseDisplacement+b.holdingNoseSourceError));
const validations=[];
for(const candidate of rows.slice(0,10)){
  const s=makeJointedTappetContactStudy({...candidate,seatHolding:true}),trace=s.traceDrive({steps:1800}),end=s.closeB(0,s.parameters.wheelStart+s.parameters.pitch);
  validations.push({candidate,maximumTeeth:trace.maximumTeeth,maximumFormulaError:candidate.maximumTeeth-trace.maximumTeeth,
    driveFailures:trace.failures,returnEnd:end,contactCount:trace.contacts});
}
const report={movement:76,status:'source-nose-reset-parameter-study',productionChanged:false,cases,initialClear,resetClear,fullStep,
  candidates:rows,validations,errors,
  source:{file:'scripts/lib/jointed-tappet-contact-study.mjs',sha256:createHash('sha256').update(await readFile('scripts/lib/jointed-tappet-contact-study.mjs')).digest('hex')},
  qualification:'Sweeps provisional circular dog centers, tooth root and short-face angles, two nose sizes and three holding-nose readings. A circle-envelope formula screens maximum possible driven-tip angle; up to ten closest successful screen candidates receive independent stepped contact traces. Reset means that the CCW-closing nose orbit reaches the assumed alpha=0 stop at source tappet angle q=0 without crossing the wheel. A successful screen is not force, return-dynamics or body-clearance verification.'};
await writeFile('artifacts/review/076-source-nose-reset-range.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({cases,initialClear,resetClear,fullStep,candidates:rows.length,best:rows.slice(0,10),validations,errors:errors.length});
