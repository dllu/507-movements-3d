import * as THREE from 'three';
import {ring} from './finite-plate-geometry.js';

// Inferred axial supports: both bearings lie beyond the wheel's working width.
export function wheelBearings(root,shaft,material,baseY){
  shaft.geometry.dispose();shaft.geometry=new THREE.CylinderGeometry(.22,.22,2.2,64);
  const bearings=[],supports=[];
  for(const z of[-.94,.94]){
    const bearing=new THREE.Mesh(ring(.224,.43,z-.10,z+.10,128),material);
    bearing.userData.role='bored-fixed-water-wheel-bearing';root.add(bearing);bearings.push(bearing);
    const top=-.38,height=top-baseY,support=new THREE.Mesh(new THREE.BoxGeometry(.28,height,.20),material);
    support.position.set(0,(top+baseY)/2,z);support.userData.role='shaft-connected-bearing-pedestal';root.add(support);supports.push(support);
  }
  return {bearings,bearingPedestals:supports};
}

export function makeCellWaterGeometry(){
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(180),3));
  g.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(180),3));return g;
}

// Clip a finite cell trapezoid by a horizontal plane. This is a volume glyph,
// not a mass-conserving flow solver. Reuse buffers rather than creating meshes.
export function updateCellWater(mesh,{angle,halfAngle,inner,outer,fill,origin,width}){
  const point=(r,a)=>new THREE.Vector2(r*Math.cos(a)-origin.x,r*Math.sin(a)-origin.y);
  let points=[point(inner,angle-halfAngle),point(outer,angle-halfAngle),point(outer,angle+halfAngle),point(inner,angle+halfAngle)];
  const ys=points.map(p=>p.y),level=Math.min(...ys)+(Math.max(...ys)-Math.min(...ys))*Math.max(0,Math.min(1,fill));
  const clipped=[];
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length];if(a.y<=level)clipped.push(a);
    if((a.y<level&&b.y>level)||(a.y>level&&b.y<level))clipped.push(new THREE.Vector2(a.x+(b.x-a.x)*(level-a.y)/(b.y-a.y),level));
  }
  points=clipped;const g=mesh.geometry,p=g.attributes.position;let count=0;
  const vertex=(v,z)=>{p.setXYZ(count++,v.x,v.y,z);};
  const triangle=(a,b,c,z)=>{vertex(a,z);vertex(b,z);vertex(c,z);};
  if(points.length>=3){
    for(let i=1;i<points.length-1;i++){triangle(points[0],points[i],points[i+1],width/2);triangle(points[0],points[i+1],points[i],-width/2);}
    for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length];vertex(a,-width/2);vertex(b,-width/2);vertex(b,width/2);vertex(a,-width/2);vertex(b,width/2);vertex(a,width/2);
    }
  }
  for(let i=count;i<p.count;i++)p.setXYZ(i,0,0,0);
  p.needsUpdate=true;g.setDrawRange(0,count);g.computeVertexNormals();g.computeBoundingSphere();
  mesh.visible=fill>.002;mesh.position.set(0,0,0);mesh.scale.set(1,1,1);
}
