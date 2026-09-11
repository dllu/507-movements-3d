const turn=2*Math.PI,wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const segmentDistance=(q,a,b)=>{
  const x=b[0]-a[0],y=b[1]-a[1],den=x*x+y*y,t=den?Math.max(0,Math.min(1,((q[0]-a[0])*x+(q[1]-a[1])*y)/den)):0;
  return Math.hypot(q[0]-a[0]-t*x,q[1]-a[1]-t*y);
};
export function makeInternalGuardStudy(source,{upperCenter=-.4,upperHalfAngle=.4,lowerCenter=.95,lowerHalfAngle=.4,
  centerDistance,tipExtension=0,rimInner,rimOuter,obliqueOpenings,driverPin=false,additionalDriverPin=false,disableGuard=false}={}){
  const scale=source.output.radius/1.28,orbit=source.studOrbit.radius/scale,pin=.07,pitch=turn/10,clearance=.00015;
  const inner=rimInner??source.rim.radius/scale,outer=rimOuter??source.driverInnerSolid.radius/scale;
  const D=centerDistance??orbit*Math.cos(pitch)+Math.sqrt((inner-pin-clearance)**2-(orbit*Math.sin(pitch))**2);
  const actualInner=centerDistance===undefined?inner:Math.hypot(D-orbit*Math.cos(pitch),orbit*Math.sin(pitch))+pin+clearance;
  const seat=Math.acos((D*D+orbit*orbit-(actualInner-pin)**2)/(2*D*orbit))-pitch;
  const inputAngle=Math.atan2(source.driverOuter.center[1]-638,644.5-source.driverOuter.center[0]);
  const local=q=>{
    const x=(q[0]-source.driverOuter.center[0])/scale,y=(source.driverOuter.center[1]-q[1])/scale;
    return[x*Math.cos(inputAngle)+y*Math.sin(inputAngle),-x*Math.sin(inputAngle)+y*Math.cos(inputAngle)];
  };
  const tappet=[[844,647],[644,627],[645,649],[830,752]].map((q,i)=>{
    const p=local(q);if(i===1||i===2)p[0]+=tipExtension;return p;
  });
  const extra=local(source.extraMark.point);
  const inTappet=q=>{
    if(driverPin)return Math.max(0,2*pin-Math.hypot(q[0]-extra[0],q[1]-extra[1]));
    let inside=false,distance=Infinity;
    for(let i=0;i<tappet.length;i++){
      const a=tappet[i],b=tappet[(i+1)%tappet.length];distance=Math.min(distance,segmentDistance(q,a,b));
      if((a[1]>q[1])!==(b[1]>q[1])&&q[0]<(b[0]-a[0])*(q[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
    }
    return Math.max(inside?pin+distance:Math.max(0,pin-distance),
      additionalDriverPin?2*pin-Math.hypot(q[0]-extra[0],q[1]-extra[1]):0);
  };
  const openings=[{center:upperCenter,half:upperHalfAngle},{center:lowerCenter,half:lowerHalfAngle}];
  const cuts=obliqueOpenings??openings.map(o=>({inner:[o.center-o.half,o.center+o.half],outer:[o.center-o.half,o.center+o.half]}));
  const ends=cuts.flatMap(o=>[0,1].map(i=>[[actualInner*Math.cos(o.inner[i]),actualInner*Math.sin(o.inner[i])],
    [outer*Math.cos(o.outer[i]),outer*Math.sin(o.outer[i])]]));
  const cross=(a,b,q)=>(b[0]-a[0])*(q[1]-a[1])-(b[1]-a[1])*(q[0]-a[0]);
  const cutSides=cuts.map((o,i)=>{
    const angle=(o.inner[0]+o.inner[1]+o.outer[0]+o.outer[1])/4,radius=(actualInner+outer)/2;
    const center=[radius*Math.cos(angle),radius*Math.sin(angle)];
    return ends.slice(i*2,i*2+2).map(([a,b])=>({a,b,sign:Math.sign(cross(a,b,center))}));
  });
  const inArc=(angle,range)=>Math.abs(wrap(angle-(range[0]+range[1])/2))<(range[1]-range[0])/2;
  const inRim=q=>{
    if(disableGuard)return 0;
    const radius=Math.hypot(...q),angle=Math.atan2(q[1],q[0]);
    const opening=cutSides.some(sides=>sides.every(({a,b,sign})=>cross(a,b,q)*sign>0));
    let distance=Math.min(...ends.map(([a,b])=>segmentDistance(q,a,b)));
    if(!cuts.some(o=>inArc(angle,o.inner)))distance=Math.min(distance,Math.abs(radius-actualInner));
    if(!cuts.some(o=>inArc(angle,o.outer)))distance=Math.min(distance,Math.abs(radius-outer));
    return !opening&&radius>actualInner&&radius<outer?pin+distance:Math.max(0,pin-distance);
  };
  const atAngle=angle=>(advance,details=false)=>{
    let depth=0,witness=null;const witnesses=[];
    for(let stud=0;stud<10;stud++){
      const q=seat+stud*pitch-advance,x=orbit*Math.cos(q)-D,y=orbit*Math.sin(q);
      const point=[x*Math.cos(angle)+y*Math.sin(angle),-x*Math.sin(angle)+y*Math.cos(angle)];
      for(const[part,value]of[['tappet',inTappet(point)],['guard',inRim(point)]]){
        if(details&&value>1e-10)witnesses.push({part,stud,depth:value,point,radius:Math.hypot(...point),localAngle:Math.atan2(point[1],point[0])});
        if(value>depth){depth=value;if(details)witness={part,stud,point};}
      }
    }
    return details?{depth,witness,witnesses}:depth;
  };
  const parameters={pitch,centerDistance:D,studRadius:pin,studOrbit:orbit,initialQ:seat,rimInner:actualInner,rimOuter:outer,
    upperCenter,upperHalfAngle,lowerCenter,lowerHalfAngle,tipExtension,scale,inputAngle,driverPin,additionalDriverPin,disableGuard,obliqueOpenings};
  return{parameters,tappet,driverPinCenter:extra,atAngle,lipschitzBound:orbit};
}
