const turn = 2 * Math.PI;
const add = (a,b) => [a[0]+b[0],a[1]+b[1]];
const sub = (a,b) => [a[0]-b[0],a[1]-b[1]];
const mul = (a,s) => a.map(v=>v*s);
const dot = (a,b) => a[0]*b[0]+a[1]*b[1];
const cross = (a,b) => a[0]*b[1]-a[1]*b[0];
const rotate = (p,a) => [p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a)];
const mod = (a,b) => ((a%b)+b)%b;
export const reciprocatingPawlSource = { center:[627.2241913809899,641.9135290492636],scale:391.0844456767924,
  movingPivot:[257,406],movingNose:[501,315],holdingPivot:[966,294],holdingNose:[948,479],rodJoint:[790,732],
  movingCentroid:[349.8876113958535,328.9993073832941],holdingCentroid:[983.1477693356711,388.9646080914345],
  movingArea:7219,holdingArea:5133 };
export const pawlSourcePoint = p => [(p[0]-reciprocatingPawlSource.center[0])/reciprocatingPawlSource.scale,
  (reciprocatingPawlSource.center[1]-p[1])/reciprocatingPawlSource.scale];

export function makeReciprocatingPawlStudy({teeth=33,rootRadius=.87,faceAngle=.012,noseRadius=.009,backBulge=.018,backSegments=24,
  source=reciprocatingPawlSource,sourcePoseGravity=false,closure='bracket',clockwiseTeeth=false}={}) {
  const pitch=turn/teeth,points=[];
  for(let tooth=0;tooth<teeth;tooth++){
    const root=[rootRadius,0],tip=[Math.cos(faceAngle),Math.sin(faceAngle)],next=[rootRadius*Math.cos(pitch),rootRadius*Math.sin(pitch)],
      middle=mul(add(tip,next),.5),control=add(middle,mul([Math.cos(pitch/2),Math.sin(pitch/2)],backBulge));
    points.push(rotate(root,tooth*pitch));
    for(let i=0;i<backSegments;i++){
      const t=i/backSegments,u=1-t,p=add(add(mul(tip,u*u),mul(control,2*u*t)),mul(next,t*t));
      points.push(rotate(p,tooth*pitch));
    }
  }
  if(clockwiseTeeth){points.reverse();for(const point of points)point[1]*=-1;
    // Begin at the root, followed by the long back, the overhanging tip,
    // and the short working face. The old profile faced the other way.
    points.unshift(points.pop());
  }
  const edges=points.map((a,i)=>{const b=points[(i+1)%points.length],d=sub(b,a),square=dot(d,d),length=Math.sqrt(square);
    return{a,b,d,square,normal:[d[1]/length,-d[0]/length],index:i};});
  const featureDistance=(point,e)=>{const t=Math.max(0,Math.min(1,dot(sub(point,e.a),e.d)/e.square)),p=add(e.a,mul(e.d,t)),delta=sub(point,p),distance=Math.hypot(...delta);
    return{distance,point:p,normal:distance>1e-12?mul(delta,1/distance):e.normal,index:e.index,fraction:t};};
  const distances=point=>edges.map(e=>featureDistance(point,e));
  const closest=point=>{
    let best=null,inside=false;
    for(const e of edges){const f=featureDistance(point,e);if(!best||f.distance<best.distance)best=f;
      if((e.a[1]>point[1])!==(e.b[1]>point[1])&&point[0]<(e.b[0]-e.a[0])*(point[1]-e.a[1])/(e.b[1]-e.a[1])+e.a[0])inside=!inside;}
    return{...best,inside,signedDistance:(inside?-1:1)*best.distance};
  };
  // Find a circular nose simultaneously tangent to the short face and the
  // actual polygonal back flank at one concave root. The full wheel then
  // checks that this seat does not enter a third boundary feature.
  const short=clockwiseTeeth?edges.at(-1):edges[0],direction=mul(short.d,(clockwiseTeeth?-1:1)/Math.sqrt(short.square));
  const centerAt=t=>add(add(clockwiseTeeth?short.b:short.a,mul(short.normal,noseRadius)),mul(direction,t));
  const back=clockwiseTeeth?edges.slice(0,backSegments):edges.slice(-(backSegments)),backDistance=point=>Math.min(...back.map(e=>featureDistance(point,e).distance));
  let low=0,high=.12;
  for(let i=0;i<50;i++){const middle=(low+high)/2;if(backDistance(centerAt(middle))<noseRadius)low=middle;else high=middle;}
  const seat=centerAt(high),seatRadius=Math.hypot(...seat),seatAngle=Math.atan2(seat[1],seat[0]);
  const sourceB=pawlSourcePoint(source.movingNose),PB=pawlSourcePoint(source.movingPivot),
    PH=pawlSourcePoint(source.holdingPivot),sourceH=pawlSourcePoint(source.holdingNose),
    sourceWheelAngle=Math.atan2(sourceB[1],sourceB[0])-seatAngle,
    sourceBarAngle=Math.atan2(PB[1],PB[0])-Math.PI,barRadius=Math.hypot(...PB),
    VB=rotate(sub(rotate(seat,sourceWheelAngle),PB),-sourceBarAngle),VH=sub(sourceH,PH),holdingLength=Math.hypot(...VH),
    sourceBCentroid=rotate(sub(pawlSourcePoint(source.movingCentroid),PB),-sourceBarAngle),
    sourceHCentroid=sub(pawlSourcePoint(source.holdingCentroid),PH);
  const d=Math.hypot(...PH),a=(seatRadius**2-holdingLength**2+d*d)/(2*d),h=Math.sqrt(seatRadius**2-a*a),
    holdingSeat=[(a*PH[0]+h*PH[1])/d,(a*PH[1]-h*PH[0])/d],
    endWheelOffset=mod(Math.atan2(holdingSeat[1],holdingSeat[0])-sourceWheelAngle-seatAngle,pitch)-pitch,
    startWheelOffset=endWheelOffset+pitch,mid=(startWheelOffset+endWheelOffset)/2,amplitude=pitch/2,
    sourcePhase=Math.acos(-mid/amplitude)/turn;
  const massB=1,massH=source.holdingArea/source.movingArea;
  const closePawlBracket=(pivot,vector,wheelAngle)=>{
    const evaluate=angle=>{const center=add(pivot,rotate(vector,angle)),local=rotate(center,-wheelAngle),contact=closest(local);
      return{gap:contact.signedDistance-noseRadius,center,local,contact};};
    let high=.7,last=evaluate(high),low=null;
    if(last.gap<0)throw new Error('Pawl opening bracket is not clear');
    for(let angle=high-.01;angle>=-.7;angle-=.01){const next=evaluate(angle);if(next.gap<0){low=angle;break;}high=angle;last=next;}
    if(low===null)throw new Error('Pawl closing bracket missed the wheel');
    for(let i=0;i<40;i++){const middle=(low+high)/2;if(evaluate(middle).gap<0)low=middle;else high=middle;}
    const result=evaluate(high),contacts=[];
    for(const feature of distances(result.local).filter(f=>Math.abs(f.distance-noseRadius)<1e-8)){
      const normal=rotate(feature.normal,wheelAngle),point=rotate(feature.point,wheelAngle);
      if(contacts.some(c=>dot(c.normal,normal)>1-1e-10))continue;
      contacts.push({point,normal,feature:feature.index,pawlMoment:cross(sub(point,pivot),normal),wheelMoment:-cross(point,normal)});
    }
    return{angle:high,pivot,...result,contacts};
  };
  const closePawlAnalytic=(pivot,vector,wheelAngle)=>{
    const P=rotate(pivot,-wheelAngle),V=rotate(vector,-wheelAngle),radius=Math.hypot(...V),candidates=[];
    const candidate=(center,normal)=>{
      const arm=sub(center,P),angle=Math.atan2(cross(V,arm),dot(V,arm));
      if(angle<-.7||angle>.7||cross(arm,normal)<1e-12)return;
      candidates.push({angle,local:center});
    };
    for(const e of edges){
      const length=Math.sqrt(e.square),tangent=mul(e.d,1/length),base=add(e.a,mul(e.normal,noseRadius)),
        distance=dot(sub(P,base),e.normal),square=radius*radius-distance*distance;
      if(square<0)continue;
      const middle=dot(sub(P,base),tangent),half=Math.sqrt(square);
      for(const along of [middle-half,middle+half])if(along>=-1e-12&&along<=length+1e-12)
        candidate(add(base,mul(tangent,along)),e.normal);
    }
    for(let i=0;i<points.length;i++){
      const previous=edges[(i+edges.length-1)%edges.length],next=edges[i];
      if(cross(previous.d,next.d)<=0)continue;
      const Q=points[i],delta=sub(Q,P),d=Math.hypot(...delta);
      if(d>radius+noseRadius||d<Math.abs(radius-noseRadius))continue;
      const a=(radius*radius-noseRadius*noseRadius+d*d)/(2*d),square=radius*radius-a*a;
      if(square<0)continue;
      const unit=mul(delta,1/d),middle=add(P,mul(unit,a)),height=Math.sqrt(square);
      for(const sign of [-1,1]){
        const center=add(middle,mul([-unit[1],unit[0]],height*sign)),n=sub(center,Q);
        if(dot(n,previous.d)<-1e-12||dot(n,next.d)>1e-12)continue;
        candidate(center,mul(n,1/noseRadius));
      }
    }
    candidates.sort(clockwiseTeeth?(a,b)=>Math.abs(a.angle)-Math.abs(b.angle):(a,b)=>b.angle-a.angle);
    for(const result of candidates){
      const contact=closest(result.local);
      if(Math.abs(contact.signedDistance-noseRadius)>1e-8)continue;
      const contacts=[];
      for(const feature of distances(result.local).filter(f=>Math.abs(f.distance-noseRadius)<1e-8)){
        const normal=rotate(feature.normal,wheelAngle),point=rotate(feature.point,wheelAngle);
        if(contacts.some(c=>dot(c.normal,normal)>1-1e-10))continue;
        contacts.push({point,normal,feature:feature.index,pawlMoment:cross(sub(point,pivot),normal),wheelMoment:-cross(point,normal)});
      }
      return{...result,pivot,center:rotate(result.local,wheelAngle),gap:contact.signedDistance-noseRadius,contact,contacts};
    }
    throw new Error('Analytic pawl closure found no exterior contact');
  };
  const closePawl=closure==='analytic'?closePawlAnalytic:closePawlBracket;
  const sourceBAngle=sourcePoseGravity?closePawl(PB,rotate(VB,sourceBarAngle),sourceWheelAngle).angle:0,
    sourceHAngle=sourcePoseGravity?closePawl(PH,VH,sourceWheelAngle).angle:0;
  const atPhase=(phase,cycle=0)=>{
    const barOffset=mid+amplitude*Math.cos(turn*phase),wheelOffset=(phase<=.5?barOffset:endWheelOffset)-cycle*pitch,
      barAngle=sourceBarAngle+barOffset,wheelAngle=sourceWheelAngle+wheelOffset,
      pivotB=rotate([-barRadius,0],barAngle),B=closePawl(pivotB,rotate(VB,barAngle),wheelAngle),H=closePawl(PH,VH,wheelAngle);
    B.gravityMoment=-9.81*massB*rotate(sourceBCentroid,barAngle+B.angle-sourceBAngle)[0];
    H.gravityMoment=-9.81*massH*rotate(sourceHCentroid,H.angle-sourceHAngle)[0];
    const barVelocity=-amplitude*turn*Math.sin(turn*phase),wheelVelocity=phase<=.5?barVelocity:0;
    return{phase,cycle,barAngle,wheelAngle,barOffset,wheelOffset,barVelocity,wheelVelocity,B,H};
  };
  return{parameters:{teeth,rootRadius,faceAngle,noseRadius,backBulge,backSegments,clockwiseTeeth,pitch,sourceWheelAngle,sourceBarAngle,
    barRadius,VB,VH,PH,sourceBCentroid,sourceHCentroid,massB,massH,seat,seatRadius,seatAngle,startWheelOffset,endWheelOffset,sourcePhase,
    sourcePoseGravity,sourceBAngle,sourceHAngle,closure},
    points,edges,closest,distances,atPhase};
}

