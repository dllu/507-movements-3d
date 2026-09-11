import fs from 'node:fs';
import {makeSpringRackCandidate} from './lib/spring-rack-candidate.mjs';
import {makeSpringRackPlayback} from './lib/spring-rack-playback-study.mjs';
const data=JSON.parse(fs.readFileSync('artifacts/review/081-seamed-playback-data.json')),
 model=makeSpringRackCandidate(data.geometry),p=model.root.userData.geometry,motion=makeSpringRackPlayback(model,data),contact=motion.contact,
 scale=p.source.scale,limit=.002/scale,guard=2e-7,omega=-data.parameters.omega,
 rotate=(v,a)=>[v[0]*Math.cos(a)-v[1]*Math.sin(a),v[0]*Math.sin(a)+v[1]*Math.cos(a)],dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
// Exact extrema of A cos(theta) + B sin(theta) - ny*(y0+speed*t).
// Each fixed separating axis therefore keeps gear/rack motion correlated.
function projection(v,n,start,end,y0,speed){
 const A=dot(v,n),B=v[0]*n[1]-v[1]*n[0],a=p.gearPhase+omega*start,b=p.gearPhase+omega*end,
  evaluate=t=>A*Math.cos(p.gearPhase+omega*t)+B*Math.sin(p.gearPhase+omega*t)-n[1]*(y0+speed*(t-start)),
  values=[evaluate(start),evaluate(end)],R=Math.hypot(A,B),target=n[1]*speed/(omega*R);
 if(R&&Math.abs(target)<=1){
  const phi=Math.atan2(A,B),offset=Math.acos(target),lo=Math.min(a,b),hi=Math.max(a,b);
  for(const base of [offset-phi,-offset-phi])for(let k=Math.ceil((lo-base)/(2*Math.PI));k<=Math.floor((hi-base)/(2*Math.PI));k++){
   const t=(base+k*2*Math.PI-p.gearPhase)/omega;values.push(evaluate(t));
  }
 }
 return[Math.min(...values),Math.max(...values)];
}
let pairs=0,leaves=0,subdivisions=0,maxDepth=0,minimumMargin=Infinity;const failures=[],maxProjection=[];
function clearPath(start,end,y0,y1,offset){
 const low=Math.min(y0,y1)+offset,high=Math.max(y0,y1)+offset;
 if(low<data.range[0]-1e-13||high>data.range[1]+1e-13)return false;
 const mid=(start+end)/2,theta=p.gearPhase+omega*mid,speed=(y1-y0)/(end-start),
  work=contact.gear.points.map(v=>({v,at:rotate(v,theta),x:projection(v,[1,0],start,end,0,0),y:projection(v,[0,1],start,end,y0,speed)})),
  origin={v:[0,0],at:[0,0],x:[0,0],y:[-Math.max(y0,y1),-Math.min(y0,y1)]};
 for(let i=0;i<work.length;i++){
  const triangle=[origin,work[i],work[(i+1)%work.length]],xs=triangle.flatMap(v=>v.x),ys=triangle.flatMap(v=>v.y),
   xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);
  for(const rack of contact.racks){
   const rx= rack.points.map(v=>v[0]),ry=rack.points.map(v=>v[1]+offset);
   if(xmax<Math.min(...rx)||xmin>Math.max(...rx)||ymax<Math.min(...ry)-guard||ymin>Math.max(...ry)+guard)continue;
   pairs++;let separated=false;
   const normals=[...rack.edges.map(e=>e.normal),...triangle.map((v,j)=>{
    const next=triangle[(j+1)%3].at,dx=next[0]-v.at[0],dy=next[1]-v.at[1],L=Math.hypot(dx,dy);return L?[dy/L,-dx/L]:[1,0];
   })];
   for(const n of normals){
    const base=rack.points.map(v=>dot(v,n)+n[1]*offset),rmin=Math.min(...base),rmax=Math.max(...base),
     nominal=triangle.map(v=>dot(v.at,n)-n[1]*(y0+y1)/2);
    if(Math.min(...nominal)<=rmax&&Math.max(...nominal)>=rmin)continue;
    const intervals=triangle.map(v=>projection(v.v,n,start,end,y0,speed)),
     margin=Math.max(Math.min(...intervals.map(v=>v[0]))-rmax,rmin-Math.max(...intervals.map(v=>v[1])));
    if(margin>guard*Math.abs(n[1])+1e-12){minimumMargin=Math.min(minimumMargin,margin);separated=true;break;}
   }
   if(!separated)return false;
  }
 }
 return true;
}
function bound(a,b,depth=0){
 const start=a[0],end=b[0],middle=(start+end)/2,raw=(a[1]+b[1])/2,sample=motion.sample(2*middle),
  sign=sample.rackY>=raw?1:-1;
 if(clearPath(start,end,a[1],b[1],sign*limit)||clearPath(start,end,a[1],b[1],-sign*limit)){
  leaves++;maxDepth=Math.max(maxDepth,depth);return;
 }
 if(depth===16){failures.push({start,end,raw,sample});return;}
 subdivisions++;const m=[middle,raw];bound(a,m,depth+1);bound(m,b,depth+1);
}
for(let i=1;i<data.knots.length;i++){
 bound(data.knots[i-1],data.knots[i]);
 if(i%200===0)console.log({knot:i,leaves,subdivisions,failures:failures.length});
}
const report={movement:81,passed:failures.length===0,projectionBound:limit,projectionPixels:limit*scale,
 knots:data.knots.length,leaves,subdivisions,maxDepth,testedConvexPairs:pairs,minimumSeparation:minimumMargin,failures,
 method:'For every complete knot interval, an affine path within +/- the correction limit is proved feasible by fixed-axis separation of each gear fan and rack tooth. Trigonometric extrema retain correlated gear/rack motion. Adaptive time subdivision resolves changing separating axes. The nearest-feasible projection cannot move farther than this feasible witness.',
 qualification:'The bound covers projection of the compressed path, including its clearance guard and allowed travel range. Time-step agreement remains a measured convergence result, not a continuum guarantee.'};
fs.writeFileSync('artifacts/review/081-continuous-playback-bound.json',JSON.stringify(report,null,2)+'\n');console.log({...report,failures:failures.slice(0,3)});if(!report.passed)process.exitCode=1;
