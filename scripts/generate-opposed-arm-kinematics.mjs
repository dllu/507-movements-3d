// Generates movement 079's playback (src/data/opposed-arm-profile.js) from a
// kinematic face-ratchet model of the identical pawls in opposed-arm-geometry.js.
//
// The slider is prescribed. Each pawl hangs on its radial hinge and rests on
// the crown teeth: its tilt is the deepest one at which no point of its
// rendered outline enters a tooth, reached by a gravity-like fall after it
// drops off a crest. A pawl moving clockwise slides down the ramp into the
// root and then pushes the vertical face; the wheel turns only as far as the
// pushing pawl requires and otherwise stands (its friction holds it). The run
// continues until the cycle repeats, then the first and repeating cycles are
// written, compressed to 1e-6 rad under linear interpolation.
//   node scripts/generate-opposed-arm-kinematics.mjs [--dry-run]
import fs from 'node:fs';
import {makeOpposedArmGeometry} from '../src/simulation/opposed-arm-geometry.js';

const dryRun=process.argv.includes('--dry-run');
const period=8,playbackPeriod=4,stroke=.24,dt=period/16000,fall=150,cycles=4,friction=+(process.env.FRICTION??.035),tolerance=1e-6;
const model=makeOpposedArmGeometry(process.env.PAWL_LENGTH?{pawlLength:+process.env.PAWL_LENGTH}:{}),u=model.root.userData,p=u.geometry,{phase,pitch,crest,valley,innerRadius,outerRadius,pivotZ}=p;
const sliderAt=t=>p.sourceSlider[0]+stroke*Math.sin(2*Math.PI*t/period);
// Outline points of the blade on both faces, in the pawl's local frame.
const points=Object.fromEntries(['upper','lower'].map(key=>{
 const ring=p.arms[key].pawlContour[0][0].slice(0,-1);return[key,[-p.pawl.halfThickness,p.pawl.halfThickness].flatMap(z=>ring.map(([x,y])=>[x,y,z]))];
}));
const surface=alpha=>{const f=(alpha-phase)/pitch;return valley+(crest-valley)*(f-Math.floor(f));};
const face=k=>phase+k*pitch;
// Rendered ramps and faces are faceted; keep the pawl this far clear of them.
// World-to-wheel-frame polar coordinates of every blade point.
const pose=(key,arm,beta,theta)=>{
 const c=Math.cos(beta),s=Math.sin(beta),cp=Math.cos(arm.psi),sp=Math.sin(arm.psi);
 return points[key].map(([x,y,z])=>{
  const Y=y*c-z*s,Z=y*s+z*c,X=x*cp-Y*sp+arm.pivot[0],W=x*sp+Y*cp+arm.pivot[1];
  return{r:Math.hypot(X,W),alpha:Math.atan2(W,X)-theta,z:Z+pivotZ};
 });
};
const unwrap=(alpha,reference)=>alpha+2*Math.PI*Math.round((reference-alpha)/(2*Math.PI));
// Penetration of the ramps at and beyond the engaged face k (points short of
// it are pushed by the wheel instead).
const clearance=2e-5,band=v=>v.r<innerRadius-1e-4||v.r>outerRadius+1e-4;
// Along each outline edge the lowest point short of a face is where the edge
// crosses it (the ramp is highest there), so those crossings are checked too.
const rampDepth=(q,k)=>{let depth=-Infinity;const a=face(k),n=q.length/2;
 for(let i=0;i<q.length;i++){const v=q[i];if(band(v))continue;const alpha=unwrap(v.alpha,a+pitch);
  depth=Math.max(depth,(alpha>=a?surface(alpha):valley)+clearance-v.z);
  const w=q[i%n===n-1?i-n+1:i+1];if(band(w))continue;const beta=unwrap(w.alpha,alpha);
  const lo=Math.min(alpha,beta),hi=Math.max(alpha,beta);
  for(let j=Math.max(k+1,Math.ceil((lo-phase)/pitch));face(j)<=hi;j++){
   const f=(face(j)-alpha)/(beta-alpha);depth=Math.max(depth,crest+clearance-(v.z+f*(w.z-v.z)));
  }
 }
 return depth;};
const faceShortfall=(q,k)=>{let d=0;const a=face(k);
 for(const v of q){if(band(v)||v.z>=crest+clearance)continue;const alpha=unwrap(v.alpha,a+pitch),need=a+clearance/v.r;if(alpha<need)d=Math.max(d,need-alpha);}return d;};
const seat=(key,arm,theta,k)=>{
 let low=0,high=1.2;if(rampDepth(pose(key,arm,low,theta),k)>0)throw Error('Pawl cannot clear the teeth');
 for(let i=0;i<34;i++){const m=(low+high)/2;if(rampDepth(pose(key,arm,m,theta),k)>0)high=m;else low=m;}
 return low;
};
const tipAlpha=(key,arm,beta,theta)=>{const q=pose(key,arm,beta,theta);return q.reduce((m,v)=>v.z<m.z?v:m).alpha;};

