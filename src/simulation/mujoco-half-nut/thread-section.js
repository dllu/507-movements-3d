import * as THREE from 'three';
import {ConvexGeometry} from 'three/addons/geometries/ConvexGeometry.js';
import {threadAngles,threadStations} from '../mujoco-screw/thread-geometry.js';

const tau=2*Math.PI;
const mod=a=>{const r=((a%tau)+tau)%tau;return r<1e-12||tau-r<1e-12?0:r;};
const point=(r,a,z)=>[r*Math.cos(mod(a)),r*Math.sin(mod(a)),z].map(Math.fround);

// A relieved tip permits the half-nut to rock away without trapping its open
// edges between square screw flanks. Split at every clipping transition, then
// use the same convex sectors for the visible exterior and native contact.
export function halfThread(p,segments,side) {
 const positions=[],normals=[],cells=[],tipWidth=p.width-2*(p.tipRelief??0);
 const extra=[0,Math.PI,...threadAngles({...p,width:tipWidth},segments).slice(0,-1)];
 const angles=threadAngles(p,segments,extra),stations=threadStations(p,angles);
 const included=stations.slice(0,-1).map((a,i)=>side*Math.sin((a.angle+stations[i+1].angle)/2)>0);
 const section=angle=>{
  const center=p.phase+p.lead*angle;
  let ring=[[p.inner,center-tipWidth/2],[p.outer,center-p.width/2],[p.outer,center+p.width/2],[p.inner,center+tipWidth/2]];
  for(const [limit,sign]of [[p.low,1],[p.high,-1]]) {
   const next=[];
   for(let i=0;i<ring.length;i++) {
    const a=ring[i],b=ring[(i+1)%ring.length],insideA=sign*(a[1]-limit)>=-1e-12,insideB=sign*(b[1]-limit)>=-1e-12;
    if(insideA)next.push([a[0],Math.abs(a[1]-limit)<1e-12?limit:a[1]]);
    if(insideA!==insideB)next.push([a[0]+(b[0]-a[0])*(limit-a[1])/(b[1]-a[1]),limit]);
   }
   ring=next;
  }
  return ring.map(([r,z])=>point(r,angle,z));
 };
 for(let i=0;i+1<stations.length;i++) {
  if(!included[i])continue;
  const a=stations[i],b=stations[i+1];
  const vertices=[...new Map([...section(a.angle),...section(b.angle)].map(v=>[v.join(','),v])).values()];
  if(vertices.length<4)continue;
  const hull=new ConvexGeometry(vertices.map(v=>new THREE.Vector3(...v))),pos=hull.attributes.position,norm=hull.attributes.normal;
  for(let j=0;j<pos.count;j+=3) {
   const face=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(pos,j+k));
   const boundary=t=>face.every(v=>Math.abs(-Math.sin(mod(t))*v.x+Math.cos(mod(t))*v.y)<2e-8);
   if((included[i-1]&&boundary(a.angle))||(included[i+1]&&boundary(b.angle)))continue;
   for(let k=0;k<3;k++){positions.push(...face[k].toArray());normals.push(norm.getX(j+k),norm.getY(j+k),norm.getZ(j+k));}
  }
  hull.dispose();cells.push(vertices);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
 geometry.computeBoundingBox();geometry.computeBoundingSphere();return {geometry,cells,angles};
}
