import source from './source.js';
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),
 rotate=(v,a)=>[v[0]*Math.cos(a)-v[1]*Math.sin(a),v[0]*Math.sin(a)+v[1]*Math.cos(a)],
 angle=v=>Math.atan2(v[1],v[0]),length=v=>Math.hypot(...v);
export const treadleSourcePoint=p=>[(p[0]-source.center[0])/source.scale,(source.center[1]-p[1])/source.scale];

export function makeTreadleRatchetLinkage({amplitude=.10,period=4,treadleInset=0}={}){
 const fulcrum=treadleSourcePoint(source.circles.treadleFulcrum.center),
  upperEnd=sub(treadleSourcePoint(source.upperStrapPin),fulcrum),lowerEnd=sub(treadleSourcePoint(source.lowerStrapPin),fulcrum),
  attachmentAngle=(angle(upperEnd)+angle(lowerEnd))/2,sourceAngle=(angle(upperEnd)-angle(lowerEnd))/2,
  attachmentRadius=(length(upperEnd)+length(lowerEnd))/2,
  strapLocal=[attachmentRadius*Math.cos(attachmentAngle),attachmentRadius*Math.sin(attachmentAngle)],
  radius=(source.pulley.bottom-source.pulley.top)/(2*source.scale),
  pulley=treadleSourcePoint([(source.pulley.axialEdges[0]+source.pulley.axialEdges[1])/2,(source.pulley.top+source.pulley.bottom)/2]),
  endAt=phi=>add(fulcrum,rotate(strapLocal,phi)),
  strand=(front,rear)=>{
   const f=endAt(front),r=endAt(rear),frontLength=pulley[1]-f[1],rearLength=pulley[1]-r[1],
    transverseLength=frontLength+rearLength+Math.PI*radius,dx=r[0]-f[0];
   if(frontLength<=0||rearLength<=0)throw Error('Strap end above pulley tangent');
   return{front:f,rear:r,frontLength,rearLength,transverseLength,dx,length:Math.hypot(transverseLength,dx)};
  },targetLength=strand(-sourceAngle,sourceAngle).length,
  // Both pawls are one part, so both arms carry them at one radius: the mean
  // of the drawn pivots (313 and 331 px), 9 px from either.
  pawlRadius=(length(treadleSourcePoint(source.circles.lowerPawlPivot.center))+length(treadleSourcePoint(source.circles.upperPawlPivot.center)))/2,
  arms=[['lower',-sourceAngle],['upper',sourceAngle]].map(([name,phi],i)=>{
   const pawl=treadleSourcePoint(source.circles[name+'PawlPivot'].center),top=treadleSourcePoint(source.circles[name+'RodTop'].center),
    bottom=treadleSourcePoint(source[name+'RodBottom']),sourceArmAngle=angle(pawl),
    rodLocal=rotate(sub(bottom,fulcrum),-phi),armRodLocal=rotate(top,-sourceArmAngle),
    armRodRadius=length(armRodLocal),armRodOffset=angle(armRodLocal),rodLength=length(sub(top,bottom)),
    endpointAngle=angle(sub(top,bottom));
   // Select the circle-intersection branch occupied by the source pose.
   const gamma=angle(bottom),cosine=(armRodRadius**2+length(bottom)**2-rodLength**2)/(2*armRodRadius*length(bottom)),
    candidates=[-1,1].map(sign=>({sign,beta:gamma+sign*Math.acos(Math.max(-1,Math.min(1,cosine)))-armRodOffset})),
    difference=a=>Math.atan2(Math.sin(a-sourceArmAngle),Math.cos(a-sourceArmAngle)),
    branch=candidates.sort((a,b)=>Math.abs(difference(a.beta))-Math.abs(difference(b.beta)))[0].sign;
   return{name,sourceTreadleAngle:phi,sourceArmAngle,pawlLocal:[pawlRadius,0],rodLocal,armRodLocal,
    armRodRadius,armRodOffset,rodLength,branch,endpointAngle,armPlane:.18+i*.13,treadlePlane:(i===0?1:-1)*(radius-treadleInset)};
  });
 const atAngle=frontAngle=>{
  let lo=-.18,hi=Math.asin((pulley[1]-fulcrum[1])/attachmentRadius)-attachmentAngle-1e-6;
  if(strand(frontAngle,lo).length<targetLength||strand(frontAngle,hi).length>targetLength)throw Error('No equalizer closure');
  for(let i=0;i<64;i++){const mid=(lo+hi)/2;if(strand(frontAngle,mid).length>targetLength)lo=mid;else hi=mid;}
  const rearAngle=(lo+hi)/2,cable=strand(frontAngle,rearAngle),xAt=s=>cable.front[0]+cable.dx*s/cable.transverseLength,
   points=[[...cable.front,radius]];
  for(let i=0;i<=128;i++){const theta=Math.PI*i/128,s=cable.frontLength+radius*theta;
   points.push([xAt(s),pulley[1]+radius*Math.sin(theta),radius*Math.cos(theta)]);}
  points.push([...cable.rear,-radius]);
  const states=arms.map((arm,i)=>{
   const phi=i===0?frontAngle:rearAngle,bottom=add(fulcrum,rotate(arm.rodLocal,phi)),d=length(bottom),
    cosine=(arm.armRodRadius**2+d*d-arm.rodLength**2)/(2*arm.armRodRadius*d);
   if(Math.abs(cosine)>1)throw Error('Rod cannot close');
   const raw=angle(bottom)+arm.branch*Math.acos(cosine)-arm.armRodOffset,
    beta=arm.sourceArmAngle+Math.atan2(Math.sin(raw-arm.sourceArmAngle),Math.cos(raw-arm.sourceArmAngle)),
    top=rotate(arm.armRodLocal,beta),pawlPivot=rotate(arm.pawlLocal,beta);
   return{name:arm.name,treadleAngle:phi,armAngle:beta,top,bottom,pawlPivot,rodLength:length(sub(top,bottom))};
  });
  return{frontAngle,rearAngle,cable:{...cable,points,contactX:[xAt(cable.frontLength),xAt(cable.frontLength+Math.PI*radius)]},arms:states};
 };
 const sourcePhase=Math.acos(-sourceAngle/amplitude),atTime=time=>atAngle(amplitude*Math.cos(time*2*Math.PI/period+sourcePhase));
 return{atAngle,atTime,parameters:{fulcrum,pulley,radius,strapLocal,sourceAngle,targetLength,amplitude,period,sourcePhase,arms},
  qualification:'Geometric study only. Fixed round strap attachments, tangent straight legs and a geodesic wrap on a broad cylindrical pulley. The strap may drift across the flat face. Pawl dynamics, finite solids, loads and pulley spin/slip remain unverified.'};
}
