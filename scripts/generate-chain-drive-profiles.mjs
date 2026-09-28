// Deterministic planar sweep of the production rigid-link path. No browser work.
// 227 is not swept: its clean analytic profile (cleanSprocketProfile227 in
// chain-drive-working-parts.js) is verified clear of the same link sweep in tests.
import fs from 'node:fs';
import {createAuthoredBeltMovement as create} from '../src/simulation/authored-belts.js';
import {ringArea,trimOutwardCusps} from '../src/simulation/outline-cusps.js';
import {poly,circle,capsule,rotate,polygonClipping as clip} from '../src/simulation/finite-plate-geometry.js';
const result={},clearance=.0008,samples=129;
// Ramer-Douglas-Peucker on two halves of a closed ring; a 0.00002 model-unit
// tolerance is small relative to the 0.0008 construction clearance.
function simplify(ring){
 const p=ring.slice(0,-1),half=Math.floor(p.length/2);
 function reduce(points){if(points.length<3)return points;const a=points[0],b=points.at(-1),dx=b[0]-a[0],dy=b[1]-a[1],len=dx*dx+dy*dy;let far=0,index=0;
 for(let i=1;i<points.length-1;i++){const q=points[i],t=Math.max(0,Math.min(1,((q[0]-a[0])*dx+(q[1]-a[1])*dy)/len)),distance=Math.hypot(q[0]-a[0]-t*dx,q[1]-a[1]-t*dy);if(distance>far){far=distance;index=i;}}
 return far>.00002?[...reduce(points.slice(0,index+1)).slice(0,-1),...reduce(points.slice(index))]:[a,b];}
 return [...reduce(p.slice(0,half+1)).slice(0,-1),...reduce([...p.slice(half),p[0]])];
}
const transform=(shape,a,t=[0,0])=>shape.map(p=>p.map(r=>r.map(v=>{const q=rotate(v,a);return q.map((x,i)=>Math.round((x+t[i])*1e9)/1e9);}))); 
for(const id of [228,229]){
 const model=create({id}),d=model.root.userData,g=d.geometry,b=d.blocks,period=id===227?g.toothStep:g.chainNodeStep,half=period/2,
  center=id===229?0:g.toothCenterPhase,overlap=id===229?1e-6:0,wedge=poly([[0,0],rotate([5,0],center-half-overlap),rotate([5,0],center+half+overlap)]);
 // 229: Brown's wheel is a polygon with a straight flat under each plate
 // link and a notch for each link tooth. Sweep a regular 14-gon whose flats
 // lie 0.001 inside the plates' lower edges, with corners at the joints.
 const flatGon=()=>{const apothem=g.pitchRadius*Math.cos(g.chainNodeStep/2)-g.linkHalfHeight-.001,corner=apothem/Math.cos(g.chainNodeStep/2);
  return poly(Array.from({length:g.wheelPitchCount},(_,i)=>rotate([corner,0],g.leftTangentAngle+i*g.chainNodeStep)));};
 let shape=id===228?clip.intersection(poly(circle([0,0],g.toothTipRadius,384)),wedge):clip.intersection(id===229?flatGon():[d.chainDriveParts.originalWheelPolygons],wedge);
 let localCut;
 if(id===227){
  // Flat plate links: solid round-ended bars (their eyes are filled by the
  // neighbouring loops' end bars). Edge-on loops: only the end bars, whose
  // centreline stays within an arc apex at each joint, cross the wheel slab.
  const e=g.plateLinkEndRadius+clearance,w=g.linkLoopHalfWidth,r=g.linkWireRadius+clearance,h=g.sprocketDepth/2+clearance+r;
  const flat=capsule([0,0],[g.linkPitch,0],e,48);
  const reach=w-Math.sqrt(Math.max(0,w*w-h*h));
  const perpendicular=clip.union(capsule([0,0],[reach,0],r,24),capsule([g.linkPitch-reach,0],[g.linkPitch,0],r,24));
  localCut={flat,perpendicular};
 }else if(id===229){
  const outline=b.plates[0].geometry.parameters.shapes.extractPoints(32).shape.map(p=>p.toArray());
  localCut=clip.union(...Array.from({length:12},(_,i)=>transform(poly(outline),0,rotate([clearance,0],i*Math.PI/6))));
 }
 for(let pose=0;pose<samples;pose++){
  const input=period*pose/(samples-1),s=d.stateAtInputAngle(input);
  const cut=(world,orientation,cutter)=>{
   const p=rotate([world.x-g.wheelCenter.x,world.y-g.wheelCenter.y],-s.sprocketAngle),a=orientation-s.sprocketAngle;
   const theta=Math.atan2(p[1],p[0]),fold=Math.round((center-theta)/period)*period;
   for(const delta of[-period,0,period]){
    const angle=fold+delta,placed=transform(cutter,a+angle,rotate(p,angle));shape=transform(clip.difference(shape,placed),0);
   }
  };
  if(id===228){for(const node of s.nodes){if(node.position.distanceTo(g.wheelCenter)<g.toothTipRadius+.2)cut(node.position,0,poly(circle([0,0],g.rungRadius+clearance,64)));}}
  else for(const link of s.chainLinks){if(link.center.distanceTo(g.wheelCenter)>3)continue;cut(link.start.position,link.angle,id===227?localCut[Math.abs(link.materialIndex%2)===1?'perpendicular':'flat']:localCut);}
 }
 if(id===228){shape=clip.difference(shape,poly(circle([0,0],g.toothRootRadius,192)));shape=transform(shape,-center);}
 else {
  shape=clip.union(...Array.from({length:Math.round(2*Math.PI/period)},(_,i)=>transform(shape,i*period)));
  shape=clip.difference(shape,poly(circle([0,0],g.shaftHoleRadius,96)));
 }
 shape=shape.map(p=>p.map(simplify));
 // 229: each sampled link pose leaves its own hollow on the tips, and the
 // hollows meet in outward cusps 0.0004 apart (a zigzag outline). Cutting
 // them off only removes material, so the swept clearance still holds.
 if(id===229)shape=shape.map(p=>p.map((ring,k)=>k?ring:(r=>[...r,r[0]])(trimOutwardCusps(ring.slice(0,-1),{material:Math.sign(ringArea(ring.slice(0,-1))),maxSegment:.01}))));
 result[id]=shape.map(p=>p.map(r=>r.map(p=>p.map(v=>+v.toFixed(8)))));
 console.log(id,shape.length,shape.map(p=>p.map(r=>r.length)));
}
const out=process.argv[2]??'src/simulation/chain-drive-profiles.js';
fs.writeFileSync(out,`// Generated by scripts/generate-chain-drive-profiles.mjs; ${samples} poses/pitch, clearance ${clearance}.\nexport default ${JSON.stringify(result)};\n`);
