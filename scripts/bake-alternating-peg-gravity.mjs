// Bakes movement 077's periodic playback from the planar rigid-body
// simulation in scripts/lib/alternating-peg-gravity-sim.mjs (p111): the lever
// rocks sinusoidally, both hook pawls fall freely under gravity onto the next
// peg and are then driven. The run starts from Brown's drawn pose, settles
// into its one-pitch limit cycle, and the last cycle is written as the loop.
// Each baked row is then checked against the rendered pawl outlines and the
// true peg circles; any residual (sub-micron) overlap is removed by turning
// that pawl minimally about its pivot.
//   node scripts/bake-alternating-peg-gravity.mjs [--check]
import fs from 'node:fs';
import crypto from 'node:crypto';
import {makeAlternatingPegPawlDrive} from '../src/simulation/alternating-peg-pawl.js';
import {simulateAlternatingPeg} from './lib/alternating-peg-gravity-sim.mjs';
import profile from '../src/data/alternating-peg-profile.js';

const check=process.argv.includes('--check');
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(new URL('../'+file,import.meta.url))).digest('hex');
const sources=['scripts/lib/alternating-peg-gravity-sim.mjs','scripts/bake-alternating-peg-gravity.mjs','src/simulation/alternating-peg-geometry.js','src/simulation/alternating-peg-pawl.js'];
const provenance=Object.fromEntries(sources.map(file=>[file,hash(file)]));
if(check){
 const stale=sources.filter(file=>profile.provenance?.[file]!==provenance[file]);
 if(stale.length){console.error('077 bake is stale for',stale.join(', '));process.exit(1);}
 console.log('077 bake provenance current');process.exit(0);
}

const model=makeAlternatingPegPawlDrive(),u=model.root.userData,G=u.geometry,motion=u.motion;
const options={period:4,amplitude:.245,qmid:.11,g:9.81,density:1000,wheelCoulomb:200,wheelViscous:4,pivotDamping:.004,
 friction:.2,lubrication:3000,baumgarte:.2,margin:.02,skin:1e-5,dt:1e-4,cycles:8,recordEvery:10,iterations:60};
const sim=simulateAlternatingPeg({...options,masses:u.masses,seatPhase:profile.geometry.seatPhase});
const perCycle=Math.round(options.period/(options.dt*options.recordEvery));
const start=sim.rows.length-1-perCycle,cycle=sim.rows.slice(start);
if(cycle.length!==perCycle+1)throw Error('bad cycle length');
const pitch=G.pitch,advance=(cycle.at(-1)[2]-cycle[0][2])/pitch;
const seam=[Math.abs(advance-1),Math.abs(cycle.at(-1)[3]-cycle[0][3]),Math.abs(cycle.at(-1)[4]-cycle[0][4]),Math.abs(cycle.at(-1)[1]-cycle[0][1])];
if(seam.some(v=>v>1e-7))throw Error('Not periodic: '+seam);
// Wheel offset: whole pitches removed so the pegs sit near Brown's phase at t=0.
const theta0=cycle[0][2],offset=theta0-Math.round(theta0/pitch)*pitch;
const t0=cycle[0][0];
let rows=cycle.map(([t,q,theta,a,b])=>[t-t0,q,theta-theta0+offset,a,b]);
// Close the seam exactly.
rows[rows.length-1]=[options.period,rows[0][1],rows[0][2]+pitch,rows[0][3],rows[0][4]];

// Exact clearance of the rendered pawl outline against the true peg circles.
const rot=(p,a)=>[p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a)];
const outlines=Object.fromEntries(['upper','lower'].map(k=>[k,u.profiles[k]]));
const inside=(poly,p)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;};
const segDistance=(poly,p)=>{let best=Infinity;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],dx=b[0]-a[0],dy=b[1]-a[1],
 t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));best=Math.min(best,Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy));}return best;};
const clearance=(key,q,theta,angle)=>{
 const P=motion.anchorAt(key,q);let best=Infinity;
 for(let i=0;i<24;i++){const c=motion.pinAt(i,theta),dx=c[0]-P[0],dy=c[1]-P[1];if(dx*dx+dy*dy>1.7)continue;
  const local=rot([dx,dy],-angle),L=G.lengths[key];if(Math.hypot(local[0]+L,local[1])>.25&&Math.abs(local[1])>.12)continue;
  const poly=outlines[key],d=(inside(poly,local)?-1:1)*segDistance(poly,local)-G.pinRadius;if(d<best)best=d;}
 return best;
};
const eps=0;let corrected=0,largest=0;
for(const row of rows){
 for(const [key,index]of [['upper',3],['lower',4]]){
  const c=clearance(key,row[1],row[2],row[index]);if(c>=eps)continue;
  let direction=0;for(const s of [1,-1])if(clearance(key,row[1],row[2],row[index]+s*1e-4)>c){direction=s;break;}
  if(!direction)throw Error('No escape direction at '+row[0]);
  let lo=0,hi=1e-4;while(clearance(key,row[1],row[2],row[index]+direction*hi)<eps)hi*=2;
  for(let i=0;i<50;i++){const mid=(lo+hi)/2;if(clearance(key,row[1],row[2],row[index]+direction*mid)>=eps)hi=mid;else lo=mid;}
  if(hi>1e-3)throw Error('Projection too large at '+row[0]+': '+hi);
  row[index]+=direction*hi;corrected++;largest=Math.max(largest,hi);
 }
}
let worst=Infinity;for(const row of rows)for(const [key,index]of [['upper',3],['lower',4]])worst=Math.min(worst,clearance(key,row[1],row[2],row[index]));
if(worst<0)throw Error('Residual overlap '+worst);
const round=v=>Math.round(v*1e12)/1e12;
const physics={...options,simulatorMaxPenetration:sim.maxPen,projectedRows:corrected,largestProjection:largest,minimumClearance:worst,psi:sim.psi,
 lever:'q(t)=qmid+amplitude*sin(2*pi*t/period+psi), q(0)=0 rising',units:'engraving wheel radius = 1 m; SI otherwise'};
const text='// Movement 077 playback baked by scripts/bake-alternating-peg-gravity.mjs (p111).\n'+
 '// Planar rigid-body simulation: sinusoidal lever, gravity-falling hook pawls,\n'+
 '// inelastic lubricated peg contact, dry-friction wheel load. One steady cycle.\n'+
 '// Rows: physical time, lever, wheel, upper pawl, lower pawl angles.\nexport default {\n'+
 '  geometry: '+JSON.stringify(profile.geometry)+',\n'+
 '  pitch: '+JSON.stringify(pitch)+',\n'+
 '  physics: '+JSON.stringify(physics)+',\n'+
 '  physicsPeriod: '+options.period+',\n  playbackPeriod: '+options.period+',\n'+
 '  provenance: '+JSON.stringify(provenance)+',\n'+
 '  steady: [\n'+rows.map(r=>'    '+JSON.stringify(r.map(round))).join(',\n')+'\n  ],\n};\n';
fs.writeFileSync(new URL('../src/data/alternating-peg-profile.js',import.meta.url),text);
console.log({rows:rows.length,advance,seam,corrected,largest,worst,maxPen:sim.maxPen,offset});
