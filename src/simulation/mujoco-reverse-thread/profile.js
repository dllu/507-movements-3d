import source from './source.js';
export function makeReverseThreadProfile({segments=128,clearance=.001,shoeLength=.12,shoeRadius=.022,reversalAngle=.5,workingInset=.065,workingThickness=.09,curvedShoe=false,shoeSegments=24,optimizeTilt=false,optimizeReversalTilt=false,coreRadius}={}) {
 const e=source.edges,axis=[(e.barrelLeft+e.barrelRight)/2,(e.barrelTop+e.barrelBottom)/2],radius=(e.barrelRight-e.barrelLeft)/200;
 const x=p=>(p-axis[0])/100,y=p=>(axis[1]-p)/100,pitch=source.fit.pitch/100,lead=pitch/(2*Math.PI),half=source.turns*2*Math.PI,period=half*2,d=reversalAngle;
 const stroke=lead*(half-d),top=y(source.fit.firstCrossing-source.fit.pitch/2+source.fit.pitch*d/(4*Math.PI)),phase=Math.PI;
 const law=a=>{const b=((a%period)+period)%period,t=Math.min(b,period-b);let s,derivative;
  if(t<d){const u=t/d;s=lead*d*(u**3-u**4/2);derivative=lead*(3*u*u-2*u**3);}
  else if(t>half-d){const u=(half-t)/d;s=stroke-lead*d*(u**3-u**4/2);derivative=lead*(3*u*u-2*u**3);}
  else{s=lead*(t-d/2);derivative=lead;}
  return {y:top-s,derivative:b>half?derivative:-derivative};};
 const workingLow=radius-workingInset,workingHigh=workingLow+workingThickness,floor=coreRadius??(curvedShoe?radius-.01-workingThickness-.01:workingLow-.01);
 let tiltRadius=curvedShoe?radius-.01-workingThickness/2:workingLow;
 const shoeZ=(u,side)=>curvedShoe?Math.sqrt((radius-.01)**2-u*u)-(side?0:workingThickness):side?workingHigh:workingLow;
 // A radial spindle lets the elongated shoe swivel between the two helices.
 const contactAngle=-Math.PI/2;
 const initialParameter=Array.from({length:source.turns*2},(_,k)=>contactAngle-phase+2*Math.PI*k).sort((a,b)=>Math.abs(law(a).y-y(source.tip[1]))-Math.abs(law(b).y-y(source.tip[1])))[0];
 const initialY=law(initialParameter).y;
 const contour=(length=shoeLength,r=shoeRadius)=>Array.from({length:34},(_,i)=>{
  const right=i<17,a=right?-Math.PI/2+Math.PI*i/16:Math.PI/2+Math.PI*(i-17)/16;
  return[(right?length:-length)+r*Math.cos(a),r*Math.sin(a)];});
 // The straight sides in the tangent plane become curved after wrapping around
 // the barrel. Include their interior points before cylindrical projection;
 // joining just the nose endpoints cuts into the middle of the actual shoe.
 const outline=contour(shoeLength,shoeRadius+clearance);
 const cutter=outline.flatMap((p,i)=>{
  const q=outline[(i+1)%outline.length],n=Math.max(1,Math.ceil(Math.abs(q[0]-p[0])/(2*(shoeLength+shoeRadius)/shoeSegments/4)));
  return Array.from({length:n},(_,j)=>p.map((v,k)=>v+(q[k]-v)*j/n));
 }),lanes=source.turns*2,cache=new Map();
 // A long shoe follows a finite arc. Its best flank orientation differs from
 // the tangent at its midpoint. Minimize the swept groove width at constant lead
 // so the two ends constrain yaw instead of removing excess material.
 const support=(tilt,derivative)=>{let low=Infinity,high=-Infinity;const c=Math.cos(tilt),sn=Math.sin(tilt);for(const side of [0,1])for(const [u,v] of cutter){const b=sn*u+c*v-derivative*Math.atan2(c*u-sn*v,shoeZ(u,side));low=Math.min(low,b);high=Math.max(high,b);}return[low,high];};
 if(optimizeTilt) {
  const width=tilt=>{const [low,high]=support(tilt,lead);return high-low;};
  let low=0,high=.45;const ratio=(Math.sqrt(5)-1)/2;let a=high-ratio*(high-low),b=low+ratio*(high-low),wa=width(a),wb=width(b);
  for(let i=0;i<60;i++){if(wa<wb){high=b;b=a;wb=wa;a=high-ratio*(high-low);wa=width(a);}else{low=a;a=b;wa=wb;b=low+ratio*(high-low);wb=width(b);}}
  tiltRadius=lead/Math.tan((low+high)/2);
 }
 const flankBounds=new Map([-lead,lead].map(d=>[d,support(Math.atan2(d,tiltRadius),d)]));
 const span=Math.atan2(shoeLength+shoeRadius+clearance,shoeZ(shoeLength+shoeRadius+clearance,0))*1.1;
 let tilt=a=>Math.atan2(law(a).derivative,tiltRadius);
 if(optimizeReversalTilt) {
  // Fit the whole finite shoe to the end curve, including the part of the shoe
  // already entering a turn while its midpoint is still on a uniform flank.
  // This changes only the machining pose. The simulated swivel remains passive.
  const count=192,extent=d+span;
  const table=Array.from({length:count+1},(_,i)=>{
   if(i===0)return 0;if(i===count)return Math.atan2(lead,tiltRadius);
   const t=extent*i/count,center=law(t).y;
   const width=alpha=>{let low=Infinity,high=-Infinity;const c=Math.cos(alpha),sn=Math.sin(alpha);for(const side of [0,1])for(const [u,v]of cutter){const delta=Math.atan2(c*u-sn*v,shoeZ(u,side)),b=sn*u+c*v-(law(t+delta).y-center);low=Math.min(low,b);high=Math.max(high,b);}return high-low;};
   let lo=-.35,hi=0;const ratio=(Math.sqrt(5)-1)/2;let a=hi-ratio*(hi-lo),b=lo+ratio*(hi-lo),wa=width(a),wb=width(b);
   for(let j=0;j<45;j++){if(wa<wb){hi=b;b=a;wb=wa;a=hi-ratio*(hi-lo);wa=width(a);}else{lo=a;a=b;wa=wb;b=lo+ratio*(hi-lo);wb=width(b);}}
   return -(lo+hi)/2;
  });
  tilt=a=>{const b=((a%period)+period)%period,t=Math.min(b,period-b),distance=Math.min(t,half-t),k=Math.min(count,distance/extent*count),i=Math.floor(k),value=table[i]+(table[Math.min(count,i+1)]-table[i])*(k-i);return (b>half?1:-1)*value;};
 }
 const initialTilt=tilt(initialParameter);
 // Sweep the actual tangent-plane shoe through a neighborhood of each material
 // angle. Project its radial extremes to avoid a groove crossing its corners.
 function boundaries(angle) {
  // A full barrel turn permutes the path lanes. Reuse the identical endpoint
  // values so floating-point phase reduction cannot leave a radial seam cap.
  const turns=Math.floor(angle/(2*Math.PI));
  if(turns){const base=boundaries(angle-turns*2*Math.PI);return Array.from({length:lanes},(_,k)=>{const lane=((k+turns)%lanes+lanes)%lanes;return base.slice(2*lane,2*lane+2);}).flat();}
  if(cache.has(angle))return cache.get(angle);
  const result=[];
  for(let lane=0;lane<lanes;lane++) {
   const a=angle-phase+lane*2*Math.PI;let low=Infinity,high=-Infinity;
   const s=law(a),flank=flankBounds.get(s.derivative);
   // On an affine stroke, eliminate the sweep parameter analytically. The
   // same shoe support applies everywhere along that helix, including at seams.
   const affineSpan=optimizeReversalTilt?2*span:span;
   if(flank&&law(a-affineSpan).derivative===s.derivative&&law(a+affineSpan).derivative===s.derivative){result.push(...flank.map(v=>s.y+v));continue;}
   for(let j=0;j<=48;j++) {
    const t=a-span+2*span*j/48,s=law(t),alpha=tilt(t),c=Math.cos(alpha),sn=Math.sin(alpha);
    for(const side of [0,1]) {
     const p=cutter.map(([u,v])=>[t+Math.atan2(c*u-sn*v,shoeZ(u,side)),s.y+sn*u+c*v]);
     for(let k=0;k<p.length;k++){const b=p[k],q=p[(k+1)%p.length],h=(a-b[0])/(q[0]-b[0]);if(h>=0&&h<=1){const yy=b[1]+h*(q[1]-b[1]);low=Math.min(low,yy);high=Math.max(high,yy);}}
    }
   }
   if(!Number.isFinite(low))throw Error('Empty cutter envelope');result.push(low,high);
  }
  cache.set(angle,result);return result;
 }
 return{source,axis,x,y,radius,pitch,lead,half,period,stroke,top,phase,law,segments,clearance,shoeLength,shoeRadius,contour,
  workingLow,workingHigh,optimizeTilt,optimizeReversalTilt,curvedShoe,shoeSegments,shoeZ,tiltRadius,tilt,floor,lanes,boundaries,contactAngle,initialParameter,initialY,initialTilt,
  bottom:y(e.barrelBottom),ceiling:y(e.barrelTop),shaftRadius:(e.shaftRight-e.shaftLeft)/200,
  guideX:x((e.guideLeft+e.guideRight)/2),guideRadius:(e.guideRight-e.guideLeft)/200};
}
