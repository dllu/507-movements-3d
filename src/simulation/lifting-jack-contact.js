// Finite pawls against the triangular rack teeth in the mechanism plane.
// Brown's pawls are curved blades, so each blade is split into convex
// triangles (upper edge, lower edge, shared tip) for separating-axis tests.
export function polygonsOverlap(a,b,tolerance=1e-9){
 for(const p of [a,b])for(let i=0;i<p.length;i++){
  const q=p[(i+1)%p.length],r=p[i],axis=[q[1]-r[1],r[0]-q[0]],scale=Math.hypot(...axis);
  if(scale<1e-14)continue;
  const x=a.map(v=>v[0]*axis[0]+v[1]*axis[1]),y=b.map(v=>v[0]*axis[0]+v[1]*axis[1]);
  if(Math.min(Math.max(...x),Math.max(...y))-Math.max(Math.min(...x),Math.min(...y))<=tolerance*scale)return false;
 }
 return true;
}
export function cubicPoints(a,b,c,d,count=16){
 return Array.from({length:count+1},(_,i)=>{const t=i/count,u=1-t;
  return [u*u*u*a[0]+3*u*u*t*b[0]+3*u*t*t*c[0]+t*t*t*d[0],u*u*u*a[1]+3*u*u*t*b[1]+3*u*t*t*c[1]+t*t*t*d[1]];});
}
// upper and lower edges both start at the shared tip.
export function bladePieces(upper,lower){
 const n=Math.min(upper.length,lower.length),pieces=[[upper[0],upper[1],lower[1]]];
 for(let i=1;i<n-1;i++)pieces.push([upper[i],upper[i+1],lower[i]],[upper[i+1],lower[i+1],lower[i]]);
 return pieces;
}
export function clearRackPieces(pieces,origin,angle,teeth,lift){
 const c=Math.cos(angle),s=Math.sin(angle);
 for(const piece of pieces){
  const p=piece.map(([x,y])=>[origin.x+c*x-s*y,origin.y+s*x+c*y]);
  let minY=Infinity,maxY=-Infinity,minX=Infinity;
  for(const v of p){minY=Math.min(minY,v[1]);maxY=Math.max(maxY,v[1]);minX=Math.min(minX,v[0]);}
  for(const t of teeth){
   const low=t[0][1]+lift,high=t[2][1]+lift;
   if(maxY<low||minY>high||minX>t[1][0])continue;
   if(polygonsOverlap(p,t.map(([x,y])=>[x,y+lift])))return false;
  }
 }
 return true;
}
// A pawl that rests on the rack under gravity or its spring: step through a
// sequence of rack/driver poses, letting the free coordinate fall toward the
// rack until contact, or be pushed out when the rack moves into it. Returns
// one resting value per pose, so the pawl always stays on its own branch of
// the tooth profile.
export function restingContinuation(clearAt,count,start,maximum,step=0.0005,end=null){
 const values=[start];let c=start;
 const bisect=(bad,good,clear)=>{for(let j=0;j<32;j++){const mid=(bad+good)/2;if(clear(mid))good=mid;else bad=mid;}return good;};
 for(let i=1;i<=count;i++){
  const clear=clearAt(i);
  if(clear(c)){
   let a=c;
   while(a>0){const next=Math.max(0,a-step);if(!clear(next)){a=bisect(next,a,clear);break;}a=next;}
   c=a;
  }else{
   // Pushed by the rack: move to the nearest free pose on either side.
   let found=null;
   for(let k=1;found===null;k++){
    const down=c-k*step,up=c+k*step;
    if(down>=0&&clear(down))found=bisect(down+step,down,clear);
    else if(clear(up))found=bisect(up-step,up,clear);
    if(up>maximum)throw new Error('Rack pawl cannot be pushed clear within its range');
   }
   c=found;
  }
  values.push(c);
 }
 // A sequence that ends in a known seat (nose in the root corner) closes on
 // it; the last free pose must already be within reach of the seat.
 if(end!==null){
  if(Math.abs(values[count-1]-end)>0.02)throw new Error(`Rack pawl does not reach its seat: ${values.slice(-8).map(v=>v.toFixed(4))}`);
  values[count]=end;
 }
 return values;
}
// Replace the one instantaneous click in a resting table by an eased fall
// from its crest over easeCount samples; the eased value never lies below the
// resting value.
export function easeClick(values,easeCount){
 let best=0,index=-1;
 for(let i=1;i<values.length;i++){const jump=values[i-1]-values[i];if(jump>best){best=jump;index=i;}}
 const crest=index>0?values[index-1]:0;
 const eased=values.map((v,i)=>{
  if(index<0||i<index)return v;
  const u=Math.min(1,(i-index+1)/easeCount),q=u*u*u*(10+u*(-15+6*u));
  return Math.max(v,crest*(1-q));
 });
 return {values:eased,clickIndex:index,crest,jump:best};
}
export function sampleTable(values,parameter){
 const x=Math.min(Math.max(parameter,0),1)*(values.length-1),i=Math.min(values.length-2,Math.floor(x)),f=x-i;
 return values[i]*(1-f)+values[i+1]*f;
}
