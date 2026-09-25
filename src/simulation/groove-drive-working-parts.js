import * as THREE from 'three';
import {circle,poly,plate,polygonClipping as clip} from './finite-plate-geometry.js';
import {boredCylinderGeometry} from './piston-guide-parts.js';
import {creaseIndexedNormals} from './crease-normals.js';
const TAU=2*Math.PI;
export function finishGrooveDrive(root,period){root.userData.hideGround=true;root.userData.minimumDisplayCycleSeconds=period;root.traverse(o=>{for(const m of [].concat(o.material??[]))m.fog=false;});}
export function cam398Outline(arcs,scale,offset){
  const points=[];
  for(const[index,direction]of[[0,1],[4,-1],[1,1],[3,-1],[2,1],[5,-1]]){
    const[,x,y,r,start,end]=arcs[index],sweep=((end-start)%TAU+TAU)%TAU;
    const radius=r+(r>2?-offset:offset),steps=Math.ceil(sweep*96);
    for(let i=0;i<steps;i++){const u=direction>0?i/steps:1-i/steps,a=start+sweep*u;points.push([(x+radius*Math.cos(a))*scale,(y+radius*Math.sin(a))*scale]);}
  }
  return points;
}
export function recess398Cam(cam,arcs,scale){
  const d=cam.userData,inner=poly(cam398Outline(arcs,scale,-.0015)),outer=poly(cam398Outline(arcs,scale,.5015));
  const bore=poly(circle([0,0],.323,96)),disk=poly(circle([0,0],5*scale,256));
  for(const edge of [...d.contactEdges,...d.offsetEdges]){cam.remove(edge);edge.geometry.dispose();}
  d.disk.geometry.dispose();d.disk.geometry=plate(clip.difference(disk,bore),-.21,.03);d.disk.rotation.set(0,0,0);
  const innerLand=new THREE.Mesh(plate(clip.difference(inner,bore),.03,.30),d.disk.material);
  const outerLand=new THREE.Mesh(plate(clip.difference(disk,outer),.03,.30),d.disk.material);
  innerLand.userData.role='source-arc-inner-working-cam-land';outerLand.userData.role='source-arc-outer-working-groove-wall';cam.add(innerLand,outerLand);
  d.contactEdges=[innerLand];d.offsetEdges=[outerLand];d.innerLand=innerLand;d.outerLand=outerLand;
  d.recess={floorZ:.03,frontZ:.30,innerClearance:.0006,outerClearance:.0006};
}
export function boreCylinder(mesh,radius,bore,length){mesh.geometry.dispose();mesh.geometry=boredCylinderGeometry(radius,bore,length);}

export function radialGroovedWheelGeometry(data,bore=.108){
  const {angular,vertical,height,values}=data,N=angular*8,positions=[],indices=[];
  for(let j=0;j<=vertical;j++)for(let i=0;i<N;i++){
    const local=i%angular,copy=Math.floor(i/angular),a=Math.PI-data.angles[j*angular+local]-copy*data.pitch,r=values[j*angular+local];positions.push(r*Math.cos(a),-height/2+height*j/vertical,r*Math.sin(a));
  }
  for(let j=0;j<vertical;j++)for(let i=0;i<N;i++){const k=(i+1)%N,a=j*N+i,b=j*N+k,c=(j+1)*N+i,d=(j+1)*N+k;indices.push(a,b,c,b,d,c);}
  const base=positions.length/3;
  for(const [j,y]of [[0,-height/2],[vertical,height/2]])for(let i=0;i<N;i++){const a=Math.PI-data.angles[j*angular+i%angular]-Math.floor(i/angular)*data.pitch;positions.push(bore*Math.cos(a),y,bore*Math.sin(a));}
  for(let i=0;i<N;i++){
    const k=(i+1)%N,lo=i,lk=k,hi=vertical*N+i,hk=vertical*N+k,bi=base+i,bk=base+k,ti=base+N+i,tk=base+N+k;
    indices.push(lo,bi,lk,lk,bi,bk,hi,hk,ti,hk,tk,ti,bi,ti,bk,bk,ti,tk);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);creaseIndexedNormals(geometry);geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.userData={grooveCount:8,boreRadius:bore,clearance:data.clearance};return geometry;
}