function solve3(matrix,rhs){
  const a=matrix.map((row,i)=>[...row,rhs[i]]);
  for(let i=0;i<3;i++){
    let pivot=i;for(let j=i+1;j<3;j++)if(Math.abs(a[j][i])>Math.abs(a[pivot][i]))pivot=j;
    if(Math.abs(a[pivot][i])<1e-10)return null;[a[i],a[pivot]]=[a[pivot],a[i]];
    const divisor=a[i][i];for(let k=i;k<=3;k++)a[i][k]/=divisor;
    for(let j=0;j<3;j++)if(j!==i){const factor=a[j][i];for(let k=i;k<=3;k++)a[j][k]-=factor*a[i][k];}
  }
  return a.map(row=>row[3]);
}

export function solvePawlReactions(state,outputLoad){
  const columns=[...state.B.contacts.map(c=>({kind:'B',...c,column:[c.pawlMoment,0,c.wheelMoment]})),
    ...state.H.contacts.map(c=>({kind:'H',...c,column:[0,c.pawlMoment,c.wheelMoment]}))],rhs=[-state.B.gravityMoment,-state.H.gravityMoment,-outputLoad],solutions=[];
  for(let i=0;i<columns.length;i++)for(let j=i+1;j<columns.length;j++)for(let k=j+1;k<columns.length;k++){
    const chosen=[i,j,k],matrix=[0,1,2].map(row=>chosen.map(c=>columns[c].column[row])),reactions=solve3(matrix,rhs);
    if(!reactions||reactions.some(v=>v< -1e-8))continue;
    const residual=matrix.map((row,i)=>dot3(row,reactions)-rhs[i]);
    solutions.push({chosen,reactions,residual,contacts:chosen.map(i=>columns[i])});
  }
  return solutions.sort((a,b)=>Math.hypot(...a.reactions)-Math.hypot(...b.reactions))[0]??null;
}
const dot3=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);

