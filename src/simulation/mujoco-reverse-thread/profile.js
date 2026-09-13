import source from './source.js';
export function makeReverseThreadProfile({segments=128,clearance=.001,shoeLength=.12,shoeRadius=.022,reversalAngle=.5,workingInset=.065,workingThickness=.09,curvedShoe=false,shoeSegments=24}={}) {
 const e=source.edges,axis=[(e.barrelLeft+e.barrelRight)/2,(e.barrelTop+e.barrelBottom)/2],radius=(e.barrelRight-e.barrelLeft)/200;
 const x=p=>(p-axis[0])/100,y=p=>(axis[1]-p)/100,pitch=source.fit.pitch/100,lead=pitch/(2*Math.PI),half=source.turns*2*Math.PI,period=half*2,d=reversalAngle;
 const stroke=lead*(half-d),top=y(source.fit.firstCrossing-source.fit.pitch/2+source.fit.pitch*d/(4*Math.PI)),phase=Math.PI;
 const law=a=>{const b=((a%period)+period)%period,t=Math.min(b,period-b);let s,derivative;
  if(t<d){const u=t/d;s=lead*d*(u**3-u**4/2);derivative=lead*(3*u*u-2*u**3);}
  else if(t>half-d){const u=(half-t)/d;s=stroke-lead*d*(u**3-u**4/2);derivative=lead*(3*u*u-2*u**3);}
  else{s=lead*(t-d/2);derivative=lead;}
  return {y:top-s,derivative:b>half?derivative:-derivative};};
 const workingLow=radius-workingInset,workingHigh=workingLow+workingThickness,floor=curvedShoe?radius-.01-workingThickness-.01:workingLow-.01;
 const tiltRadius=curvedShoe?radius-.01-workingThickness/2:workingLow;
 const shoeZ=(u,side)=>curvedShoe?Math.sqrt((radius-.01)**2-u*u)-(side?0:workingThickness):side?workingHigh:workingLow;
 // A radial spindle lets the elongated shoe swivel between the two helices.
 const contactAngle=-Math.PI/2;
 const initialParameter=Array.from({length:source.turns*2},(_,k)=>contactAngle-phase+2*Math.PI*k).sort((a,b)=>Math.abs(law(a).y-y(source.tip[1]))-Math.abs(law(b).y-y(source.tip[1])))[0];
 const initialY=law(initialParameter).y,initialTilt=Math.atan2(law(initialParameter).derivative,tiltRadius);
 const contour=(length=shoeLength,r=shoeRadius)=>Array.from({length:34},(_,i)=>{
  const right=i<17,a=right?-Math.PI/2+Math.PI*i/16:Math.PI/2+Math.PI*(i-17)/16;
  return[(right?length:-length)+r*Math.cos(a),r*Math.sin(a)];});
 const cutter=contour(shoeLength,shoeRadius+clearance),lanes=source.turns*2,cache=new Map();
 // Sweep the actual tangent-plane shoe through a neighborhood of each material
 // angle. Project its radial extremes to avoid a groove crossing its corners.
 function boundaries(angle) {
  if(cache.has(angle))return cache.get(angle);
  const result=[];
  for(let lane=0;lane<lanes;lane++) {
   const a=angle-phase+lane*2*Math.PI;let low=Infinity,high=-Infinity;
   const span=Math.atan2(shoeLength+shoeRadius+clearance,shoeZ(shoeLength+shoeRadius+clearance,0))*1.1;
   for(let j=0;j<=48;j++) {
    const t=a-span+2*span*j/48,s=law(t),tilt=Math.atan2(s.derivative,tiltRadius),c=Math.cos(tilt),sn=Math.sin(tilt);
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
  workingLow,workingHigh,curvedShoe,shoeSegments,shoeZ,tiltRadius,floor,lanes,boundaries,contactAngle,initialParameter,initialY,initialTilt,
  bottom:y(e.barrelBottom),ceiling:y(e.barrelTop),shaftRadius:(e.shaftRight-e.shaftLeft)/200,
  guideX:x((e.guideLeft+e.guideRight)/2),guideRadius:(e.guideRight-e.guideLeft)/200};
}
