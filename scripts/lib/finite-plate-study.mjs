import * as THREE from 'three';
import polygonClipping from 'polygon-clipping';
import{turnedClutchGeometry}from'../../src/simulation/clutch-section-geometry.js';

export const add=(a,b)=>[a[0]+b[0],a[1]+b[1]],sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],
  rotate=(p,a)=>[p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a)],
  poly=points=>[[[...points,points[0]]]],
  circle=(center,r,count=512)=>Array.from({length:count},(_,i)=>add(center,[r*Math.cos(i*2*Math.PI/count),r*Math.sin(i*2*Math.PI/count)]));
export const capsule=(a,b,r,count=128)=>{
  const angle=Math.atan2(b[1]-a[1],b[0]-a[0]),points=[];
  for(const[center,start]of[[b,angle-Math.PI/2],[a,angle+Math.PI/2]])for(let i=0;i<=count;i++)
    points.push(add(center,[r*Math.cos(start+Math.PI*i/count),r*Math.sin(start+Math.PI*i/count)]));
  return poly(points);
};
export const sector=(inner,outer,start,end,count=128)=>poly([
  ...Array.from({length:count+1},(_,i)=>rotate([outer,0],start+(end-start)*i/count)),
  ...Array.from({length:count+1},(_,i)=>rotate([inner,0],end-(end-start)*i/count))]);
export const spline=points=>new THREE.SplineCurve(points.map(p=>new THREE.Vector2(...p))).getPoints(128).map(p=>p.toArray());
export function plate(polygons,low,high){
  const clean=ring=>{
    const points=[];
    for(const p of ring){const q=p.map(Math.fround),last=points.at(-1);if(!last||last[0]!==q[0]||last[1]!==q[1])points.push(q);}
    if(points[0][0]===points.at(-1)[0]&&points[0][1]===points.at(-1)[1])points.pop();
    let changed=true;
    while(changed){changed=false;for(let i=0;i<points.length;i++){
      const a=points[(i+points.length-1)%points.length],b=points[i],c=points[(i+1)%points.length],d=sub(c,a),v=sub(b,a),
        length=Math.hypot(...d),projection=v[0]*d[0]+v[1]*d[1];
      if(length>0&&projection>=0&&projection<=length*length&&Math.abs(v[0]*d[1]-v[1]*d[0])/length<1e-7){points.splice(i,1);changed=true;break;}
    }}
    return points;
  };
  const shapes=polygons.map(([outer,...holes])=>{
    const shape=new THREE.Shape(clean(outer).map(p=>new THREE.Vector2(...p)));
    shape.holes=holes.map(r=>new THREE.Path(clean(r).map(p=>new THREE.Vector2(...p))));return shape;
  });
  const geometry=new THREE.ExtrudeGeometry(shapes,{depth:high-low,bevelEnabled:false,curveSegments:1});
  geometry.translate(0,0,low);geometry.userData.plate={low,high,polygons};return geometry;
}
export const turned=(profile,count=512)=>turnedClutchGeometry(profile,{angularSegments:count}),
  disk=(radius,low,high,count=512)=>turned([[low,0],[low,radius],[high,radius],[high,0]],count),
  ring=(inner,outer,low,high,count=512)=>turned([[low,inner],[low,outer],[high,outer],[high,inner]],count);
export{polygonClipping};

export function familyMass(parts,families,family){
  let volume=0,moment=[0,0,0],polar=0;
  for(const[name,mesh]of Object.entries(parts))if(families[name]===family){
    mesh.updateMatrix();const g=mesh.geometry,p=g.attributes.position,index=g.index;
    for(let i=0;i<(index?.count??p.count);i+=3){
      const[a,b,c]=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i+j):i+j).applyMatrix4(mesh.matrix)),
        v=a.dot(new THREE.Vector3().crossVectors(b,c))/6;
      volume+=v;for(let k=0;k<3;k++)moment[k]+=v*(a.getComponent(k)+b.getComponent(k)+c.getComponent(k))/4;
      for(const k of ['x','y'])polar+=v*(a[k]**2+b[k]**2+c[k]**2+a[k]*b[k]+b[k]*c[k]+c[k]*a[k])/10;
    }
  }
  if(!(volume>0)||!(polar>0))throw new Error('Invalid finite mass');
  const centroid=moment.map(v=>v/volume);return{volume,centroid,polar,centralPolar:polar-volume*(centroid[0]**2+centroid[1]**2)};
}