export function pawlLoadIntervals(state){
  const columns=[...state.B.contacts.map(c=>[c.pawlMoment,0,c.wheelMoment]),
    ...state.H.contacts.map(c=>[0,c.pawlMoment,c.wheelMoment])],intervals=[];
  for(let i=0;i<columns.length;i++)for(let j=i+1;j<columns.length;j++)for(let k=j+1;k<columns.length;k++){
    const chosen=[i,j,k],matrix=[0,1,2].map(row=>chosen.map(c=>columns[c][row])),
      base=solve3(matrix,[-state.B.gravityMoment,-state.H.gravityMoment,0]),slope=solve3(matrix,[0,0,-1]);
    if(!base||!slope)continue;let low=-Infinity,high=Infinity,okay=true;
    for(let n=0;n<3;n++){
      if(Math.abs(slope[n])<1e-12){if(base[n]<-1e-8)okay=false;}
      else if(slope[n]>0)low=Math.max(low,-base[n]/slope[n]);else high=Math.min(high,-base[n]/slope[n]);
    }
    if(okay&&high>=low)intervals.push({low,high,chosen});
  }
  return intervals;
}

export function pawlForceHalfPlanes(state){
  const columns=[...state.B.contacts.map(c=>[c.pawlMoment,0,c.wheelMoment]),
    ...state.H.contacts.map(c=>[0,c.pawlMoment,c.wheelMoment])];
  if(columns.length!==3)return null;
  const matrix=[0,1,2].map(row=>columns.map(c=>c[row])),
    base=solve3(matrix,[-state.B.gravityMoment,0,0]),load=solve3(matrix,[0,0,-1]),mass=solve3(matrix,[0,-state.H.gravityMoment,0]);
  if(!base||!load||!mass)return null;
  return base.map((a,i)=>({constant:a,load:load[i],mass:mass[i]}));
}
