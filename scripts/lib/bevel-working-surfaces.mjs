import * as THREE from 'three';
import { solidSurface, surfacePoints } from '../../tests/helpers/solid-surface.mjs';

function cleanBoundary(geometry){
  const p=geometry.attributes.position,index=geometry.index,indices=[];
  for(let i=0;i<(index?.count??p.count);i+=3){
    const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j),[a,b,c]=ids.map(j=>new THREE.Vector3().fromBufferAttribute(p,j));
    if(b.sub(a).cross(c.sub(a)).lengthSq()>1e-22)indices.push(...ids);
  }
  const boundary=geometry.clone();boundary.setIndex(indices);return boundary;
}

export function prepareBevelSurfaces(gear){
  const tooth=gear.userData.toothMeshes[0],teeth=gear.userData.teeth,pitch=2*Math.PI/teeth;
  const body=gear.userData.body,bodySurface=solidSurface(cleanBoundary(body.geometry));
  const geometryCache=new Map();
  const record=mesh=>{
    if(!geometryCache.has(mesh.geometry))geometryCache.set(mesh.geometry,{points:surfacePoints(mesh.geometry),surface:solidSurface(cleanBoundary(mesh.geometry))});
    return{mesh,...geometryCache.get(mesh.geometry)};
  };
  const toothData=new Map(gear.userData.toothMeshes.map(mesh=>[mesh.userData.index,record(mesh)]));
  return{gear,pitch,teeth,body,bodySurface,toothData,parts:[record(body),...toothData.values()]};
}

export function sampleBevelPair(source,target,{maximum=.08,includeBody=true}={}){
  const inverse=target.gear.userData.rotor.matrixWorld.clone().invert();
  const bodyInverse=target.body.matrixWorld.clone().invert().multiply(target.gear.userData.rotor.matrixWorld);
  let gap=maximum,checks=0,inside=0,witness=null;
  for(const part of source.parts){
    if(!includeBody&&part.mesh===source.body)continue;
    const transform=inverse.clone().multiply(part.mesh.matrixWorld);
    for(const point of part.points){
      const local=point.clone().applyMatrix4(transform);checks++;let distance=maximum,targetPart=null;
      if(includeBody){const p=local.clone().applyMatrix4(bodyInverse);if(target.bodySurface.box.distanceToPoint(p)<maximum){distance=target.bodySurface.signedDistance(p,maximum);targetPart='body';}}
      const nearest=Math.round(Math.atan2(local.y,local.x)/target.pitch);
      for(let offset=-1;offset<=1;offset++){
        const index=THREE.MathUtils.euclideanModulo(nearest+offset,target.teeth),tooth=target.toothData.get(index);if(!tooth)continue;
        const angle=-index*target.pitch,c=Math.cos(angle),s=Math.sin(angle),p=new THREE.Vector3(c*local.x-s*local.y,s*local.x+c*local.y,local.z);
        if(tooth.surface.box.distanceToPoint(p)>=maximum)continue;
        const value=tooth.surface.signedDistance(p,maximum);if(value<distance){distance=value;targetPart=index;}
      }
      if(!Number.isFinite(distance))throw new Error('Nonfinite bevel distance');
      if(distance<-1e-6)inside++;
      if(distance<gap){gap=distance;witness={sourcePart:part.mesh===source.body?'body':part.mesh.userData.index,targetPart,point:local.toArray(),distance};}
    }
  }
  return{gap,checks,inside,witness};
}
