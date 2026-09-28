import fs from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {pinnedElbowSource as source,pinnedElbowParameters,pinnedElbowState} from '../src/simulation/pinned-elbow-motion.js';
// Keep the disk and output point fixed. Adjust three measured centers equally.
// The positive full-turn margin avoids an exact change-point mechanism.
const margin=10,origin=[...source.crankPin,...source.input,...source.pivot];
const lengths=x=>{const [px,py,bx,by,ox,oy]=x,[cx,cy]=source.diskCenter;return{r:Math.hypot(px-cx,py-cy),d:Math.hypot(ox-cx,oy-cy),l:Math.hypot(bx-px,by-py),a:Math.hypot(bx-ox,by-oy)};};
const slack=x=>{const {r,d,l,a}=lengths(x);return d-r-l+a;};
const gradient=x=>{const [px,py,bx,by,ox,oy]=x,[cx,cy]=source.diskCenter,{r,d,l,a}=lengths(x);return[-(px-cx)/r+(bx-px)/l,-(py-cy)/r+(by-py)/l,-(bx-px)/l+(bx-ox)/a,-(by-py)/l+(by-oy)/a,(ox-cx)/d+(ox-bx)/a,(oy-cy)/d+(oy-by)/a];};
let x=origin.slice(),iterations=0;
for(;iterations<1000;iterations++){
 const grad=gradient(x),lambda=(margin-slack(x)+grad.reduce((s,g,i)=>s+g*(x[i]-origin[i]),0))/grad.reduce((s,g)=>s+g*g,0);
 const next=origin.map((v,i)=>v+lambda*grad[i]);const change=Math.hypot(...next.map((v,i)=>v-x[i]));x=next;if(change<1e-11)break;
}
assert.ok(iterations<1000);assert.ok(Math.abs(slack(x)-margin)<1e-8);
const projected=x.slice();
// Stage 2 (p90): the bare reach projection leaves the drawn pose next to the
// inner toggle, so the bell crank swings 95 degrees (+21/-75 about the drawn
// pose, output arm pointing nearly straight down) and the output rod leans
// 18 degrees from its guide line. Refine the same three centres by weighted
// least squares from the engraving (the crank pin, which fixes the visible
// crank radius, weighted 3x), subject to: both reach margins >= 10 px, the
// swing within 30 degrees of symmetric about the drawn pose, and the output
// rod within 12 degrees of its vertical guide line. Deterministic
// Nelder-Mead from the projection.
const weights=[3,1,1],swingLimit=30,tiltLimit=12;
const sourceOf=y=>({...source,crankPin:y.slice(0,2),input:y.slice(2,4),pivot:y.slice(4,6)});
const motion=y=>{
 const {r,d,l,a}=lengths(y),inner=d-r-Math.abs(l-a),outer=l+a-d-r;if(inner<margin-1e-6||outer<margin-1e-6)return null;
 const q=pinnedElbowParameters(sourceOf(y));let low=Infinity,high=-Infinity,tilt=0;
 try{for(let i=0;i<=720;i++){const s=pinnedElbowState(q.period*i/720,q),b=s.bellAngle-q.restAngle;low=Math.min(low,b);high=Math.max(high,b);tilt=Math.max(tilt,Math.abs(Math.atan2(s.slider[0]-s.output[0],s.output[1]-s.slider[1])));}}catch{return null;}
 return {inner,outer,swingLowDegrees:low*180/Math.PI,swingHighDegrees:high*180/Math.PI,maximumRodTiltDegrees:tilt*180/Math.PI};
};
const cost=y=>{const m=motion(y);if(!m)return 1e12;let c=0;for(let i=0;i<3;i++)c+=weights[i]*((y[2*i]-origin[2*i])**2+(y[2*i+1]-origin[2*i+1])**2);
 return c+1e4*Math.max(0,Math.abs(m.swingLowDegrees+m.swingHighDegrees)-swingLimit)**2+1e4*Math.max(0,m.maximumRodTiltDegrees-tiltLimit)**2;};
