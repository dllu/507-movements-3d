import * as THREE from 'three';
import {plate,polygonClipping as clip} from '../finite-plate-geometry.js';
import {convexPlateCells} from '../mujoco/convex-plate.js';

const key=p=>p.join(','),edgeKey=(a,b)=>[key(a),key(b)].sort().join('/');
const distance=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy,t=den?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/den)):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
function reduceOpen(points,tolerance){
 let maximum=0,index=0;for(let i=1;i<points.length-1;i++){const d=distance(points[i],points[0],points.at(-1));if(d>maximum){maximum=d;index=i;}}
 if(maximum<=tolerance)return[points[0],points.at(-1)];
 return[...reduceOpen(points.slice(0,index+1),tolerance).slice(0,-1),...reduceOpen(points.slice(index),tolerance)];
}
function reduceRing(points,tolerance){
 if(!tolerance)return points;let split=1;for(let i=2;i<points.length;i++)if(Math.hypot(points[i][0]-points[0][0],points[i][1]-points[0][1])>Math.hypot(points[split][0]-points[0][0],points[split][1]-points[0][1]))split=i;
 return[...reduceOpen(points.slice(0,split+1),tolerance).slice(0,-1),...reduceOpen([...points.slice(split),points[0]],tolerance).slice(0,-1)];
}

// Recover the actual rendered cap boundary, then bound every removed vertex's
// distance to its replacement chord. This retains the visible mesh while
// reducing the number of tiny convex cells needed by native collision.
export function segmentClampContactCells(geometry,tolerance=.0005){
 if(!Number.isFinite(tolerance)||tolerance<0)throw new RangeError('Invalid collision tolerance');
 geometry.computeBoundingBox();const low=geometry.boundingBox.min.z,high=geometry.boundingBox.max.z,p=geometry.attributes.position,ix=geometry.index,edges=new Map();
 for(let i=0;i<(ix?.count??p.count);i+=3){const ids=[0,1,2].map(j=>ix?ix.getX(i+j):i+j);if(!ids.every(j=>p.getZ(j)===high))continue;
  const triangle=ids.map(j=>[p.getX(j),p.getY(j)]);for(let j=0;j<3;j++){const a=triangle[j],b=triangle[(j+1)%3],k=edgeKey(a,b);if(edges.has(k))edges.delete(k);else edges.set(k,[a,b]);}
 }
 const next=new Map([...edges.values()].map(([a,b])=>[key(a),b])),rings=[];
 while(next.size){const start=next.keys().next().value,points=[];let k=start;
  do{const q=next.get(k);if(!q)throw Error('Broken contact outline');points.push(k.split(',').map(Number));next.delete(k);k=key(q);}while(k!==start);rings.push(points);
 }
 const simplified=rings.map(r=>reduceRing(r,tolerance));let maximumError=0;
 for(let i=0;i<rings.length;i++){const r=simplified[i];if(r.length<3)throw Error('Collapsed collision outline');for(const q of rings[i])maximumError=Math.max(maximumError,Math.min(...r.map((a,j)=>distance(q,a,r[(j+1)%r.length]))));}
 if(maximumError>tolerance+1e-12)throw Error('Collision chord error exceeded');
 const area=r=>THREE.ShapeUtils.area(r.map(p=>new THREE.Vector2(...p))),positive=simplified.filter(r=>area(r)>0).map(r=>[[[...r,r[0]]]]),negative=simplified.filter(r=>area(r)<0).map(r=>[[[...r,r[0]]]]);
 if(!positive.length)throw Error('No positive collision boundary');let polygons=clip.union(...positive);if(negative.length)polygons=clip.difference(polygons,...negative);
 const g=plate(polygons,low,high);try{const c=convexPlateCells(g);return{cells:c.cells.map(p=>[c.low,c.high].flatMap(z=>p.map(q=>[...q,z]))),maximumError,originalVertices:rings.reduce((n,r)=>n+r.length,0),vertices:simplified.reduce((n,r)=>n+r.length,0)};}finally{g.dispose();}
}
