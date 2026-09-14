import * as THREE from 'three';

// Extrude an XZ footprint along Y. Hole centres are relative to the mesh,
// allowing off-centre frame members to share a shaft on the world Y axis.
export function boredHorizontalPlate({outline,holes,depth}) {
 const shape=new THREE.Shape(outline.map(([x,z])=>new THREE.Vector2(x,-z)));
 for(const {x=0,z=0,radius} of holes){const hole=new THREE.Path();hole.absarc(x,-z,radius,0,2*Math.PI,true);shape.holes.push(hole);}
 const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:64});
 geometry.translate(0,0,-depth/2);geometry.rotateX(-Math.PI/2);
 geometry.userData.bores=holes.map(h=>({...h}));geometry.userData.depth=depth;
 return geometry;
}
