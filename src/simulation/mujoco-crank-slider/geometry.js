import * as THREE from 'three';
import source from './source.js';
import {cubicPolyline} from '../cubic-polyline.js';
import {plate,poly,circle,disk,ring,rotate,polygonClipping as clip} from '../finite-plate-geometry.js';
import {PALETTE,matte,markShadows} from '../primitives.js';

export {THREE};

export function makeCrankSliderGeometry() {
  const root=new THREE.Group(),parts={},families={},blocks={};
  const attach=(name,geometry,family,color,position=[0,0,0])=>{
    if(!blocks[family]){blocks[family]=new THREE.Group();root.add(blocks[family]);}
    const mesh=new THREE.Mesh(geometry,matte(color,{metalness:.14,roughness:.6}));
    mesh.name=name;mesh.position.fromArray(position);blocks[family].add(mesh);parts[name]=mesh;families[name]=family;return mesh;
  };
  const px=x=>x/100,point=([x,y])=>[px(x-source.axis[0]),px(source.axis[1]-y)];
  const r=px(source.crankRadius),length=px(source.rodLength),offset=px(source.offset),phase=source.phase;
  const shaftRadius=px(source.shaftRadius),bore=shaftRadius+.0015,outerRadius=px(source.outerRadius);
  // Six repeated openings reconstruct the cast spokes. Their rounded roots
  // and flared sides follow the clear upper opening; the hidden one is repeated.
  const holeRadius=px(source.innerRadius),fit=source.opening,angle=fit.angle;
  const a=[-holeRadius*Math.sin(angle),holeRadius*Math.cos(angle)],b=[-a[0],a[1]];
  const curve=cubicPolyline([a,[-fit.controlX,fit.controlY],[-fit.rootControlX,fit.root],[0,fit.root]],.0005).points;
  const other=cubicPolyline([[0,fit.root],[fit.rootControlX,fit.root],[fit.controlX,fit.controlY],b],.0005).points;
  const arc=Array.from({length:41},(_,i)=>{const t=Math.PI/2-angle+i*2*angle/40;return [holeRadius*Math.cos(t),holeRadius*Math.sin(t)];});
  const opening=[...curve.slice(0,-1),...other.slice(0,-1),...arc].map(p=>rotate(p,fit.phase));
  const holes=Array.from({length:6},(_,i)=>poly(opening.map(p=>rotate(p,i*Math.PI/3-phase))));
  const wheel=clip.difference(poly(circle([0,0],outerRadius,256)),poly(circle([0,0],bore,128)),...holes);
  attach('wheel',plate(wheel,-.08,.08),'input',PALETTE.driver);
  attach('frontHub',ring(bore,px(source.hubRadius),.08,.18,128),'input',PALETTE.driver);
  attach('rearHub',ring(bore,px(source.hubRadius),-.14,-.08,128),'input',PALETTE.driver);
  attach('shaft',disk(shaftRadius,-.48,.19,128),'input',PALETTE.ink);
  const crankPinRadius=px(source.crankPinRadius),wristPinRadius=px(source.wristPinRadius);
  attach('crankBoss',disk(.055,.08,.185,96),'input',PALETTE.driver,[r,0,0]);
  attach('crankPin',disk(crankPinRadius,.185,.34,96),'input',PALETTE.brass,[r,0,0]);
  attach('crankCap',disk(.054,.34,.365,96),'input',PALETTE.brass,[r,0,0]);
  const radii=[source.crankEyeRadius,source.wristEyeRadius].map(px),tangent=Math.acos((radii[0]-radii[1])/length);
  const rodOutline=[...Array.from({length:65},(_,i)=>{const t=tangent+(2*Math.PI-2*tangent)*i/64;return [radii[0]*Math.cos(t),radii[0]*Math.sin(t)];}),
    ...Array.from({length:65},(_,i)=>{const t=-tangent+2*tangent*i/64;return [length+radii[1]*Math.cos(t),radii[1]*Math.sin(t)];})];
  const rod=clip.difference(poly(rodOutline),poly(circle([0,0],crankPinRadius+.0015,96)),poly(circle([length,0],wristPinRadius+.0015,96)));
  attach('rod',plate(rod,.20,.32),'rod',PALETTE.driven);
  const [x0,y0,x1,y1]=source.crosshead;
  const block=poly([[x0,y0],[x1,y0],[x1,y1],[x0,y1]].map(([x,y])=>[px(x-source.wrist[0]),px(source.wrist[1]-y)]));
  // Pass 101: the slide block is gold so the blue rod's end reads against it.
  attach('crosshead',plate(block,.08,.18),'slider',PALETTE.accent);
  attach('wristPin',disk(wristPinRadius,.18,.34,96),'slider',PALETTE.brass);
  attach('wristCap',disk(.054,.34,.365,96),'slider',PALETTE.brass);
  const [top,upper,lower,bottom]=source.guideY.map(y=>point([0,y])[1]),left=point([source.guideLeft,0])[0],innerLeft=point([source.guideInnerLeft,0])[0],right=point([source.guideRight,0])[0];
  const clearance=.002,shoeY=[lower-offset+clearance,upper-offset-clearance];
  attach('shoe',new THREE.BoxGeometry(.34,shoeY[1]-shoeY[0],.20),'slider',PALETTE.accent,[0,(shoeY[0]+shoeY[1])/2,-.02]);
  // Brown breaks the guide off at the right; the real guide runs on a little
  // past that line and is closed by an end bar, so its bars do not stop in
  // open space. The slot (and the stroke limit `right`) are unchanged.
  const guideEnd=right+.6,endBar=.12;
  const guide=clip.difference(poly([[left,bottom],[guideEnd+endBar,bottom],[guideEnd+endBar,top],[left,top]]),poly([[innerLeft,lower],[guideEnd,lower],[guideEnd,upper],[innerLeft,upper]]));
  attach('guide',plate(guide,-.15,.06),'frame',PALETTE.muted);
  // Pass 96: Brown draws no frame between the shaft and the guide. A rear
  // bar joining them (the old `rearSupport`) showed through the wheel's six
  // spoke openings and the 0.02 rim-to-guide gap, so any static connector
  // behind the wheel is visible; the guide and the hatched shaft end are both
  // fixed ground, as drawn, and nothing joins them.
  const atAngle=theta=>{
    const pin=[r*Math.cos(theta),r*Math.sin(theta)],dy=offset-pin[1],dx=Math.sqrt(length*length-dy*dy);
    return {pin,slider:pin[0]+dx,rodAngle:Math.atan2(dy,dx)};
  };
  const initial=atAngle(phase);blocks.input.rotation.z=phase;blocks.rod.position.set(...initial.pin,0);blocks.rod.rotation.z=initial.rodAngle;blocks.slider.position.set(initial.slider,offset,0);
  Object.assign(root.userData,{parts,families,blocks,source,atAngle,hideGround:true,
    geometry:{r,length,offset,phase,outerRadius,shaftRadius,crankPinRadius,wristPinRadius,clearance,left,innerLeft,right,guideEnd,top,upper,lower,bottom,shoeY,opening}});
  markShadows(root);root.updateMatrixWorld(true);
  return {root,focus:new THREE.Vector3(1,0,0),cameraDirection:new THREE.Vector3(.5,.4,10)};
}
