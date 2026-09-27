import {cordTreadleParameters,cordTreadleMetrics} from '../cord-treadle-motion.js';
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
// The massless/slack ideal has no unique shape. This is a geometric
// illustration, not a prediction of equilibrium or finite-rope vibration.
// Pass 72: a real cord's own weight settles the slack. The vertical run from
// the pulley hangs straight to the resting treadle's eye, and its weight
// draws the cord over the free pulley, so the slack collects in the
// diagonal run from the crank pin as a gravity sag: a parabola with a
// vertical axis from the pin to the point where it meets the pulley
// tangentially. `amplitude` is the sag, the vertical drop of the parabola's
// Bezier control point below the chord's midpoint.
const BEZIER_SAMPLES=96;
const bezier=(p,c,e,t)=>[0,1].map(i=>(1-t)**2*p[i]+2*(1-t)*t*c[i]+t*t*e[i]);
function sagRun(pin,g,sag,entryGuess){
 const r=g.guideRadius,G=g.guide,at=a=>[G[0]+r*Math.cos(a),G[1]+r*Math.sin(a)];
 const control=e=>[(pin[0]+e[0])/2,(pin[1]+e[1])/2-sag];
 // End tangent (E - C) must be perpendicular to the radius (E - G).
 const f=a=>{const e=at(a),c=control(e);return(e[0]-c[0])*(e[0]-G[0])+(e[1]-c[1])*(e[1]-G[1]);};
 let low=entryGuess-1e-9,high=entryGuess-1e-9,fl=f(low);
 if(Math.abs(fl)<1e-15)return{entryAngle:low,entry:at(low),control:control(at(low))};
 // Bracket the root next to the taut tangent point, stepping away from it.
 let step=.01,found=false;
 for(let k=0;k<400&&!found;k++){for(const sign of [1,-1]){const a=entryGuess+sign*step*(k+1),fa=f(a);if(fa*fl<=0){if(sign>0){low=entryGuess;high=a;}else{low=a;high=entryGuess;}found=true;break;}}}
 if(!found)throw Error('Cannot seat the sagging cord on its pulley');
 let flo=f(low);for(let i=0;i<60;i++){const mid=(low+high)/2,fm=f(mid);if(fm*flo<=0)high=mid;else{low=mid;flo=fm;}}
 const entryAngle=(low+high)/2,entry=at(entryAngle);return{entryAngle,entry,control:control(entry)};
}
function bezierTable(p,c,e){const pts=Array.from({length:BEZIER_SAMPLES+1},(_,i)=>bezier(p,c,e,i/BEZIER_SAMPLES)),table=[0];for(let i=1;i<pts.length;i++)table.push(table[i-1]+distance(pts[i-1],pts[i]));return{pts,table,length:table.at(-1)};}
export function idealCordShape(disk,treadle,{segments=256,bakedAmplitude=null,geometry=cordTreadleParameters()}={}){
 if(!Number.isInteger(segments)||segments<8)throw new RangeError('At least eight rope segments required');
 if(bakedAmplitude!==null&&(!Number.isFinite(bakedAmplitude)||bakedAmplitude<0))throw new RangeError('Invalid baked amplitude');
 if(!Number.isFinite(disk)||!Number.isFinite(treadle))throw new RangeError('Finite mechanism angles required');
 const g=geometry,m=cordTreadleMetrics(disk,treadle,g),r=g.guideRadius;
 const slack=Math.max(0,g.cordLength-m.length);
 // Taut: the straight incoming run and its pulley tangent point.
 const shapeAt=sag=>{
  if(sag<=0)return{entryAngle:m.entryAngle,entry:m.entry,control:mix(m.pin,m.entry,.5),...bezierTable(m.pin,mix(m.pin,m.entry,.5),m.entry)};
  const seat=sagRun(m.pin,g,sag,m.entryAngle);return{...seat,...bezierTable(m.pin,seat.control,seat.entry)};
 };
 const arcOf=entryAngle=>{let sweep=m.exitAngle-entryAngle;while(sweep>=0)sweep-=Math.PI*2;while(sweep<-Math.PI*2)sweep+=Math.PI*2;return -r*sweep;};
 const lengthAt=sag=>{const s=shapeAt(sag);return s.length+arcOf(s.entryAngle)+m.outgoing;};
 let amplitude=0;
 if(slack&&bakedAmplitude===null){let low=0,high=.05;while(lengthAt(high)<g.cordLength){high*=2;if(high>32)throw Error('Cannot fit slack cord');}for(let i=0;i<48;i++){const middle=(low+high)/2;if(lengthAt(middle)<g.cordLength)low=middle;else high=middle;}amplitude=(low+high)/2;}
 else if(slack&&bakedAmplitude!==null)amplitude=bakedAmplitude;
 const run=shapeAt(amplitude),arc=arcOf(run.entryAngle),incoming=run.length;
 const atLength=s=>{const {pts,table}=run;let lo=0,hi=pts.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(table[mid]<s)lo=mid;else hi=mid;}const span=table[hi]-table[lo];return mix(pts[lo],pts[hi],span?Math.min(1,Math.max(0,(s-table[lo])/span)):0);};
 const total=incoming+arc+m.outgoing;
 const points=Array.from({length:segments+1},(_,i)=>{const s=total*i/segments;let p;if(s<=incoming)p=atLength(s);else if(s<=incoming+arc){const a=run.entryAngle-(s-incoming)/r;p=[g.guide[0]+r*Math.cos(a),g.guide[1]+r*Math.sin(a)];}else p=mix(m.exit,m.eye,(s-incoming-arc)/m.outgoing);return[...p,.64];});
 points[0]=[...m.pin,.64];points[segments]=[...m.eye,.64];
 const reference=cordTreadleMetrics(0,g.initialTreadle,g);
 const pulleyAngle=run.entryAngle-reference.entryAngle+(incoming-reference.incoming)/r;
 return{points,pulleyAngle,slack,amplitude,length:total,lengthError:total-Math.max(g.cordLength,m.length),tendonExtension:Math.max(0,m.length-g.cordLength),controls:[m.pin,run.control,run.entry,m.exit,m.eye],entryAngle:run.entryAngle};
}