const nelderMead=(f,x0,step,count)=>{const n=x0.length;let S=[x0.slice(),...x0.map((_,i)=>x0.map((v,j)=>v+(i===j?step:0)))],F=S.map(f);
 for(let k=0;k<count;k++){const order=[...S.keys()].sort((a,b)=>F[a]-F[b]);S=order.map(i=>S[i]);F=order.map(i=>F[i]);
  const c=Array(n).fill(0);for(let i=0;i<n;i++)for(let j=0;j<n;j++)c[j]+=S[i][j]/n;
  const xr=c.map((v,j)=>2*v-S[n][j]),fr=f(xr);
  if(fr<F[0]){const xe=c.map((v,j)=>3*v-2*S[n][j]),fe=f(xe);[S[n],F[n]]=fe<fr?[xe,fe]:[xr,fr];}
  else if(fr<F[n-1]){S[n]=xr;F[n]=fr;}
  else{const xc=c.map((v,j)=>(v+S[n][j])/2),fc=f(xc);if(fc<F[n]){S[n]=xc;F[n]=fc;}else for(let i=1;i<=n;i++){S[i]=S[i].map((v,j)=>(S[0][j]+v)/2);F[i]=f(S[i]);}}}
 return S[F.indexOf(Math.min(...F))];};
for(let rep=0;rep<6;rep++)x=nelderMead(cost,x,rep?5:20,6000);
const refined=motion(x);assert.ok(refined&&Math.abs(refined.swingLowDegrees+refined.swingHighDegrees)<swingLimit+.5&&refined.maximumRodTiltDegrees<tiltLimit+.1);
const fitted={...source,crankPin:x.slice(0,2),input:x.slice(2,4),pivot:x.slice(4,6)},g=pinnedElbowParameters(fitted),raw=pinnedElbowParameters(source);
const invalid=[];let minHeight=Infinity;for(let i=0;i<=4096;i++){
 const t=g.period*i/4096;try{pinnedElbowState(t,raw);}catch{invalid.push(i/4096);}
 const s=pinnedElbowState(t,g);const dx=g.pivot[0]-s.pin[0],dy=g.pivot[1]-s.pin[1];minHeight=Math.min(minHeight,Math.abs(dx*(s.input[1]-s.pin[1])-dy*(s.input[0]-s.pin[0]))/Math.hypot(dx,dy));
}
assert.ok(invalid.length>0);const projectedMotion=motion(projected);
const report={movement:157,method:'Read engraving centers; ideal rigid four-bar reach inequality. Stage 1: local constrained least-squares projection of crank pin, upper bell joint and fixed bell pivot onto a 10px inner full-turn reach margin (equal weights, disk and output centers fixed). Stage 2 (p90): weighted least squares from the engraving (crank pin 3x) with both reach margins >= 10px, bell-crank swing within 30 degrees of symmetric about the drawn pose and output rod within 12 degrees of its vertical guide line, by deterministic Nelder-Mead from stage 1. Not a claim of uniquely intended hidden geometry.',projectedCenters:{crankPin:projected.slice(0,2),input:projected.slice(2,4),pivot:projected.slice(4,6)},projectedMotion,fittedMotion:refined,rawLengthsPixels:lengths(origin),rawInnerReachMarginPixels:slack(origin),invalidSampleCount:invalid.length,totalSamples:4097,firstInvalidPhase:invalid[0],lastInvalidPhase:invalid.at(-1),fittedLengthsPixels:lengths(x),fittedInnerReachMarginPixels:slack(x),fittedOuterReachMarginPixels:refined.outer,minimumIntersectionHeightWorld:minHeight,iterations,adjustments:['crankPin','input','pivot'].map((name,i)=>({name,measured:origin.slice(i*2,i*2+2),fitted:x.slice(i*2,i*2+2),distancePixels:Math.hypot(x[i*2]-origin[i*2],x[i*2+1]-origin[i*2+1])})),fittedSource:fitted,sources:['scripts/fit-pinned-elbow-source.mjs','src/simulation/pinned-elbow-motion.js','public/engravings/mm_157.png'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync('src/simulation/pinned-elbow-fit.js',`// Reproduced by scripts/fit-pinned-elbow-source.mjs; see docs/movement-157.md.\nexport const pinnedElbowFittedSource=${JSON.stringify(fitted)};\n`);
fs.writeFileSync('docs/validation/157-source-fit.json',JSON.stringify(report,null,2)+'\n');console.log(report);
