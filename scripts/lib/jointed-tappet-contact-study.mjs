// Isolated source-scale kinematic study. No production factory depends on it.
export const vadd=(a,b)=>[a[0]+b[0],a[1]+b[1]],vsub=(a,b)=>[a[0]-b[0],a[1]-b[1]],
  vmul=(a,s)=>a.map(v=>v*s),vdot=(a,b)=>a[0]*b[0]+a[1]*b[1],vcross=(a,b)=>a[0]*b[1]-a[1]*b[0],
  vrotate=(a,t)=>[a[0]*Math.cos(t)-a[1]*Math.sin(t),a[0]*Math.sin(t)+a[1]*Math.cos(t)];

export function polygonContact(points){
  const edges=points.map((a,i)=>{const b=points[(i+1)%points.length],d=vsub(b,a),square=vdot(d,d),length=Math.sqrt(square);
    if(length<1e-12)throw new Error('Zero-length profile edge');
    return{a,b,d,square,length,normal:[d[1]/length,-d[0]/length],index:i};});
  const features=point=>edges.map(e=>{
    const fraction=Math.max(0,Math.min(1,vdot(vsub(point,e.a),e.d)/e.square)),p=vadd(e.a,vmul(e.d,fraction)),
      delta=vsub(point,p),distance=Math.hypot(...delta);
    return{distance,point:p,normal:distance>1e-12?vmul(delta,1/distance):e.normal,index:e.index,fraction};
  });
  const closest=point=>{
    let best=null,inside=false;
    for(const f of features(point))if(!best||f.distance<best.distance)best=f;
    for(const e of edges)if((e.a[1]>point[1])!==(e.b[1]>point[1])&&point[0]<(e.b[0]-e.a[0])*(point[1]-e.a[1])/(e.b[1]-e.a[1])+e.a[0])inside=!inside;
    return{...best,inside,signedDistance:(inside?-1:1)*best.distance};
  };
  const closeCircle=(pivot,vector,wheelAngle,radius,{lower=-1,upper=0,requireContact=false}={})=>{
    const P=vrotate(pivot,-wheelAngle),V=vrotate(vector,-wheelAngle),orbit=Math.hypot(...V),candidates=[];
    if(closest(vadd(P,vrotate(V,lower))).signedDistance<radius-1e-9)throw new Error('Opening bracket is obstructed');
    const candidate=(center,normal)=>{
      const arm=vsub(center,P),angle=Math.atan2(vcross(V,arm),vdot(V,arm));
      if(angle<lower-1e-12||angle>upper+1e-12||vcross(arm,normal)>=-1e-12)return;
      candidates.push({angle,local:center});
    };
    for(const e of edges){
      const tangent=vmul(e.d,1/e.length),base=vadd(e.a,vmul(e.normal,radius)),distance=vdot(vsub(P,base),e.normal),square=orbit*orbit-distance*distance;
      if(square<0)continue;
      const middle=vdot(vsub(P,base),tangent),half=Math.sqrt(square);
      for(const along of [middle-half,middle+half])if(along>=-1e-12&&along<=e.length+1e-12)candidate(vadd(base,vmul(tangent,along)),e.normal);
    }
    for(let i=0;i<points.length;i++){
      const previous=edges[(i+edges.length-1)%edges.length],next=edges[i];if(vcross(previous.d,next.d)<=0)continue;
      const Q=points[i],delta=vsub(Q,P),d=Math.hypot(...delta);if(d>orbit+radius||d<Math.abs(orbit-radius))continue;
      const a=(orbit*orbit-radius*radius+d*d)/(2*d),square=orbit*orbit-a*a;if(square<0)continue;
      const unit=vmul(delta,1/d),middle=vadd(P,vmul(unit,a)),height=Math.sqrt(square);
      for(const sign of [-1,1]){
        const center=vadd(middle,vmul([-unit[1],unit[0]],height*sign)),normal=vsub(center,Q);
        if(vdot(normal,previous.d)<-1e-12||vdot(normal,next.d)>1e-12)continue;candidate(center,vmul(normal,1/radius));
      }
    }
    candidates.sort((a,b)=>a.angle-b.angle);
    for(const result of candidates){
      const contact=closest(result.local);if(Math.abs(contact.signedDistance-radius)>1e-8)continue;
      const contacts=[];
      for(const feature of features(result.local).filter(f=>Math.abs(f.distance-radius)<1e-8)){
        const point=vrotate(feature.point,wheelAngle),normal=vrotate(feature.normal,wheelAngle);
        if(contacts.some(c=>vdot(c.normal,normal)>1-1e-10))continue;
        contacts.push({point,normal,feature:feature.index,pawlMoment:vcross(vsub(point,pivot),normal),wheelMoment:-vcross(point,normal)});
      }
      return{...result,pivot,center:vrotate(result.local,wheelAngle),gap:contact.signedDistance-radius,contacts,stop:Math.abs(result.angle-upper)<1e-10};
    }
    if(requireContact)throw new Error('Closing orbit missed wheel');
    const center=vadd(pivot,vrotate(vector,upper)),gap=closest(vrotate(center,-wheelAngle)).signedDistance-radius;
    if(gap< -1e-9)throw new Error('Missed closing contact');
    return{angle:upper,pivot,center,gap,contacts:[],stop:true};
  };
  return{points,edges,features,closest,closeCircle};
}

