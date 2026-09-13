import * as THREE from 'three';
import {plate,poly,polygonClipping as clip} from '../finite-plate-geometry.js';
import {matte,PALETTE} from '../primitives.js';
import source from './source.js';
const rectangle=(l,b,r,t)=>poly([[l,b],[r,b],[r,t],[l,t]]);

// Cut only the visible housings. The complete bodies, mass and native
// constraints are unchanged; these thin caps merely close the exposed cut.
export function makeScrewPressSection(root,parts,blocks,f,housingProfile,ramProfile) {
  const plane=new THREE.Plane(new THREE.Vector3(0,0,-1),0),caps=[];
  const turnSection=profile=>clip.union(...[-1,1].map(sign=>poly(profile.map(([y,r])=>[sign*r,y]))));
  let nut=turnSection(housingProfile);
  const t=f.internal;
  for(const [a,sign] of [[0,1],[Math.PI,-1]]) {
    const min=Math.floor(((t.low-t.width/2-t.phase)/t.lead-a)/(2*Math.PI));
    const max=Math.ceil(((t.high+t.width/2-t.phase)/t.lead-a)/(2*Math.PI));
    for(let n=min;n<=max;n++) {
      const center=t.phase+t.lead*(a+n*2*Math.PI),low=Math.max(t.low,center-t.width/2),high=Math.min(t.high,center+t.width/2);
      if(high>low)nut=clip.union(nut,rectangle(sign>0?t.inner:-t.outer,low,sign>0?t.outer:-t.inner,high));
    }
  }
  const e=source.edges,bore=f.ramRadius+.003;
  const guide=clip.difference(rectangle(f.x(e.guideLeft),f.y(e.guideBottom),f.x(e.guideRight),f.y(e.guideTop)),rectangle(-bore,f.y(e.guideBottom)-.01,bore,f.y(e.guideTop)+.01));
  const ram=clip.union(turnSection(ramProfile),turnSection([[f.capBottom,f.bearing.neck+.003],[f.capBottom,f.ramRadius],[f.ramTop,f.ramRadius],[f.ramTop,f.bearing.neck+.003]]));
  for(const [family,shape,color] of [['frame',clip.union(nut,guide),PALETTE.frame],['ram',ram,PALETTE.driven]]) {
    const cap=new THREE.Mesh(plate(shape,0,.000001),matte(new THREE.Color(color).lerp(new THREE.Color(0xf1e5d1),.4),{roughness:.8}));
    cap.userData.presentationOnly=true;blocks[family].add(cap);caps.push(cap);
  }
  const set=enabled=>{
    for(const name of ['nutHousing','internalThread','guide','ram','ramCap']) {
      const m=parts[name].material;m.clippingPlanes=enabled?[plane]:[];m.clipShadows=true;m.needsUpdate=true;
    }
    for(const cap of caps)cap.visible=Boolean(enabled);
    root.userData.sectionView=Boolean(enabled);
  };
  set(false);return{set,caps};
}
