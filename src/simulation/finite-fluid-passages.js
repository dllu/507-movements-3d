import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export function mergePassageParts(parts) {
  const normalized=parts.map(g=>{const n=g.index?g.toNonIndexed():g;for(const name of Object.keys(n.attributes))if(!['position','normal'].includes(name))n.deleteAttribute(name);return n;});
  const result=mergeGeometries(normalized);for(const g of new Set([...parts,...normalized]))g.dispose();return result;
}

// Closed tube wall with an open bore at both ends, including annular end faces.
export function curvedPipeWall(curve,inner,outer,segments=64,sides=24) {
  const frames=curve.computeFrenetFrames(segments,false),positions=[],indices=[];
  for(const radius of[outer,inner])for(let i=0;i<=segments;i++){
    const center=curve.getPointAt(i/segments);
    for(let j=0;j<sides;j++){const angle=j*2*Math.PI/sides,p=center.clone().addScaledVector(frames.normals[i],radius*Math.cos(angle)).addScaledVector(frames.binormals[i],radius*Math.sin(angle));positions.push(...p.toArray());}
  }
  const offset=(segments+1)*sides;
  for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){
    const a=i*sides+j,b=i*sides+(j+1)%sides,c=b+sides,d=a+sides;
    indices.push(a,b,c,a,c,d,offset+a,offset+c,offset+b,offset+a,offset+d,offset+c);
  }
  for(let j=0;j<sides;j++){
    const a=j,b=(j+1)%sides,c=segments*sides+j,d=segments*sides+(j+1)%sides;
    indices.push(a,offset+b,b,a,offset+a,offset+b,c,d,offset+d,c,offset+d,offset+c);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
