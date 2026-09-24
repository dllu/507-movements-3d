import {cordTreadleParameters,cordTreadleMetrics} from '../cord-treadle-motion.js';
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
function integrate(f,a=0,b=1,tolerance=1e-9){
 const middle=(a+b)/2,fa=f(a),fm=f(middle),fb=f(b),initial=(b-a)*(fa+4*fm+fb)/6;
 const recurse=(a,b,fa,fm,fb,whole,tol,depth)=>{const m=(a+b)/2,fl=f((a+m)/2),fr=f((m+b)/2),left=(m-a)*(fa+4*fl+fm)/6,right=(b-m)*(fm+4*fr+fb)/6,delta=left+right-whole;if(depth===0||Math.abs(delta)<=15*tol)return left+right+delta/15;return recurse(a,m,fa,fl,fm,left,tol/2,depth-1)+recurse(m,b,fm,fr,fb,right,tol/2,depth-1);};
 return recurse(a,b,fa,fm,fb,initial,tolerance,18);
}
// The massless/slack ideal has no unique shape. This is a geometric
// illustration, not a prediction of equilibrium or finite-rope vibration.
// Slack in the outgoing run bows it sideways, away from the incoming run,
// as a smooth lateral bulge that leaves the pulley tangentially and arrives
// at the treadle eye along the straight cord's line. The cord therefore never
// drops below the resting treadle bar and hooks back up to its eye.
export function idealCordShape(disk,treadle,{segments=256,bakedAmplitude=null,geometry=cordTreadleParameters()}={}){
 if(!Number.isInteger(segments)||segments<8)throw new RangeError('At least eight rope segments required');
 if(bakedAmplitude!==null&&(!Number.isFinite(bakedAmplitude)||bakedAmplitude<0))throw new RangeError('Invalid baked amplitude');
 if(!Number.isFinite(disk)||!Number.isFinite(treadle))throw new RangeError('Finite mechanism angles required');
 const g=geometry,m=cordTreadleMetrics(disk,treadle,g),arc=-g.guideRadius*m.sweep;
 const slack=Math.max(0,g.cordLength-m.length),target=m.outgoing+slack;
 const p0=m.exit,p3=m.eye,run=[p3[0]-p0[0],p3[1]-p0[1]],runLength=Math.hypot(...run);
 // The run points down; its left-hand normal (-y, x) points away from the
 // incoming run on the pulley's other side.
 const normal=[-run[1]/runLength,run[0]/runLength];
 const bulge=t=>16*t*t*(1-t)*(1-t),bulgeSlope=t=>32*t*(1-t)*(1-2*t);
 const curveAt=(t,amplitude)=>{const b=amplitude*bulge(t);return[p0[0]+run[0]*t+normal[0]*b,p0[1]+run[1]*t+normal[1]*b];};
 const derivativeAt=(t,amplitude)=>{const b=amplitude*bulgeSlope(t);return[run[0]+normal[0]*b,run[1]+normal[1]*b];};
 const length=amplitude=>integrate(t=>Math.hypot(...derivativeAt(t,amplitude)));
 let low=0,high=slack?Math.max(.1,slack):0;
 if(slack&&bakedAmplitude===null){while(length(high)<target){high*=2;if(high>32)throw Error('Cannot fit slack cord');}for(let i=0;i<42;i++){const middle=(low+high)/2;if(length(middle)<target)low=middle;else high=middle;}}
 const amplitude=slack?(bakedAmplitude??(low+high)/2):0;
 let outgoingLength=bakedAmplitude===null?length(amplitude):0;
 // Arc-length lookup controls material spacing; analytic integration above
 // determines length, independently of this rendering tessellation.
 const table=[0],count=bakedAmplitude===null?1024:256;let previous=curveAt(0,amplitude);
 for(let i=1;i<=count;i++){const p=curveAt(i/count,amplitude);table.push(table.at(-1)+distance(previous,p));previous=p;}
 if(bakedAmplitude!==null)outgoingLength=table.at(-1);
 const atLength=s=>{const wanted=s/outgoingLength*table.at(-1);let lo=0,hi=count;while(hi-lo>1){const mid=(lo+hi)>>1;if(table[mid]<wanted)lo=mid;else hi=mid;}const t=(lo+(wanted-table[lo])/(table[hi]-table[lo]))/count;return curveAt(t,amplitude);};
 const total=m.incoming+arc+outgoingLength;
 const points=Array.from({length:segments+1},(_,i)=>{const s=total*i/segments;let p;if(s<=m.incoming)p=mix(m.pin,m.entry,s/m.incoming);else if(s<=m.incoming+arc){const a=m.entryAngle-(s-m.incoming)/g.guideRadius;p=[g.guide[0]+g.guideRadius*Math.cos(a),g.guide[1]+g.guideRadius*Math.sin(a)];}else p=atLength(s-m.incoming-arc);return[...p,.64];});
 points[0]=[...m.pin,.64];points[segments]=[...m.eye,.64];
 const reference=cordTreadleMetrics(0,g.initialTreadle,g);
 const pulleyAngle=m.entryAngle-reference.entryAngle+(m.incoming-reference.incoming)/g.guideRadius;
 return{points,pulleyAngle,slack,amplitude,length:total,lengthError:outgoingLength-target,tendonExtension:Math.max(0,m.length-g.cordLength),controls:[p0,mix(p0,p3,.5),p3]};
}
