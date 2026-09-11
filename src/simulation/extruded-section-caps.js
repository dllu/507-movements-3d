import * as THREE from 'three';

// Presentation caps for a fixed set of world-space section planes. The
// complete physical extrusion remains intact and is audited separately.
export function makeExtrudedSectionCaps({polygons,low,high,planes,material,offset=[0,0]}){
  const root=new THREE.Group(),capacity=512,entries=planes.map(plane=>{
    const positions=new Float32Array(capacity*3),normals=new Float32Array(capacity*3),geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3).setUsage(THREE.DynamicDrawUsage));
    const mesh=new THREE.Mesh(geometry,material.clone());mesh.material.clippingPlanes=[];mesh.material.needsUpdate=true;
    mesh.userData.presentationOnly=true;mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;root.add(mesh);
    return{plane,positions,normals,geometry};
  });
  const update=angle=>{
    const c=Math.cos(angle),s=Math.sin(angle),rings=polygons.flat().map(ring=>ring.map(point=>{
      const x=point[0]+offset[0],y=point[1]+offset[1];return[x*c-y*s,x*s+y*c];
    }));
    for(const entry of entries){
      const{plane,positions,normals,geometry}=entry,n=plane.normal,base=[-plane.constant*n.x,-plane.constant*n.y],t=[-n.y,n.x],crossings=[];
      for(const ring of rings)for(let i=0;i<ring.length;i++){
        const a=ring[i],b=ring[(i+1)%ring.length],da=n.x*a[0]+n.y*a[1]+plane.constant,db=n.x*b[0]+n.y*b[1]+plane.constant;
        if((da>0)===(db>0))continue;
        const fraction=da/(da-db),x=a[0]+fraction*(b[0]-a[0]),y=a[1]+fraction*(b[1]-a[1]);crossings.push(x*t[0]+y*t[1]);
      }
      crossings.sort((a,b)=>a-b);let vertices=0;
      for(let i=0;i+1<crossings.length;i+=2){
        let a=crossings[i],b=crossings[i+1];
        for(const other of planes){if(other===plane)continue;
          const constant=other.normal.x*base[0]+other.normal.y*base[1]+other.constant,
            coefficient=other.normal.x*t[0]+other.normal.y*t[1];
          if(Math.abs(coefficient)<1e-12){if(constant<0)b=a;}
          else if(coefficient>0)a=Math.max(a,-constant/coefficient);else b=Math.min(b,-constant/coefficient);
        }
        if(b-a<1e-10)continue;
        const A=[base[0]+a*t[0],base[1]+a*t[1]],B=[base[0]+b*t[0],base[1]+b*t[1]];
        for(const[x,y,z]of[[...A,low],[...A,high],[...B,low],[...B,low],[...A,high],[...B,high]]){
          if(vertices>=capacity)throw new Error('Section cap vertex capacity exceeded');
          positions.set([x,y,z],3*vertices);normals.set([-n.x,-n.y,0],3*vertices);vertices++;
        }
      }
      geometry.setDrawRange(0,vertices);geometry.attributes.position.needsUpdate=true;geometry.attributes.normal.needsUpdate=true;
      geometry.boundingBox=null;geometry.boundingSphere=null;
    }
  };
  return{root,update,entries};
}