export function makeJointedTappetContactStudy({rootRadius=.87,faceAngle=-.025,backBulge=.03,backSegments=24,
  noseRadius=.012,nosePixels=[805,699],phaseOffset=0,seatHolding=false,holdingNosePixels=[173,352]}={}){
  const center=[430.6218296914268,591.201567806139],scale=386.44619718290693,
    source=p=>[(p[0]-center[0])/scale,(center[1]-p[1])/scale],
    C=source([1125,637]),PB=source([994,671]),PH=source([271,168]),nose=source(nosePixels),
    B=vsub(PB,C),V=vsub(nose,PB),tipPhase=1.4220984742353362,
    teeth=20,pitch=2*Math.PI/teeth,nominalWheelStart=tipPhase-faceAngle,points=[];
  for(let i=0;i<teeth;i++){
    const root=[rootRadius,0],tip=[Math.cos(faceAngle),Math.sin(faceAngle)],next=vrotate(root,pitch),
      control=vadd(vmul(vadd(tip,next),.5),vmul([Math.cos(pitch/2),Math.sin(pitch/2)],backBulge));
    points.push(vrotate(root,i*pitch));
    for(let j=0;j<backSegments;j++){
      const t=j/backSegments,u=1-t;points.push(vrotate(vadd(vadd(vmul(tip,u*u),vmul(control,2*u*t)),vmul(next,t*t)),i*pitch));
    }
  }
  const wheel=polygonContact(points),short=wheel.edges[0],centerAt=t=>vadd(vadd(short.a,vmul(short.normal,noseRadius)),vmul(short.d,t/short.length)),
    backDistance=point=>Math.min(...wheel.features(point).slice(-backSegments).map(f=>f.distance));
  let low=0,high=.12;for(let i=0;i<50;i++){const mid=(low+high)/2;if(backDistance(centerAt(mid))<noseRadius)low=mid;else high=mid;}
  const seat=centerAt(high),seatRadius=Math.hypot(...seat),nominalH=source(holdingNosePixels),VH=vsub(nominalH,PH),lengthH=Math.hypot(...VH),
    d=Math.hypot(...PH),along=(seatRadius*seatRadius-lengthH*lengthH+d*d)/(2*d),height=Math.sqrt(seatRadius*seatRadius-along*along),
    seats=[-1,1].map(sign=>[(along*PH[0]+sign*height*PH[1])/d,(along*PH[1]-sign*height*PH[0])/d]);
  seats.sort((a,b)=>Math.hypot(...vsub(a,nominalH))-Math.hypot(...vsub(b,nominalH)));
  const holdingSeat=seats[0];let holdingWheelStart=Math.atan2(holdingSeat[1],holdingSeat[0])-Math.atan2(seat[1],seat[0]);
  while(holdingWheelStart<nominalWheelStart-pitch/2)holdingWheelStart+=pitch;
  while(holdingWheelStart>nominalWheelStart+pitch/2)holdingWheelStart-=pitch;
  const wheelStart=(seatHolding?holdingWheelStart:nominalWheelStart)+phaseOffset,
    noseAt=(q,alpha=0)=>vadd(vadd(C,vrotate(B,q)),vrotate(V,q+alpha)),
    gap=(q,theta,alpha=0)=>wheel.closest(vrotate(noseAt(q,alpha),-theta)).signedDistance-noseRadius;
  const closeB=(q,theta)=>wheel.closeCircle(vadd(C,vrotate(B,q)),vrotate(V,q),theta,noseRadius,{lower:-1.3,upper:0}),
    closeH=theta=>wheel.closeCircle(PH,VH,theta,noseRadius,{lower:-.7,upper:.7,requireContact:true});
  const traceDrive=({minimumQ=-1.5,steps=1200}={})=>{
    let theta=wheelStart,maximumAdvance=0,contacts=0,largestJump=0;const rows=[],failures=[];
    if(gap(0,theta)<-1e-9)failures.push({kind:'initial-penetration',gap:gap(0,theta)});
    for(let i=0;i<=steps;i++){
      const q=minimumQ*i/steps;let clearance=gap(q,theta),engaged=false;
      if(clearance< -1e-11){
        let low=theta,high=null;
        for(let j=1;j<=200;j++){const trial=theta+pitch*j/200;if(gap(q,trial)>=0){high=trial;break;}low=trial;}
        if(high===null){failures.push({kind:'wheel-cannot-clear-nose',q,theta,clearance});break;}
        for(let j=0;j<40;j++){const middle=(low+high)/2;if(gap(q,middle)<0)low=middle;else high=middle;}
        largestJump=Math.max(largestJump,high-theta);theta=high;clearance=gap(q,theta);engaged=true;contacts++;
      }
      const point=noseAt(q),advance=theta-wheelStart;maximumAdvance=Math.max(maximumAdvance,advance);
      rows.push({q,theta,advance,teeth:advance/pitch,clearance,engaged,nose:point});
    }
    return{rows,failures,contacts,maximumAdvance,maximumTeeth:maximumAdvance/pitch,largestJump};
  };
  return{parameters:{center,scale,C,PB,PH,B,V,VH,nosePixels,noseRadius,teeth,pitch,wheelStart,rootRadius,faceAngle,backBulge,backSegments,phaseOffset,
    seatHolding,seat,holdingSeat,holdingWheelStart,holdingNosePixels,holdingNoseSourceError:Math.hypot(...vsub(holdingSeat,nominalH))*scale},
    wheel,noseAt,gap,traceDrive,closeB,closeH};
}
