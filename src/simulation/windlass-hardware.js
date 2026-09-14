import * as THREE from 'three';

// Almost uniform pitch, easing only over a quarter-turn at each end. A global
// cubic ease collapses adjacent coil spacing at the ends of the winding.
export function windingAdvance(t,turns){
 const e=.25/turns,integral=u=>u**3-.5*u**4;
 const ramp=u=>3*u*u-2*u*u*u;
 if(t<e)return {position:e*integral(t/e)/(1-e),derivative:ramp(t/e)/(1-e)};
 if(t>1-e){const u=(1-t)/e;return {position:1-e*integral(u)/(1-e),derivative:ramp(u)/(1-e)};}
 return {position:(t-e/2)/(1-e),derivative:1/(1-e)};
}

/** A single sheave solid: smooth circumference, flat faces, open rope groove. */
export function windlassSheaveGeometry(radius,ropeRadius,width=.46){
 const bed=radius-ropeRadius,rim=radius+ropeRadius+.02;
 const bedHalfWidth=ropeRadius*1.6,lip=bedHalfWidth+.035;
 const profile=[[.105,-width/2],[rim-.015,-width/2],[rim,-width/2+.015],
  [rim,-lip],[bed,-bedHalfWidth],[bed,bedHalfWidth],[rim,lip],
  [rim,width/2-.015],[rim-.015,width/2],[.105,width/2],[.105,-width/2]];
 const positions=[],normals=[],indices=[],segments=128;
 for(let j=0;j<profile.length-1;j++){
  const [r0,z0]=profile[j],[r1,z1]=profile[j+1],dr=r1-r0,dz=z1-z0,n=Math.hypot(dr,dz);
  for(let i=0;i<segments;i++){
   const start=positions.length/3;
   for(const [r,z,k] of [[r0,z0,i],[r0,z0,i+1],[r1,z1,i+1],[r1,z1,i]]){
    const a=k*2*Math.PI/segments,c=Math.cos(a),s=Math.sin(a);
    positions.push(r*c,r*s,z);normals.push(dz*c/n,dz*s/n,-dr/n);
   }
   indices.push(start,start+1,start+2,start,start+2,start+3);
  }
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setIndex(indices);g.computeBoundingBox();g.computeBoundingSphere();
 g.userData.profile=profile;return g;
}

export function windlassHookGeometry(){
 const s=new THREE.Shape(),p=(x,y)=>[(x-254)*.016,(319-y)*.016];
 s.moveTo(...p(248,409));s.lineTo(...p(264,409));
 s.bezierCurveTo(...p(263,435),...p(245,451),...p(239,468));
 s.bezierCurveTo(...p(228,493),...p(256,496),...p(266,474));
 s.bezierCurveTo(...p(270,463),...p(274,456),...p(283,455));
 s.bezierCurveTo(...p(275,466),...p(277,486),...p(264,495));
 s.bezierCurveTo(...p(232,517),...p(211,492),...p(224,466));
 s.bezierCurveTo(...p(232,448),...p(248,434),...p(248,409));s.closePath();
 const g=new THREE.ExtrudeGeometry(s,{depth:.12,bevelEnabled:true,bevelSize:.008,bevelOffset:-.008,bevelThickness:.008,bevelSegments:2,curveSegments:20});g.translate(0,0,-.06);return g;
}
