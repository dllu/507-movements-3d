import * as THREE from 'three';import clipping from'polygon-clipping';
import{toothChart}from'./mutilated-bevel-tooth-relief.mjs';
const area=ring=>Math.abs(ring.reduce((sum,p,i)=>{const q=ring[(i+1)%ring.length];return sum+p[0]*q[1]-p[1]*q[0];},0))/2;
const bounds=ring=>[Math.min(...ring.map(p=>p[0])),Math.min(...ring.map(p=>p[1])),Math.max(...ring.map(p=>p[0])),Math.max(...ring.map(p=>p[1]))];
function project(points){
  const result=[],level=1e-5;
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length],first=a.z>=level,last=b.z>=level;
    if(first)result.push(a);if(first!==last)result.push(a.clone().lerp(b,(level-a.z)/(b.z-a.z)));
  }
  return result.map(p=>[p.x/p.z,p.y/p.z]);
}
export function prepareBevelAngularOverlap(output,driver){
  const sources=output.userData.toothMeshes.map(mesh=>{
    const p=mesh.geometry.attributes.position,n=p.count/6;
    if(!Number.isInteger(n))throw new Error('Output must use original ruled tooth geometry');
    return{mesh,points:Array.from({length:n},(_,i)=>new THREE.Vector3().fromBufferAttribute(p,n+i))};
  });
  const targets=driver.userData.toothMeshes.map(mesh=>{
    const c=Math.cos(mesh.rotation.z),s=Math.sin(mesh.rotation.z),polys=mesh.geometry.userData.polygons??[[toothChart(mesh.geometry)]];
    const polygons=polys.map(rings=>rings.map(ring=>ring.map(([x,y])=>[c*x-s*y,s*x+c*y])));
    return{index:mesh.userData.index,polygons,bounds:bounds(polygons.flat(2))};
  });
  return()=>{
    const inverse=driver.userData.rotor.matrixWorld.clone().invert();let maximumArea=0,totalArea=0,witness=null;
    for(const source of sources){
      const transform=inverse.clone().multiply(source.mesh.matrixWorld),poly=project(source.points.map(p=>p.clone().applyMatrix4(transform)));
      if(poly.length<3)continue;const box=bounds(poly);
      for(const target of targets){
        const b=target.bounds;if(box[2]<b[0]||box[0]>b[2]||box[3]<b[1]||box[1]>b[3])continue;
        const overlap=clipping.intersection([poly],target.polygons),value=overlap.reduce((sum,rings)=>sum+area(rings[0])-rings.slice(1).reduce((s,r)=>s+area(r),0),0);
        totalArea+=value;if(value>maximumArea){maximumArea=value;witness={outputTooth:source.mesh.userData.index,driverTooth:target.index,area:value};}
      }
    }
    return{maximumArea,totalArea,witness};
  };
}
