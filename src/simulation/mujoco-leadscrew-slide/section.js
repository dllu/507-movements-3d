import * as THREE from 'three';
import {plate,poly,polygonClipping as clip} from '../finite-plate-geometry.js';
import {matte,PALETTE} from '../primitives.js';
const rectangle=(left,bottom,right,top)=>poly([[left,bottom],[right,bottom],[right,top],[left,top]]);
// The complete contact bodies remain in MuJoCo; only presentation is cut.
export function makeLeadscrewSlideSection(root,parts,blocks,f,outline) {
  const plane=new THREE.Plane(new THREE.Vector3(0,0,-1),0),caps=[];
  let polygons=clip.union(poly(outline),rectangle(-f.neckHalf,f.neckBottom,f.neckHalf,f.neckTop),
    rectangle(f.footLeft+.04,f.railTop-.1,f.footRight-.04,f.footBottom));
  polygons=clip.difference(polygons,rectangle(-f.neckHalf-.01,-f.internal.outer,f.neckHalf+.01,f.internal.outer));
  const t=f.internal;
  for(const [a,side] of [[Math.PI/2,1],[3*Math.PI/2,-1]]) {
    const min=Math.floor(((t.low-t.width/2-t.phase)/t.lead-a)/(2*Math.PI)),max=Math.ceil(((t.high+t.width/2-t.phase)/t.lead-a)/(2*Math.PI));
    for(let n=min;n<=max;n++) {
      const center=t.phase+t.lead*(a+n*2*Math.PI),low=Math.max(t.low,center-t.width/2),high=Math.min(t.high,center+t.width/2);
      if(high>low)polygons=clip.union(polygons,rectangle(low,side>0?t.inner:-t.outer,high,side>0?t.outer:-t.inner));
    }
  }
  for(const [family,shape,color] of [['carriage',polygons,PALETTE.driven],['frame',rectangle(0,f.railBottom,f.railEnd,f.railTop-.103),PALETTE.frame]]) {
    const cap=new THREE.Mesh(plate(shape,0,.000001),matte(new THREE.Color(color).lerp(new THREE.Color(0xf1e5d1),.4),{roughness:.8}));
    cap.userData.presentationOnly=true;blocks[family].add(cap);caps.push(cap);
  }
  const set=enabled=>{
    for(const part of [parts.carriageBody,parts.guideKey,parts.internalThread,parts.guide]) {
      part.material.clippingPlanes=enabled?[plane]:[];part.material.clipShadows=true;part.material.needsUpdate=true;
    }
    for(const cap of caps)cap.visible=Boolean(enabled);root.userData.sectionView=Boolean(enabled);
  };
  set(false);return {set,caps};
}
