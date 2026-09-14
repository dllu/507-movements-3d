import * as THREE from 'three';
import {PALETTE,matte} from '../primitives.js';
// The grip translates along the section plane and never rotates, so its caps
// are static in grip coordinates. This presentation does not alter contacts.
export function makePersianDrillSection(root,parts,f,block) {
 const plane=new THREE.Plane(new THREE.Vector3(0,0,-1),0),caps=new THREE.Group(),shapes=[];
 for(const side of [-1,1]) {
  shapes.push(new THREE.Shape(f.gripProfile.map(([z,r])=>new THREE.Vector2(side*r,z))));
  const angle=side<0?Math.PI:0;
  for(const t of f.internal) {
   const lo=(t.low-t.width/2-t.phase)/t.lead,hi=(t.high+t.width/2-t.phase)/t.lead;
   for(let k=Math.ceil((lo-angle)/(2*Math.PI));k<=Math.floor((hi-angle)/(2*Math.PI));k++) {
    const center=t.phase+t.lead*(angle+k*2*Math.PI),a=Math.max(t.low,center-t.width/2),b=Math.min(t.high,center+t.width/2);
    if(b-a<1e-10)continue;shapes.push(new THREE.Shape([[side*t.inner,a],[side*t.outer,a],[side*t.outer,b],[side*t.inner,b]].map(p=>new THREE.Vector2(...p))));
   }
  }
 }
 const g=new THREE.ShapeGeometry(shapes);g.rotateX(Math.PI/2);g.translate(0,-.000001,0);
 caps.add(new THREE.Mesh(g,matte(new THREE.Color(PALETTE.driver).lerp(new THREE.Color(0xf1e5d1),.4),{roughness:.8})));
 caps.userData.presentationOnly=true;block.add(caps);
 const set=enabled=>{for(const [name,m]of Object.entries(parts))if(name.startsWith('grip')){m.material.clippingPlanes=enabled?[plane]:[];m.material.clipShadows=true;m.material.needsUpdate=true;}caps.visible=Boolean(enabled);root.userData.sectionView=Boolean(enabled);};
 set(false);return {caps,set};
}
