import {renderedPrism} from './crossed-rack-mesh-prisms.mjs';
import {triangleTree} from './pull-pawl-triangle-bounds.mjs';
import {rotate} from '../../src/simulation/finite-plate-geometry.js';
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];

export function makeCrossedRackTriangleBounds(candidate,physics,{tolerance=1e-6,roundoff=1e-12}={}){
 const u=candidate.root.userData,p=physics.parameters,
  profiles=Object.fromEntries(['rack','left','right'].map(key=>[key,renderedPrism(u.parts[key==='rack'?'slottedRack':key+'HookWeb'].geometry)])),
  tree=triangleTree(profiles.rack.triangles),stats={evaluations:0,trianglePairs:0,broadPhaseTriangles:0,axisChecks:0,minimumLowerBound:Infinity};
 const evaluate=row=>{
  stats.evaluations++;const k=physics.input(row.time),points={};
  for(const [i,key]of ['left','right'].entries()){
   const P=k.pawls[key].pivot;
   points[key]=profiles[key].points.map(v=>{const r=rotate(v,row.x[i+1]);return[P[0]+r[0],P[1]+r[1]-row.x[0]];});
  }
  return{row,points};
 };
 const check=(a,b)=>{
  const middle=evaluate({time:(a.row.time+b.row.time)/2,x:a.row.x.map((v,i)=>(v+b.row.x[i])/2)}),h=b.row.time-a.row.time;
  let minimum=Infinity,witness=null;
  for(const [i,key]of ['left','right'].entries()){
   const da=b.row.x[i+1]-a.row.x[i+1],rp=Math.hypot(...u.geometry.anchors[key]),
    pivotBound=p.stopAt!==null&&a.row.time>=p.stopAt?0:rp*(p.amplitude*p.omega*p.omega+(p.amplitude*p.omega)**2)*h*h,
    error=profiles[key].radii.map(r=>(pivotBound+r*da*da)/8+roundoff),angle=middle.row.x[i+1];
   for(const hook of profiles[key].triangles){
    stats.broadPhaseTriangles++;
    const box={min:[0,1].map(k=>Math.min(...hook.ids.map(j=>Math.min(a.points[key][j][k],b.points[key][j][k])-error[j]))),
     max:[0,1].map(k=>Math.max(...hook.ids.map(j=>Math.max(a.points[key][j][k],b.points[key][j][k])+error[j])))},
     axes=hook.normals.map(n=>rotate(n,angle));
    tree.query(box,rack=>{
     stats.trianglePairs++;let best=-Infinity,midpointBest=-Infinity;
     for(const n of [...rack.normals,...axes]){
      stats.axisChecks++;const projections=rack.points.map(v=>dot(n,v)),rlow=Math.min(...projections),rhigh=Math.max(...projections);
      let low=Infinity,high=-Infinity,mlow=Infinity,mhigh=-Infinity;
      for(const j of hook.ids){const x=dot(n,a.points[key][j]),y=dot(n,b.points[key][j]),m=dot(n,middle.points[key][j]);
       low=Math.min(low,x-error[j],y-error[j]);high=Math.max(high,x+error[j],y+error[j]);mlow=Math.min(mlow,m);mhigh=Math.max(mhigh,m);
      }
      const lower=Math.max(low-rhigh,rlow-high);best=Math.max(best,lower);midpointBest=Math.max(midpointBest,mlow-rhigh,rlow-mhigh);
      if(lower>=-tolerance)break;
     }
     minimum=Math.min(minimum,best);
     if(best< -tolerance&&(!witness||best<witness.lower))witness={key,lower:best,midpointSeparation:midpointBest,rackTriangle:rack.ids,hookTriangle:hook.ids};
    });
   }
  }
  if(!witness)stats.minimumLowerBound=Math.min(stats.minimumLowerBound,minimum);
  return{okay:!witness,middle,minimum,witness};
 };
 return{evaluate,check,profiles,stats};
}
