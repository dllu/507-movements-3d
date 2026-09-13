import * as THREE from 'three';
import {hexRadius} from './thread-geometry.js';
import {matte,PALETTE} from '../primitives.js';

// Presentation only: the complete physical nut remains in the native model.
// The cut stays on the fixed front plane while the nut rotates and travels.
export function makeScrewSection(root,parts,f) {
  const plane=new THREE.Plane(new THREE.Vector3(0,0,-1),0),capacity=256,positions=new Float32Array(capacity*3),normals=new Float32Array(capacity*3);
  for(let i=0;i<capacity;i++)normals.set([0,-1,0],3*i);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));
  const cap=new THREE.Mesh(geometry,matte(new THREE.Color(PALETTE.driver).lerp(new THREE.Color(0xf1e5d1),.4),{roughness:.8}));
  cap.frustumCulled=false;cap.userData.presentationOnly=true;root.add(cap);
  const update=(angle,height)=>{
    if(!cap.visible)return;let count=0;
    const polygon=points=>{
      const shape=points.map(p=>new THREE.Vector2(...p));
      for(const tri of THREE.ShapeUtils.triangulateShape(shape,[])) {
        const [a,b,c]=tri.map(i=>points[i]);if((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])<0)[tri[1],tri[2]]=[tri[2],tri[1]];
        for(const i of tri){if(count>=capacity)throw Error('Screw section capacity exceeded');positions.set([points[i][0],-.000001,points[i][1]+height],3*count++);}
      }
    };
    for(const side of [-1,1]) {
      const ray=side<0?Math.PI:0,local=ray-angle,p=f.nut,outer=hexRadius(p,local).radius,end=p.radius*Math.cos(Math.PI/6),fraction=(outer-end)/(p.radius-end);
      polygon([[side*p.bore,p.low],[side*end,p.low],[side*outer,p.low+p.bottomBevel*fraction],
        [side*outer,p.high-p.topBevel*fraction],[side*end,p.high],[side*p.bore,p.high]]);
      const t=f.internal,range=[(t.low-t.width/2-t.phase)/t.lead,(t.high+t.width/2-t.phase)/t.lead].sort((a,b)=>a-b);
      for(let turn=Math.ceil((range[0]-local)/(2*Math.PI));turn<=Math.floor((range[1]-local)/(2*Math.PI));turn++) {
        const center=t.phase+t.lead*(local+turn*2*Math.PI),low=Math.max(t.low,center-t.width/2),high=Math.min(t.high,center+t.width/2);
        if(high-low>1e-10)polygon([[side*t.inner,low],[side*t.outer,low],[side*t.outer,high],[side*t.inner,high]]);
      }
    }
    geometry.setDrawRange(0,count);geometry.attributes.position.needsUpdate=true;
  };
  const set=enabled=>{
    for(const part of [parts.nutBody,parts.internalThread]){part.material.clippingPlanes=enabled?[plane]:[];part.material.clipShadows=true;part.material.needsUpdate=true;}
    cap.visible=Boolean(enabled);root.userData.sectionView=Boolean(enabled);
    if(enabled){const state=root.userData.state?.qpos??[0,0];update(state[0],f.nutBase+state[1]);}
  };
  set(false);return {update,set,cap};
}
