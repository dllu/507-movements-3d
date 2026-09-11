import {readFile,writeFile} from 'node:fs/promises';
import {projectOpenRimTappet} from './lib/open-rim-tappet-study.mjs';
const source=JSON.parse(await readFile('artifacts/review/071-source-layout-study.json','utf8'));
const turn=2*Math.PI,scale=source.output.radius/1.28,orbit=source.studOrbit.radius/scale,pin=.07,pitch=turn/10,clearance=.00015;
const inner=source.rim.radius/scale,outer=source.driverInnerSolid.radius/scale;
const D=orbit*Math.cos(pitch)+Math.sqrt((inner-pin-clearance)**2-(orbit*Math.sin(pitch))**2);
const seat=Math.acos((D*D+orbit*orbit-(inner-pin)**2)/(2*D*orbit))-pitch;
const inputAngle=Math.atan2(source.driverOuter.center[1]-638,644.5-source.driverOuter.center[0]);
const tappet=[[844,647],[644,627],[645,649],[830,752]].map(q=>{
  const x=(q[0]-source.driverOuter.center[0])/scale,y=(source.driverOuter.center[1]-q[1])/scale;
  return[x*Math.cos(inputAngle)+y*Math.sin(inputAngle),-x*Math.sin(inputAngle)+y*Math.cos(inputAngle)];
});
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const segmentDistance=(q,a,b)=>{
  const x=b[0]-a[0],y=b[1]-a[1],den=x*x+y*y,t=den?Math.max(0,Math.min(1,((q[0]-a[0])*x+(q[1]-a[1])*y)/den)):0;
  return Math.hypot(q[0]-a[0]-t*x,q[1]-a[1]-t*y);
};
const inTappet=q=>{
  let inside=false,distance=Infinity;
  for(let i=0;i<tappet.length;i++){
    const a=tappet[i],b=tappet[(i+1)%tappet.length];distance=Math.min(distance,segmentDistance(q,a,b));
    if((a[1]>q[1])!==(b[1]>q[1])&&q[0]<(b[0]-a[0])*(q[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside?pin+distance:Math.max(0,pin-distance);
};
const trials=[];
for(const upperHalfAngle of [.14,.2,.26,.32,.4])for(const lowerHalfAngle of [.14,.2,.26,.32,.4]){
  const openings=[{center:-.4,half:upperHalfAngle},{center:.95,half:lowerHalfAngle}];
  const ends=openings.flatMap(o=>[-1,1].map(sign=>o.center+sign*o.half)).map(a=>[inner,outer].map(r=>[r*Math.cos(a),r*Math.sin(a)]));
  const inRim=q=>{
    const radius=Math.hypot(...q),angle=Math.atan2(q[1],q[0]);
    const opening=openings.some(o=>Math.abs(wrap(angle-o.center))<o.half);
    let distance=Math.min(...ends.map(([a,b])=>segmentDistance(q,a,b)));
    if(!opening)distance=Math.min(distance,Math.abs(radius-inner),Math.abs(radius-outer));
    return !opening&&radius>inner&&radius<outer?pin+distance:Math.max(0,pin-distance);
  };
  const atAngle=angle=>(advance,details=false)=>{
    let depth=0,witness=null;
    for(let stud=0;stud<10;stud++){
      const q=seat+stud*pitch-advance,x=orbit*Math.cos(q)-D,y=orbit*Math.sin(q);
      const point=[x*Math.cos(angle)+y*Math.sin(angle),-x*Math.sin(angle)+y*Math.cos(angle)];
      for(const[part,value]of[['tappet',inTappet(point)],['guard',inRim(point)]])if(value>depth){depth=value;if(details)witness={part,stud,point};}
    }
    return details?{depth,witness}:depth;
  };
  const parameters={pitch,centerDistance:D,studRadius:pin,studOrbit:orbit,initialQ:seat,rimInner:inner,rimOuter:outer,upperHalfAngle,lowerHalfAngle};
  const result=projectOpenRimTappet({parameters,atAngle,lipschitzBound:orbit},{steps:1040,begin:2.2,end:5.1});
  trials.push(result);console.log({upperHalfAngle,lowerHalfAngle,poses:result.poses,advance:result.actualAdvance,peak:result.maximumSpeed,failure:result.failed[0]?.reason});
}
await writeFile('artifacts/review/071-three-interior-stud-trials.json',JSON.stringify({movement:71,status:'isolated-guard-hypothesis-trials',productionChanged:false,
  method:'Three interior studs, with the extreme pair locked against the inner guard circle. The source dotted and smaller solid circles set guard radii; exact circle-seat geometry adjusts shaft spacing. A four-corner source tappet and two radial opening variants are tested by whole finite-stud monotone projection. The extra inner source mark and the detailed oblique notch edges are not represented; no candidate acceptance or full source reconstruction is claimed.',
  scale,centerDistance:D,sourceCenterDistance:source.centerDistance/scale,spacingDifferencePixels:D*scale-source.centerDistance,initialQ:seat,inputAngle,tappet,trials},null,2)+'\n',{flag:'wx'});
