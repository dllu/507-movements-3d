import * as THREE from 'three';
import {poly,polygonClipping as clip} from '../finite-plate-geometry.js';
import {smoothPrismNormals} from './normals.js';
export function reverseThreadShoe(f) {
 const cells=[],faces=new Map(),key=p=>p.map(v=>v.toFixed(9)).join(',');
 const addTriangle=(p,c,axis)=>{if(new Set(p.map(key)).size<3)return;const v=p.map(p=>new THREE.Vector3(...p)),normal=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0]));if(normal.length()<1e-12)return;if(normal.dot(axis??new THREE.Vector3(v[0].x-c.x,v[0].y-c.y,0))<0)p=[p[0],p[2],p[1]];const k=p.map(key).sort().join('/');if(faces.has(k))faces.delete(k);else faces.set(k,p);};
 const addCell=outline=>{
  const n=outline.length,cell=[0,1].flatMap(side=>outline.map(([x,y])=>[x,y,f.shoeZ(x,side)].map(v=>Math.fround(Number(v.toFixed(9))))));
  cells.push(cell);const c=cell.reduce((v,p)=>v.add(new THREE.Vector3(...p)),new THREE.Vector3()).multiplyScalar(1/(2*n));
  for(const side of [0,1])for(let j=1;j<n-1;j++)addTriangle([cell[side*n],cell[side*n+j],cell[side*n+j+1]],c,new THREE.Vector3(0,0,side?1:-1));
  for(let k=0;k<n;k++) {
   const p=[cell[k],cell[(k+1)%n],cell[(k+1)%n+n],cell[k+n]],keys=p.map(key),start=keys.indexOf([...keys].sort()[0]),q=p.map((_,k)=>p[(k+start)%4]);
   addTriangle([q[0],q[1],q[2]],c);addTriangle([q[0],q[2],q[3]],c);
  }
 };
 const contour=f.contour(),end=f.shoeLength+f.shoeRadius;
 for(let i=0;i<f.shoeSegments;i++) {
  const a=-end+2*end*i/f.shoeSegments,b=-end+2*end*(i+1)/f.shoeSegments;
  const intersection=clip.intersection(poly(contour),poly([[a,-1],[b,-1],[b,1],[a,1]]));
  if(!intersection.length)continue;
  const outline=intersection[0][0].slice(0,-1);
  // Interior strips have just two X coordinates, making both radial caps
  // planar. Their exact convex union needs one collider instead of two.
  if(new Set(outline.map(([x])=>x.toFixed(9))).size===2){addCell(outline);continue;}
  // Triangular caps are planar even at the curved nose. A hull of a whole
  // clipped strip would fill material below its concave inner surface.
  for(let j=1;j<outline.length-1;j++) {
   const triangle=[outline[0],outline[j],outline[j+1]];
   if(Math.abs(THREE.ShapeUtils.area(triangle.map(p=>new THREE.Vector2(...p))))<1e-12)continue;
   addCell(triangle);
  }
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([...faces.values()].flat(2),3));g.computeVertexNormals();return{geometry:smoothPrismNormals(g),cells};
}
