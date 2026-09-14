import * as THREE from 'three';
import {PALETTE,matte} from '../primitives.js';

// Presentation only. The complete physical sleeve and every contact remain.
export function makeMicrometerSection(root,parts,f) {
 const plane=new THREE.Plane(new THREE.Vector3(0,0,-1),0),capacity=4096,positions=new Float32Array(capacity*3),normals=new Float32Array(capacity*3);
 for(let i=0;i<capacity;i++)normals.set([0,-1,0],3*i);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));
 const cap=new THREE.Mesh(geometry,matte(new THREE.Color(PALETTE.driver).lerp(new THREE.Color(0xf1e5d1),.4),{roughness:.8}));cap.frustumCulled=false;cap.userData.presentationOnly=true;root.add(cap);
 const update=(angle,height)=>{
  if(!cap.visible)return;let count=0;
  const rectangle=(x0,x1,z0,z1)=>{
   if(z1-z0<1e-10)return;
   for(const [x,z]of [[x0,z0],[x1,z0],[x1,z1],[x0,z0],[x1,z1],[x0,z1]]){if(count>=capacity)throw Error('Micrometer section capacity exceeded');positions.set([x,-.000001,z+height],count++*3);}
  };
  rectangle(-f.outerCore,f.outerCore,f.ceiling,f.top);
  for(const side of [-1,1]) {
   rectangle(side<0?-f.outerCore:f.bore,side<0?-f.bore:f.outerCore,0,f.ceiling);
   const local=(side<0?Math.PI:0)-angle;
   for(const t of [f.outer,f.internal]) {
    const lo=(t.low-t.width/2-t.phase)/t.lead,hi=(t.high+t.width/2-t.phase)/t.lead;
    for(let turn=Math.ceil((lo-local)/(2*Math.PI));turn<=Math.floor((hi-local)/(2*Math.PI));turn++) {
     const z=t.phase+t.lead*(local+turn*2*Math.PI),a=Math.max(t.low,z-t.width/2),b=Math.min(t.high,z+t.width/2);
     rectangle(side<0?-t.outer:t.inner,side<0?-t.inner:t.outer,a,b);
    }
   }
  }
  geometry.setDrawRange(0,count);geometry.attributes.position.needsUpdate=true;
 };
 const set=enabled=>{
  for(const name of ['sleeve','head','outerThread','internalThread']){const m=parts[name].material;m.clippingPlanes=enabled?[plane]:[];m.clipShadows=true;m.needsUpdate=true;}
  cap.visible=Boolean(enabled);root.userData.sectionView=Boolean(enabled);const q=root.userData.state?.qpos??[0,0];if(enabled)update(q[0],q[1]);
 };
 set(false);return {set,update,cap};
}
