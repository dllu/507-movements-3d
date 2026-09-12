import * as THREE from 'three';

// Deduplicate only identical complete attribute tuples. Hard normals, texture
// seams and vertex colors stay separate; every expanded triangle is unchanged.
export function indexPumpCatchHardware(model){
  const results=[];
  for(const[name,mesh]of Object.entries(model.root.userData.parts)){
    const original=mesh.geometry;if(name==='pumpRope'||original.index)continue;
    const entries=Object.entries(original.attributes),map=new Map(),indices=[],values=Object.fromEntries(entries.map(([key])=>[key,[]]));
    for(let i=0;i<original.attributes.position.count;i++){
      const row=entries.flatMap(([,a])=>Array.from({length:a.itemSize},(_,k)=>a.array[i*a.itemSize+k])),key=row.map(v=>Object.is(v,-0)?'-0':String(v)).join(',');
      let index=map.get(key);
      if(index===undefined){index=map.size;map.set(key,index);for(const[key,a]of entries)for(let k=0;k<a.itemSize;k++)values[key].push(a.array[i*a.itemSize+k]);}
      indices.push(index);
    }
    const geometry=new THREE.BufferGeometry();
    for(const[key,a]of entries)geometry.setAttribute(key,new THREE.BufferAttribute(new a.array.constructor(values[key]),a.itemSize,a.normalized));
    geometry.setIndex(indices);for(const group of original.groups)geometry.addGroup(group.start,group.count,group.materialIndex);
    geometry.setDrawRange(original.drawRange.start,original.drawRange.count);geometry.userData={...original.userData};
    results.push({name,oldVertices:original.attributes.position.count,newVertices:geometry.attributes.position.count,triangles:indices.length/3});
    original.dispose();mesh.geometry=geometry;
  }
  return results;
}
