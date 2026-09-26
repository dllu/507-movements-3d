import * as THREE from 'three';
import source from './source.js';
import {plate,poly,circle,capsule,disk,ring,polygonClipping as clip} from '../finite-plate-geometry.js';
import {PALETTE,matte,markShadows} from '../primitives.js';
import {cubicPolyline} from '../cubic-polyline.js';
import {makeSeeThrough} from '../see-through-part.js';

export {THREE};
export function makeVariableCrankGeometry({segments=384,frontOpacity=1,clearance=.00025}={}) {
  const root=new THREE.Group(),parts={},families={},blocks={};
  const attach=(name,geometry,family,color,position=[0,0,0])=>{
    if(!blocks[family]){blocks[family]=new THREE.Group();root.add(blocks[family]);}
    const material=['spiralPlate','radialPlate'].includes(name)?new THREE.MeshLambertMaterial({color}):matte(color,{metalness:.14,roughness:.6});
    const mesh=new THREE.Mesh(geometry,material);
    mesh.name=name;mesh.position.fromArray(position);blocks[family].add(mesh);parts[name]=mesh;families[name]=family;return mesh;
  };
  const [a,b,c,d,e]=source.spiral.map(x=>x/100),radius=t=>a+b*t+c*t*t+d*Math.cos(t)+e*Math.sin(t);
  const derivative=t=>b+2*c*t-d*Math.sin(t)+e*Math.cos(t);
  const centerAt=t=>[radius(t)*Math.cos(t),radius(t)*Math.sin(t)];
  const normalAt=t=>{
    const r=radius(t),dr=derivative(t),dx=dr*Math.cos(t)-r*Math.sin(t),dy=dr*Math.sin(t)+r*Math.cos(t),length=Math.hypot(dx,dy);
    return [dy/length,-dx/length];
  };
  const boltRadius=source.boltRadius/100,halfWidth=source.engravedGrooveWidth/200,neckRadius=halfWidth-clearance;
  const ends=source.spiralEnds,angles=Array.from({length:segments+1},(_,i)=>ends[0]+(ends[1]-ends[0])*i/segments);
  const offsetAt=(t,distance)=>{const p=centerAt(t),n=normalAt(t);return p.map((x,i)=>x+n[i]*distance);};
  const inner=angles.map(t=>offsetAt(t,-halfWidth)),outer=angles.map(t=>offsetAt(t,halfWidth));
  const tailStart=centerAt(ends[1]),n=normalAt(ends[1]),capCenter=[(source.terminalCap.center[0]-source.axis[0])/100,(source.axis[1]-source.terminalCap.center[1])/100];
  const tail=cubicPolyline([tailStart,[tailStart[0]-.10*n[1],tailStart[1]+.10*n[0]],[capCenter[0]+.055,capCenter[1]],capCenter],.0005);
  const tailPieces=tail.points.slice(1).map((p,i)=>capsule(tail.points[i],p,halfWidth,32));
  const groove=clip.union(poly([...outer,...[...inner].reverse()]),poly(circle(centerAt(ends[0]),halfWidth,64)),
    ...tailPieces,poly(circle(capCenter,source.terminalCap.radius/100,96)));
  const shaftRadius=source.shaftRadius/100,diskRadius=source.diskRadius/100,hubRadius=source.hubRadius/100;
  const inputProfile=clip.difference(poly(circle([0,0],diskRadius,256)),poly(circle([0,0],shaftRadius+.0015,128)),groove);
  const spiralPlate=attach('spiralPlate',plate(inputProfile,-.18,0),'input',PALETTE.driver);
  // Presentation only: a thin floor behind the washer closes the through-cut
  // groove, so the slots show the groove's dark channel rather than white
  // gaps. It is a child, not a part: masses and contact walls are unchanged.
  const grooveFloor=new THREE.Mesh(ring(shaftRadius+.0015,diskRadius,-.30,-.265,256),matte(0x9c3f2b,{metalness:.12,roughness:.7}));
  grooveFloor.name='groove-floor-behind-washer';spiralPlate.add(grooveFloor);
  attach('rearHub',ring(shaftRadius+.0015,hubRadius,-.26,-.18,128),'input',PALETTE.driver);
  attach('shaft',disk(shaftRadius,-.8,.28,128),'input',PALETTE.ink);
  const slots=source.slots.map(s=>({...s,ends:s.ends.map(x=>x/100),halfWidth:Math.max(s.halfWidth/100,boltRadius+clearance)}));
  const slotProfiles=slots.map(s=>capsule(...s.ends.map(r=>[r*Math.cos(s.angle),r*Math.sin(s.angle)]),s.halfWidth,64));
  const frontProfile=clip.difference(poly(circle([0,0],diskRadius,256)),poly(circle([0,0],shaftRadius+.0015,128)),...slotProfiles);
  const front=attach('radialPlate',plate(frontProfile,.04,.20),'frame',PALETTE.muted);
  // Brown dots the spiral groove because the slotted plate hides it: the
  // slotted plate is see-through (see-through-part.js), so the real grooved
  // plate and the bolt's shank show behind it as well as through the slots.
  if(frontOpacity<1){front.material.transparent=true;front.material.opacity=frontOpacity;front.material.depthWrite=false;front.renderOrder=1;}
  else makeSeeThrough(front);
  attach('frontHub',ring(shaftRadius+.0015,hubRadius,.20,.28,128),'frame',PALETTE.muted);
  // The real grooved plate behind also shows from the back.
  // A stepped shank preserves the engraving's narrower rear groove. Its
  // shoulder lies entirely between the two plates; the hidden step is inferred.
  attach('boltNeck',disk(neckRadius,-.25,.02,96),'bolt',PALETTE.brass);
  attach('bolt',disk(boltRadius,.02,.40,96),'bolt',PALETTE.brass);
  attach('boltHead',ring(boltRadius+.001,source.boltHeadRadius/100,.27,.35,96),'bolt',PALETTE.driven);
  attach('boltWasher',ring(neckRadius+.001,.18,-.25,-.20,96),'bolt',PALETTE.driven);
  const supportProfile=clip.difference(clip.union(poly(circle([0,0],.35,128)),poly([[-2.2,-.07],[2.2,-.07],[2.2,.07],[-2.2,.07]])),poly(circle([0,0],shaftRadius+.003,128)));
  attach('shaftSupport',plate(supportProfile,-.65,-.45),'frame',PALETTE.muted);
  for(const [i,sign] of [-1,1].entries()) {
    attach('tab'+i,new THREE.BoxGeometry(.32,.16,.10),'frame',PALETTE.muted,[sign*2.09,0,.25]);
    attach('bracket'+i,new THREE.BoxGeometry(.1,.16,.7),'frame',PALETTE.muted,[sign*2.2,0,-.10]);
  }
  const selected=slots[source.selectedSlot],pinAngle=selected.angle,initialRadius=radius(pinAngle),direction=[Math.cos(pinAngle),Math.sin(pinAngle)];
  blocks.bolt.position.set(initialRadius*direction[0],initialRadius*direction[1],0);
  const wallThickness=.06,wallPieces=[];
  for(const sign of [-1,1])for(let i=0;i<segments;i++) {
    // Rounded terminal regions are outside the demonstrated adjustment range.
    // Keep collision strips on the actual long faces, clear of the end unions.
    if(angles[i]<2||angles[i+1]>13.2)continue;
    wallPieces.push([offsetAt(angles[i],sign*halfWidth),offsetAt(angles[i+1],sign*halfWidth),
      offsetAt(angles[i+1],sign*(halfWidth+wallThickness)),offsetAt(angles[i],sign*(halfWidth+wallThickness))]);
  }
  Object.assign(root.userData,{parts,families,blocks,source,hideGround:true,profiles:{inputProfile,frontProfile,groove,slotProfiles,inner,outer,tail,capCenter},
    radius,derivative,centerAt,normalAt,wallPieces,geometry:{boltRadius,neckRadius,clearance,halfWidth,shaftRadius,diskRadius,hubRadius,pinAngle,initialRadius,direction,slots,segments,wallThickness,wallSegmentCount:wallPieces.length/2}});
  markShadows(root);root.updateMatrixWorld(true);
  return {root,focus:new THREE.Vector3(0,0,0),cameraDirection:new THREE.Vector3(.8,.5,10)};
}
