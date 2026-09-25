import {cordTreadleParameters,cordTreadleMetrics} from '../cord-treadle-motion.js';
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
// The massless/slack ideal has no unique shape. This is a geometric
// illustration, not a prediction of equilibrium or finite-rope vibration.
// Slack falls: the outgoing run leaves the pulley tangentially, drops toward
// the treadle, and its surplus length settles as a small loop just above the
// bar on its downhill side before the cord returns along the bar and meets its
// eye from above. The cord therefore never crosses the bar in the plate view
// and never bows sideways. `amplitude` is how far the loop reaches downhill
// of the eye along the bar.
const LOOP_CLEARANCE=.18,LOOP_BLEND=.3,SMOOTHING=9;
function chaikin(points,iterations){
 let result=points;
 for(let k=0;k<iterations;k++){const next=[result[0]];for(let i=0;i<result.length-1;i++){const a=result[i],b=result[i+1];next.push(mix(a,b,.25),mix(a,b,.75));}next.push(result.at(-1));result=next;}
 return result;
}
export function idealCordShape(disk,treadle,{segments=256,bakedAmplitude=null,geometry=cordTreadleParameters()}={}){
 if(!Number.isInteger(segments)||segments<8)throw new RangeError('At least eight rope segments required');
 if(bakedAmplitude!==null&&(!Number.isFinite(bakedAmplitude)||bakedAmplitude<0))throw new RangeError('Invalid baked amplitude');
 if(!Number.isFinite(disk)||!Number.isFinite(treadle))throw new RangeError('Finite mechanism angles required');
 const g=geometry,m=cordTreadleMetrics(disk,treadle,g),arc=-g.guideRadius*m.sweep;
 const slack=Math.max(0,g.cordLength-m.length),target=m.outgoing+slack;
 const p0=m.exit,p3=m.eye,run=[p3[0]-p0[0],p3[1]-p0[1]],runLength=Math.hypot(...run),direction=run.map(v=>v/runLength);
 // Bar direction running downhill from the eye toward the foot, and its
 // upward normal. The loop clearance fades in with the first slack so the
 // profile is continuous with the taut straight run.
 const downhill=[-Math.cos(treadle),-Math.sin(treadle)],up=[-Math.sin(treadle),Math.cos(treadle)];
 const clearance=LOOP_CLEARANCE*Math.min(1,slack/LOOP_BLEND),above=[p3[0]+up[0]*clearance,p3[1]+up[1]*clearance];
 const drop=[p0[0]+direction[0]*.85*runLength,p0[1]+direction[1]*.85*runLength];
 const polyline=amplitude=>chaikin([p0,drop,[above[0]+downhill[0]*amplitude,above[1]+downhill[1]*amplitude],above,p3],SMOOTHING);
 const polylineLength=points=>points.slice(1).reduce((sum,p,i)=>sum+distance(p,points[i]),0);
 const length=amplitude=>polylineLength(polyline(amplitude));
 let amplitude=0;
 if(slack&&bakedAmplitude===null&&length(0)<target){let low=0,high=.1;while(length(high)<target){high*=2;if(high>32)throw Error('Cannot fit slack cord');}for(let i=0;i<48;i++){const middle=(low+high)/2;if(length(middle)<target)low=middle;else high=middle;}amplitude=(low+high)/2;}
 else if(slack&&bakedAmplitude!==null)amplitude=bakedAmplitude;
 const path=slack?polyline(amplitude):[p0,p3];
 // Arc-length lookup over the smoothed profile controls material spacing.
 const table=[0];for(let i=1;i<path.length;i++)table.push(table[i-1]+distance(path[i-1],path[i]));
 const outgoingLength=table.at(-1);
 const atLength=s=>{let lo=0,hi=path.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(table[mid]<s)lo=mid;else hi=mid;}const span=table[hi]-table[lo];return mix(path[lo],path[hi],span?Math.min(1,Math.max(0,(s-table[lo])/span)):0);};
 const total=m.incoming+arc+outgoingLength;
 const points=Array.from({length:segments+1},(_,i)=>{const s=total*i/segments;let p;if(s<=m.incoming)p=mix(m.pin,m.entry,s/m.incoming);else if(s<=m.incoming+arc){const a=m.entryAngle-(s-m.incoming)/g.guideRadius;p=[g.guide[0]+g.guideRadius*Math.cos(a),g.guide[1]+g.guideRadius*Math.sin(a)];}else p=atLength(s-m.incoming-arc);return[...p,.64];});
 points[0]=[...m.pin,.64];points[segments]=[...m.eye,.64];
 const reference=cordTreadleMetrics(0,g.initialTreadle,g);
 const pulleyAngle=m.entryAngle-reference.entryAngle+(m.incoming-reference.incoming)/g.guideRadius;
 return{points,pulleyAngle,slack,amplitude,length:total,lengthError:outgoingLength-target,tendonExtension:Math.max(0,m.length-g.cordLength),controls:[p0,drop,p3]};
}
