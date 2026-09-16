// Independent 2D finite segment/capsule checks. A radial pin's full 3D
// projection is enclosed by this capsule, so positive projected clearance is
// conservative for every axial slice of the rendered pin and its seat.
function pointOnSegment(x,y,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy,t=l?Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/l)):0;return[a[0]+t*dx,a[1]+t*dy];}
function closestSegments(a,b,c,d){
 const ux=b[0]-a[0],uy=b[1]-a[1],vx=d[0]-c[0],vy=d[1]-c[1],wx=c[0]-a[0],wy=c[1]-a[1],den=ux*vy-uy*vx;
 if(Math.abs(den)>1e-15){const t=(wx*vy-wy*vx)/den,s=(wx*uy-wy*ux)/den;if(t>=0&&t<=1&&s>=0&&s<=1){const q=[a[0]+t*ux,a[1]+t*uy];return{distance:0,p:q,q};}}
 const pairs=[[a,pointOnSegment(...a,c,d)],[b,pointOnSegment(...b,c,d)],[pointOnSegment(...c,a,b),c],[pointOnSegment(...d,a,b),d]];
 let result={distance:Infinity};for(const[p,q]of pairs){const distance=Math.hypot(p[0]-q[0],p[1]-q[1]);if(distance<result.distance)result={distance,p,q};}return result;
}
export function radialPinProfileAudit(model,points,phases){
 const d=model.root.userData,g=d.geometry,b=d.blocks;let minimum=Infinity,maxWorking=0,worstGap,worstPenetration,branches={};
 for(const phase of phases){
  const s=d.stateAtTime(d.transmission.cyclePeriod*phase),ca=Math.cos(-s.pinionAngle),sa=Math.sin(-s.pinionAngle);let nearest=Infinity,active;
  for(const pin of b.pinRoots){
   const a=pin.rotation.z+Math.PI/2+s.wheelAngle,xw=g.toothPitchRadius*Math.cos(a)-s.pinionCenter.x,yw=g.toothPitchRadius*Math.sin(a)-s.pinionCenter.y,x=xw*ca-yw*sa,y=xw*sa+yw*ca;
   if(Math.hypot(x,y)>.61)continue;
   const ux=Math.cos(a-s.pinionAngle),uy=Math.sin(a-s.pinionAngle),c=[x-.065*ux,y-.065*uy],e=[x+.065*ux,y+.065*uy];let inside=false;
   for(let i=0;i<points.length;i++){
    const p=points[i],q=points[(i+1)%points.length];
    if((p[1]>y)!==(q[1]>y)&&x<(q[0]-p[0])*(y-p[1])/(q[1]-p[1])+p[0])inside=!inside;
    const r=closestSegments(p,q,c,e),gap=r.distance-.052;
    if(gap<nearest){nearest=gap;active={pin:pin.userData.index,point:r.p,normal:r.distance?[ (r.p[0]-r.q[0])/r.distance,(r.p[1]-r.q[1])/r.distance ]:[0,0]};}
   }
   if(inside)throw new Error(`phase ${phase}: pin ${pin.userData.index} enclosed by gear`);
  }
  const row=branches[s.branch]??={min:Infinity,max:0};row.min=Math.min(row.min,nearest);row.max=Math.max(row.max,nearest);
  if(nearest<minimum){minimum=nearest;worstPenetration={phase,branch:s.branch,...active};}
  if(nearest>maxWorking){maxWorking=nearest;worstGap={phase,branch:s.branch,...active};}
 }
 return{minimum,maxWorking,worstGap,worstPenetration,branches};
}
