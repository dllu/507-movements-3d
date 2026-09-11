import {finitePolygon,dot,cross,mul} from './pull-pawl-contact-study.mjs';
import {sub,rotate} from '../../src/simulation/finite-plate-geometry.js';

export function makeSpringRackContact(candidate){
 const u=candidate.root.userData,p=u.geometry,gear=finitePolygon(u.profiles.gear[0][0]),
  racks=u.profiles.rackTeeth.map(shape=>finitePolygon(shape[0][0]));
 const convex=polygon=>polygon.points.map((v,i)=>cross(sub(v,polygon.points[(i+polygon.points.length-1)%polygon.points.length]),
  sub(polygon.points[(i+1)%polygon.points.length],v))>=-1e-12),gearConvex=convex(gear),rackConvex=racks.map(convex);
 const face= (polygon,point)=>{
  const nearest=polygon.closest(point);
  // Exact face normals avoid normalizing the nearly zero gap after a solve.
  if(nearest.fraction>0&&nearest.fraction<1){nearest.normal=nearest.edge.normal;nearest.gap=dot(sub(point,nearest.edge.a),nearest.normal);}
  return nearest;
 };
 const pair=(q,y,padding=.003)=>{
  const theta=p.gearPhase+q,rows=[];let minimumGap=Infinity;
  const keep=(id,f,n,G,R,eligible)=>{
   minimumGap=Math.min(minimumGap,f.gap);if(!eligible||f.gap>padding)return;
   rows.push({id,gap:f.gap,normal:n,gearPoint:G,rackPoint:R,J:n[1],inputJ:-cross(G,n)});
  };
  const worldGear=gear.points.map(v=>rotate(v,theta));
  for(let k=0;k<racks.length;k++){
   const rack=racks[k],center=[rack.center[0],rack.center[1]+y];
   for(let i=0;i<rack.points.length;i++){
    const R=[rack.points[i][0],rack.points[i][1]+y],f=face(gear,rotate(R,-theta)),G=rotate(f.point,theta),n=rotate(f.normal,theta);
    keep('R'+k+'V'+i+'G'+f.index,f,n,G,R,rackConvex[k][i]);
   }
   for(let i=0;i<worldGear.length;i++){
    const G=worldGear[i],lower=Math.hypot(...sub(G,center))-rack.radius;if(lower>Math.max(padding,minimumGap))continue;
    const f=face(rack,[G[0],G[1]-y]),R=[f.point[0],f.point[1]+y],n=mul(f.normal,-1);
    keep('GV'+i+'R'+k+'E'+f.index,f,n,G,R,gearConvex[i]);
   }
  }
  return {rows,minimumGap};
 };
 // The radial gear outline is star shaped about its shaft. Its edge fans
 // partition the filled outline into convex triangles. The rack never
 // reaches the face recess, so the filled center adds no contact material.
 // For a triangle and a rack trapezoid, their vertical-translation obstacle
 // is one interval. Its endpoints occur at equal-x vertex/edge pairs.
 const forbiddenIntervals=q=>{
  const theta=p.gearPhase+q,world=gear.points.map(v=>rotate(v,theta)),intervals=[];
  for(let tooth=0;tooth<racks.length;tooth++){
   const rack=racks[tooth],rx0=Math.min(...rack.points.map(v=>v[0])),rx1=Math.max(...rack.points.map(v=>v[0]));
   for(let i=0;i<world.length;i++){
    const a=world[i],b=world[(i+1)%world.length];
    if(Math.min(0,a[0],b[0])>=rx1||Math.max(0,a[0],b[0])<=rx0)continue;
    const triangle=[[0,0],a,b];let low=Infinity,high=-Infinity;
    const consider=(v,e,f,sign)=>{
     const dx=f[0]-e[0];if(Math.abs(dx)<1e-15)return;
     const t=(v[0]-e[0])/dx;if(t<0||t>1)return;
     const value=sign*(v[1]-e[1]-t*(f[1]-e[1]));low=Math.min(low,value);high=Math.max(high,value);
    };
    for(const v of triangle)for(const e of rack.edges)consider(v,e.a,e.b,1);
    for(const v of rack.points)for(let j=0;j<3;j++)consider(v,triangle[j],triangle[(j+1)%3],-1);
    if(low<high)intervals.push({low,high,lowFeature:{tooth,fan:i},highFeature:{tooth,fan:i}});
   }
  }
  intervals.sort((a,b)=>a.low-b.low);const merged=[];
  for(const interval of intervals){const last=merged.at(-1);
   if(last&&interval.low<=last.high){if(interval.high>last.high){last.high=interval.high;last.highFeature=interval.highFeature;}}
   else merged.push({...interval});
  }
  return merged;
 };
 return {gear,racks,pair,forbiddenIntervals};
}