let theta=0,omega=0,time=0;const state={};
{const arms=model.root.userData.input(sliderAt(0)).arms;
 // The drawn pose starts each pawl seated on the ramp beneath its tip.
 for(const key of ['upper','lower']){let k=Math.floor((tipAlpha(key,arms[key],.3,0)-phase)/pitch),beta=0;
  for(let i=0;i<8;i++){beta=seat(key,arms[key],0,k);const next=Math.floor((tipAlpha(key,arms[key],beta,0)-phase)/pitch);if(next===k)break;k=next;}
  state[key]={k,beta,omega:0};}}
const rows=[];
const record=()=>rows.push([+time.toFixed(10),theta,state.upper.beta,state.lower.beta]);
record();
for(let step=1;step<=cycles*period/dt;step++){
 time=step*dt;const arms=u.input(sliderAt(time)).arms,previous=u.input(sliderAt(time-dt)).arms,pushers=new Set();
 // The wheel coasts on, slowing under its bearing and output friction.
 omega=Math.min(0,omega+friction*dt);theta+=omega*dt;
 for(let pass=0;pass<4;pass++){
  for(const key of ['upper','lower']){
   const s=state[key],arm=arms[key];
   // Advance the engaged face once the tip has passed over the next crest.
   for(;;){const a=unwrap(tipAlpha(key,arm,s.beta,theta),face(s.k)+pitch);if(a>=face(s.k+1))s.k++;else break;}
   const push=faceShortfall(pose(key,arm,s.beta,theta),s.k);if(push>0){theta-=push;pushers.add(key);}
  }
 }
 for(const key of ['upper','lower']){
  const s=state[key],arm=arms[key],target=seat(key,arm,theta,s.k);
  if(target<=s.beta){s.beta=target;s.omega=0;}
  else{s.omega+=fall*dt;s.beta=Math.min(target,s.beta+s.omega*dt);if(s.beta===target)s.omega=0;}
  const push=faceShortfall(pose(key,arm,s.beta,theta),s.k);if(push>0){theta-=push;pushers.add(key);}
 }
 // A push carries the wheel on at the pushing arm's speed (inelastic contact).
 for(const key of pushers)omega=Math.min(omega,(arms[key].q-previous[key].q)/dt);
 record();
}
const per=Math.round(period/dt),at=t=>rows[Math.round(t/dt)];
const advance=[];for(let c=1;c<cycles;c++)advance.push((at(c*period)[1]-at((c-1)*period)[1])/pitch);
const teethPerCycle=-Math.round(advance.at(-1));
let repeatError=0;for(let i=0;i<=per;i++){const a=rows[per+i],b=rows[2*per+i];
 repeatError=Math.max(repeatError,Math.abs(b[1]-a[1]+teethPerCycle*pitch),Math.abs(b[2]-a[2]),Math.abs(b[3]-a[3]));}
const compress=table=>{
 const out=[table[0]];let start=0;
 for(let i=2;i<table.length;i++){
  const a=table[start],b=table[i];let ok=true;
  for(let j=start+1;j<i&&ok;j++){const f=(table[j][0]-a[0])/(b[0]-a[0]);for(let k=1;k<4;k++)if(Math.abs(a[k]+f*(b[k]-a[k])-table[j][k])>tolerance){ok=false;break;}}
  if(!ok){start=i-1;out.push(table[start]);}
 }
 out.push(table.at(-1));return out;
};
const first=compress(rows.slice(0,per+1)),steady=compress(rows.slice(per,2*per+1).map(r=>[+(r[0]-period).toFixed(10),...r.slice(1)]));
// The first cycle hands over to the repeat exactly.
let paused=0;for(let i=per+1;i<=2*per;i++)if(rows[i][1]>=rows[i-1][1])paused++;
const report={advance,teethPerCycle,repeatError,paused:paused/per,first:first.length,steady:steady.length};
console.log(JSON.stringify(report));
if(repeatError>1e-6)throw Error('Cycle did not settle by the second cycle');
if(!dryRun){
 const old=(await import('../src/data/opposed-arm-profile.js')).default;
 const round=r=>r.map((v,i)=>i===0?+v.toFixed(8):+v.toFixed(12));
 fs.writeFileSync(new URL('../src/data/opposed-arm-profile.js',import.meta.url),
  '// Generated by scripts/generate-opposed-arm-kinematics.mjs: kinematic face-ratchet playback of\n'+
  '// movement 079 with identical pawls. Rows: physical time, wheel angle, upper pawl tilt, lower pawl tilt.\n'+
  `// Cycle repeat error ${repeatError.toExponential(2)} rad; ${teethPerCycle} teeth per cycle.\nexport default {\n`+
  Object.entries({geometry:{},physics:{period,stroke,fall,friction,dt},physicsPeriod:period,playbackPeriod,pitch,teethPerCycle,
   sourceSlider:p.sourceSlider,motionBounds:old.motionBounds,compressionTolerance:tolerance})
   .map(([k,v])=>'  '+k+': '+JSON.stringify(v)+',').join('\n')+
  '\n  first: [\n'+first.map(r=>'    '+JSON.stringify(round(r))).join(',\n')+'\n  ],\n  steady: [\n'+
  steady.map(r=>'    '+JSON.stringify(round(r))).join(',\n')+'\n  ],\n};\n');
}
