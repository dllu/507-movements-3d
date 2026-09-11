import fs from 'node:fs';
import profile from '../src/data/reciprocating-pawl-profile.js';
const p=profile.parameters,rotate=(p,a)=>[p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a)],
 add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a[0]*b[0]+a[1]*b[1],cross=(a,b)=>a[0]*b[1]-a[1]*b[0],
 B=rotate(p.VB,p.sourceBarAngle),H=rotate(p.VH,p.sourceHAngle),
 edges=profile.points.map((a,i,pts)=>[a,pts[(i+1)%pts.length]]);
function inside(point){let result=false;for(const [a,b] of edges)if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])result=!result;return result;}
function pointSegment(q,a,b){const d=sub(b,a),square=dot(d,d),t=square?Math.max(0,Math.min(1,dot(sub(q,a),d)/square)):0;return Math.hypot(q[0]-a[0]-t*d[0],q[1]-a[1]-t*d[1]);}
function segmentDistance(a,b,c,d){
 const ab=sub(b,a),cd=sub(d,c),ac=sub(c,a),den=cross(ab,cd);
 if(Math.abs(den)>1e-20){const t=cross(ac,cd)/den,u=cross(ac,ab)/den;if(t>=0&&t<=1&&u>=0&&u<=1)return 0;}
 return Math.min(pointSegment(a,c,d),pointSegment(b,c,d),pointSegment(c,a,b),pointSegment(d,a,b));
}
const center=(s,key)=>key==='B'?add(rotate([-p.barRadius,0],p.sourceBarAngle+s[1]-s[2]),rotate(B,s[3]-s[2])):
 add(rotate(p.PH,-s[2]),rotate(H,s[4]-s[2]));
let minimum=Infinity,intervals=0,subdivisions=0,witness,failures=[];
const certify=(a,b,key,depth=0)=>{
 const c=center(a,key),d=center(b,key),delta=b.map((v,i)=>v-a[i]),
  // Angular coordinates are affine here. Bound the departure from the
  // center's chord using its exact upper bound on the second derivative.
  error=(key==='B'?p.barRadius*(delta[1]-delta[2])**2+Math.hypot(...B)*(delta[3]-delta[2])**2:
    Math.hypot(...p.PH)*delta[2]**2+Math.hypot(...H)*(delta[4]-delta[2])**2)/8;
 if(inside(c)||inside(d))throw Error('A recorded nose center is inside the wheel');
 let distance=Infinity;
 for(const [e,f] of edges)distance=Math.min(distance,segmentDistance(c,d,e,f));
 const bound=distance-p.noseRadius-error;
 if(bound< -1e-6&&depth<12){const m=a.map((v,i)=>(v+b[i])/2);subdivisions++;certify(a,m,key,depth+1);certify(m,b,key,depth+1);return;}
 intervals++;if(bound<minimum){minimum=bound;witness={key,time:a[0],end:b[0],bound};}
 if(bound< -1e-6)failures.push(witness);
};
for(const name of ['first','steady']){const table=profile.playback[name];for(let i=1;i<table.length;i++)for(const key of ['B','H'])certify(table[i-1],table[i],key);}
const report={movement:75,passed:failures.length===0,intervals,subdivisions,minimum,witness,failures,
 method:'Minimum distance from the swept nose-center chord to every wheel edge, minus the nose radius and an analytic second-derivative chord-deviation bound. Adaptive subdivision evaluates the actual affine playback path.',tolerance:1e-6};
fs.writeFileSync(process.env.PROBE_OUTPUT||'artifacts/review/075-continuous-sweep.json',JSON.stringify(report,null,2)+'\n');console.log(report);if(failures.length)process.exitCode=1;
