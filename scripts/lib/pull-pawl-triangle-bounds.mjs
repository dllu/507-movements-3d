import * as THREE from 'three';
import {finitePolygon} from './pull-pawl-contact-study.mjs';

const cross=(a,b)=>a[0]*b[1]-a[1]*b[0],dot=(a,b)=>a[0]*b[0]+a[1]*b[1],
 sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],normal=(a,b)=>{const d=sub(b,a),L=Math.hypot(...d);return[d[1]/L,-d[0]/L];},
 rotate=(p,a)=>[p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a)];

export function triangulateContactPolygon(raw){
 const profile=finitePolygon(raw),points=profile.points,indices=THREE.ShapeUtils.triangulateShape(points.map(p=>new THREE.Vector2(...p)),[]),
  edges=new Map(),issues=[],triangles=[];
 let area=0,minimumArea=Infinity;
 for(const input of indices){
  const ids=[...input];if(cross(sub(points[ids[1]],points[ids[0]]),sub(points[ids[2]],points[ids[0]]))<0)[ids[1],ids[2]]=[ids[2],ids[1]];
  const p=ids.map(i=>points[i]),a=cross(sub(p[1],p[0]),sub(p[2],p[0]))/2;area+=a;minimumArea=Math.min(minimumArea,a);
  if(!(a>1e-16))issues.push({reason:'degenerate-triangle',ids,a});
  for(let j=0;j<3;j++){const u=ids[j],v=ids[(j+1)%3],key=Math.min(u,v)+':'+Math.max(u,v),r=edges.get(key)??{count:0,orientation:0};
   r.count++;r.orientation+=u<v?1:-1;edges.set(key,r);
  }
  triangles.push({ids,points:p,normals:p.map((v,i)=>normal(v,p[(i+1)%3])),min:[0,1].map(k=>Math.min(...p.map(v=>v[k]))),max:[0,1].map(k=>Math.max(...p.map(v=>v[k])))});
 }
 for(let i=0;i<points.length;i++){
  const j=(i+1)%points.length,key=Math.min(i,j)+':'+Math.max(i,j),r=edges.get(key);
  if(!r||r.count!==1||r.orientation!==(i<j?1:-1))issues.push({reason:'boundary-incidence',i,r});edges.delete(key);
 }
 for(const [key,r]of edges)if(r.count!==2||r.orientation!==0)issues.push({reason:'interior-incidence',key,r});
 const polygonArea=points.reduce((sum,p,i)=>sum+cross(p,points[(i+1)%points.length]),0)/2,areaError=Math.abs(area-polygonArea);
 if(areaError>1e-10)issues.push({reason:'area-error',area,polygonArea});
 if(issues.length)throw Error('Invalid contact triangulation '+JSON.stringify(issues));
 return{points,triangles,radii:points.map(p=>Math.hypot(...p)),validation:{vertices:points.length,triangles:triangles.length,area,polygonArea,areaError,minimumArea,issues}};
}

export function triangleTree(triangles){
 const build=items=>{
  const min=[Infinity,Infinity],max=[-Infinity,-Infinity];for(const t of items)for(let k=0;k<2;k++){min[k]=Math.min(min[k],t.min[k]);max[k]=Math.max(max[k],t.max[k]);}
  if(items.length<=8)return{min,max,items};const axis=max[0]-min[0]>max[1]-min[1]?0:1;
  items.sort((a,b)=>a.min[axis]+a.max[axis]-b.min[axis]-b.max[axis]);const middle=items.length>>1;
  return{min,max,left:build(items.slice(0,middle)),right:build(items.slice(middle))};
 },root=build([...triangles]),overlap=(a,b)=>a.min[0]<=b.max[0]&&a.max[0]>=b.min[0]&&a.min[1]<=b.max[1]&&a.max[1]>=b.min[1];
 return{query:(box,visit)=>{
  const walk=node=>{if(!overlap(box,node))return;if(node.items){for(const t of node.items)if(overlap(box,t))visit(t);}else{walk(node.left);walk(node.right);}};walk(root);
 }};
}

export function makePullPawlTriangleBounds(candidate,{tolerance=1e-6,roundoff=1e-12}={}){
 const u=candidate.root.userData,p=u.geometry,profiles=Object.fromEntries(['wheel','left','right'].map(key=>[key,triangulateContactPolygon(u.profiles[key])])),
  tree=triangleTree(profiles.wheel.triangles),stats={evaluations:0,trianglePairs:0,broadPhaseTriangles:0,axisChecks:0,minimumLowerBound:Infinity};
 const evaluate=row=>{
  stats.evaluations++;const [,q,theta,...angles]=row,points={};
  for(const [i,key]of ['left','right'].entries()){
   const A=rotate(p.A,-theta),B=rotate(p.arms[key],q-theta),c=Math.cos(angles[i]-theta),s=Math.sin(angles[i]-theta);
   points[key]=profiles[key].points.map(v=>[A[0]+B[0]+c*v[0]-s*v[1],A[1]+B[1]+s*v[0]+c*v[1]]);
  }
  return{row,points};
 };
 const check=(a,b)=>{
  const middle=evaluate(a.row.map((v,i)=>(v+b.row[i])/2)),dq=b.row[1]-a.row[1],dt=b.row[2]-a.row[2];
  let minimum=Infinity,witness=null;
  for(const [i,key]of ['left','right'].entries()){
   const da=b.row[i+3]-a.row[i+3],base=Math.hypot(...p.A)*dt*dt+Math.hypot(...p.arms[key])*(dq-dt)**2,
    error=profiles[key].radii.map(r=>(base+r*(da-dt)**2)/8+roundoff),angle=middle.row[i+3]-middle.row[2];
   for(const h of profiles[key].triangles){
    stats.broadPhaseTriangles++;
    const box={min:[0,1].map(k=>Math.min(...h.ids.map(j=>Math.min(a.points[key][j][k],b.points[key][j][k])-error[j]))),
     max:[0,1].map(k=>Math.max(...h.ids.map(j=>Math.max(a.points[key][j][k],b.points[key][j][k])+error[j])))},
     axes=h.normals.map(n=>rotate(n,angle));
    tree.query(box,w=>{
     stats.trianglePairs++;let best=-Infinity,midpointBest=-Infinity;
     for(const n of [...w.normals,...axes]){
      stats.axisChecks++;
      const wp=w.points.map(v=>dot(n,v)),wlow=Math.min(...wp),whigh=Math.max(...wp);
      let hlow=Infinity,hhigh=-Infinity,mlow=Infinity,mhigh=-Infinity;
      for(const j of h.ids){const x=dot(n,a.points[key][j]),y=dot(n,b.points[key][j]),m=dot(n,middle.points[key][j]);
       hlow=Math.min(hlow,x-error[j],y-error[j]);hhigh=Math.max(hhigh,x+error[j],y+error[j]);mlow=Math.min(mlow,m);mhigh=Math.max(mhigh,m);
      }
      const lower=Math.max(hlow-whigh,wlow-hhigh);best=Math.max(best,lower);midpointBest=Math.max(midpointBest,mlow-whigh,wlow-mhigh);
      if(lower>=-tolerance)break;
     }
     minimum=Math.min(minimum,best);
     if(best< -tolerance&&(!witness||best<witness.lower))witness={key,lower:best,midpointSeparation:midpointBest,wheelTriangle:w.ids,hookTriangle:h.ids};
    });
   }
  }
  if(!witness)stats.minimumLowerBound=Math.min(stats.minimumLowerBound,minimum);
  return{okay:!witness,middle,minimum,witness};
 };
 return{evaluate,check,profiles,stats};
}
