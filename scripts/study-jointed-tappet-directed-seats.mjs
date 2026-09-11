import{readFile,writeFile}from'node:fs/promises';import{createHash}from'node:crypto';
import{makeJointedTappetContactStudy,vsub,vcross,vdot,vrotate}from'./lib/jointed-tappet-contact-study.mjs';
const rows=[],geometries=[];let cases=0,clear=0,envelopeCandidates=0,wrongDirection=0;
for(const rootRadius of [.85,.86,.87,.88,.89,.90])for(const faceAngle of [.035,.045,.055,.065,.075,.085,.095]){
 const base=makeJointedTappetContactStudy({rootRadius,faceAngle,nosePixels:[800,711],seatHolding:true}),p=base.parameters,arm=vsub(p.holdingSeat,p.PH),seatAngle=Math.atan2(vcross(p.VH,arm),vdot(p.VH,arm)),H=base.closeH(p.wheelStart),seatError=H.angle-seatAngle,d=Math.hypot(...p.C),axisAngle=Math.atan2(p.C[1],p.C[0]);
 geometries.push({rootRadius,faceAngle,seatError,holdingSourceError:p.holdingNoseSourceError});if(Math.abs(seatError)>1e-8)continue;
 for(let x=780;x<=806;x+=2)for(let y=682;y<=726;y+=2){
  cases++;const N=[(x-p.center[0])/p.scale,(p.center[1]-y)/p.scale],L=Math.hypot(...vsub(N,p.C)),gap=base.wheel.closest(vrotate(N,-p.wheelStart)).signedDistance-p.noseRadius;if(gap<0)continue;clear++;
  const cosine=(1+d*d-(L+p.noseRadius)**2)/(2*d);if(Math.abs(cosine)>1)continue;
  const maximumAngle=axisAngle+Math.acos(cosine),tipAtRest=p.wheelStart+faceAngle+Math.ceil((Math.atan2(N[1],N[0])-p.wheelStart-faceAngle)/p.pitch)*p.pitch,maximumTeeth=(maximumAngle-tipAtRest)/p.pitch;
  if(maximumTeeth<1.01||maximumTeeth>1.25)continue;envelopeCandidates++;
  const V=vsub(N,p.PB),armC=vsub(N,p.C);let contact=null,lastQ=.3;
  for(let i=0;i<=400;i++){
   const q=.3-1.3*i/400,center=[p.C[0]+vrotate(armC,q)[0],p.C[1]+vrotate(armC,q)[1]],hit=base.wheel.closest(vrotate(center,-p.wheelStart));
   if(hit.signedDistance<p.noseRadius){let lo=q,hi=lastQ;for(let j=0;j<36;j++){const mid=(lo+hi)/2,pos=vrotate(armC,mid).map((v,k)=>v+p.C[k]);if(base.wheel.closest(vrotate(pos,-p.wheelStart)).signedDistance<p.noseRadius)lo=mid;else hi=mid;}
    const q0=(lo+hi)/2,pos=vrotate(armC,q0).map((v,k)=>v+p.C[k]),near=base.wheel.closest(vrotate(pos,-p.wheelStart)),normal=vrotate(near.normal,p.wheelStart);
    contact={q:q0,index:near.index,gap:near.signedDistance-p.noseRadius,wheelMoment:-vcross(pos,normal),dogMoment:vcross(vrotate(V,q0),normal),barMoment:vcross(vrotate(armC,q0),normal)};break;
   }lastQ=q;
  }
  if(!contact||contact.wheelMoment<=0||contact.dogMoment<=0||contact.barMoment<=0){wrongDirection++;continue;}
  const sourceDisplacement=Math.hypot(x-805,y-711),score=sourceDisplacement+p.holdingNoseSourceError+Math.abs(rootRadius-.87)*p.scale+Math.abs(faceAngle-.025)*p.scale;
  rows.push({rootRadius,faceAngle,nosePixels:[x,y],maximumTeeth,gap,holdingSourceError:p.holdingNoseSourceError,sourceDisplacement,score,contact});
 }
}
rows.sort((a,b)=>a.score-b.score);const validations=[];
for(const candidate of rows.slice(0,12)){const c=makeJointedTappetContactStudy({...candidate,seatHolding:true}),trace=c.traceDrive({minimumQ:-1.9,steps:1200});validations.push({candidate,maximumTeeth:trace.maximumTeeth,failures:trace.failures,largestJump:trace.largestJump});}
const report={movement:76,status:'directed-first-contact-and-drive-screen',mechanicsPassed:false,productionChanged:false,cases,clear,envelopeCandidates,wrongDirection,geometries,candidates:rows,validations,sources:[]};
for(const file of ['scripts/study-jointed-tappet-directed-seats.mjs','scripts/lib/jointed-tappet-contact-study.mjs'])report.sources.push({file,sha256:createHash('sha256').update(await readFile(file)).digest('hex')});
report.qualification='Requires reachable holding seat, source-pose clearance, positive wheel and dog moments at first contact, and over-one-pitch envelope. Only the top twelve candidates receive a locked-dog positive-wheel-only stepped check. Dynamics and finite-body clearance remain mandatory.';
await writeFile(process.env.PROBE_OUTPUT??'artifacts/review/076-directed-seats-study.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({cases,clear,envelopeCandidates,wrongDirection,candidates:rows.length,best:rows.slice(0,5),validations});
