import * as THREE from 'three';
import {PALETTE,matte,markShadows} from './primitives.js';
import {add,sub,rotate,poly,circle,plate,disk,ring,polygonClipping as clip,familyMass} from './finite-plate-geometry.js';

// Manual source contours are in the original 1270 x 1300 Brown crop.
// Curves preserve visible boundaries; covered boundaries are inferred.
export function sourceContour(commands,transform=p=>p,divisions=18){
 const shape=new THREE.Shape();
 for(const [op,...v]of commands){
  const p=[];for(let i=0;i<v.length;i+=2)p.push(...transform(v.slice(i,i+2)));
  if(op==='M')shape.moveTo(...p);else if(op==='L')shape.lineTo(...p);
  else if(op==='Q')shape.quadraticCurveTo(...p);else if(op==='C')shape.bezierCurveTo(...p);
  else throw Error('Unknown contour command '+op);
 }
 return shape.getPoints(divisions).map(v=>v.toArray());
}

// A round end that is a true arc concentric with its pin: straight edges run
// from the given far points tangent to a circle of radius r (pixels) about the
// pin, joined by the arc on the side away from the far points. Returned as
// source-pixel 'L' commands from the first tangent point to the second.
export function concentricEnd(far1,far2,c,r,n=96){
 const tangent=(P,other)=>{
  const d=Math.hypot(P[0]-c[0],P[1]-c[1]),base=Math.atan2(P[1]-c[1],P[0]-c[0]),alpha=Math.acos(r/d),
   options=[base+alpha,base-alpha];
  // The tangent point on the far side from the other edge.
  return options.map(a=>[a,Math.hypot(c[0]+r*Math.cos(a)-other[0],c[1]+r*Math.sin(a)-other[1])]).sort((x,y)=>y[1]-x[1])[0][0];
 };
 const a1=tangent(far1,far2),a2=tangent(far2,far1),mid=[(far1[0]+far2[0])/2,(far1[1]+far2[1])/2],
  sweep=d=>{let b=a2;while((b-a1)*d<0)b+=2*Math.PI*d;return b;},
  arcs=[1,-1].map(d=>{const b=sweep(d),m=(a1+b)/2;return[b,Math.hypot(c[0]+r*Math.cos(m)-mid[0],c[1]+r*Math.sin(m)-mid[1])];}),
  b=arcs[0][1]>arcs[1][1]?arcs[0][0]:arcs[1][0],out=[];
 for(let i=0;i<=n;i++){const a=a1+(b-a1)*i/n;out.push(['L',c[0]+r*Math.cos(a),c[1]+r*Math.sin(a)]);}
 return out;
}

export function makePullPawlGeometry({phase=1.115052755202599,rootRadius=.872,rootAngle=-.045,leftRearRelief=true,leftRearLimit=304,leftRearTop=553}={}){
 const center=[590.1847816329412,748.5887383490219],scale=379.2944180983833,
  source=p=>[(p[0]-center[0])/scale,(center[1]-p[1])/scale],
  A=source([598.0604838709677,272.83266129032256]),
  pivotPx={left:[431.5703125,259.177734375],right:[765.4758364312268,269.70260223048325]},
  pivots={left:source(pivotPx.left),right:source(pivotPx.right)},
  hooks={left:source([316,553]),right:source([478,401])},
  arms=Object.fromEntries(Object.entries(pivots).map(([k,p])=>[k,sub(p,A)])),
  lengths=Object.fromEntries(Object.entries(hooks).map(([k,p])=>[k,Math.hypot(...sub(p,pivots[k]))])),
  initialAngles=Object.fromEntries(Object.entries(hooks).map(([k,p])=>{const d=sub(p,pivots[k]);return[k,Math.atan2(-d[1],-d[0])];})),
  p={center,scale,A,pivots,hooks,arms,lengths,initialAngles,teeth:26,pitch:2*Math.PI/26,phase,outerRadius:1,rootRadius,rootAngle,leftRearRelief,leftRearLimit,leftRearTop,innerRadius:315.5246053439235/scale},
  root=new THREE.Group(),parts={},families={},blocks={},profiles={};
 for(const family of ['wheel','lever','left','right','fixed']){blocks[family]=new THREE.Group();root.add(blocks[family]);}
 blocks.lever.position.set(...A,0);
 const attach=(name,geometry,family,color,position=[0,0,0])=>{
  const mesh=new THREE.Mesh(geometry,matte(color,{metalness:.16,roughness:.61}));mesh.name=name;mesh.position.fromArray(position);
  blocks[family].add(mesh);parts[name]=mesh;families[name]=family;return mesh;
 };
 const outline=[];
 for(let i=0;i<26;i++){
  const a=phase+i*p.pitch,tip=rotate([1,0],a),valley=rotate([rootRadius,0],a+rootAngle),
   next=rotate([1,0],a+p.pitch),c1=rotate([rootRadius+.041,0],a+rootAngle+(p.pitch-rootAngle)/3),
   c2=rotate([.959,0],a+rootAngle+2*(p.pitch-rootAngle)/3);
  outline.push(tip,valley);
  for(let j=1;j<24;j++){const t=j/24,u=1-t;outline.push([0,1].map(k=>u**3*valley[k]+3*u*u*t*c1[k]+3*u*t*t*c2[k]+t**3*next[k]));}
 }
 const hole=[],half=.031,inner=.205,a=Math.asin(half/p.innerRadius),b=Math.PI/3-a;
 // Each opening has broad curved roots at the hub and a small flare into the rim.
 hole.push(rotate([p.innerRadius,0],a+.045));
 for(let i=1;i<=96;i++)hole.push(rotate([p.innerRadius,0],a+.045+(b-a-.09)*i/96));
 const end=rotate([p.innerRadius-.08,-half],Math.PI/3),near=rotate([inner,-.065],Math.PI/3),
  outerLast=hole.at(-1),outerControl=rotate([p.innerRadius-.035,-half],Math.PI/3);
 for(let j=1;j<=16;j++){const t=j/16,u=1-t;hole.push([0,1].map(k=>u*u*outerLast[k]+2*u*t*outerControl[k]+t*t*end[k]));}
 hole.push(near);
 const bottom=[inner,.065];
 for(let j=1;j<=32;j++){const t=j/32,u=1-t;hole.push([0,1].map(k=>u*u*near[k]+2*u*t*[.16,.092][k]+t*t*bottom[k]));}
 hole.push([p.innerRadius-.08,half]);
 const start=hole.at(-1),first=hole[0],control=[p.innerRadius-.035,half];
 for(let j=1;j<=16;j++){const t=j/16,u=1-t;hole.push([0,1].map(k=>u*u*start[k]+2*u*t*control[k]+t*t*first[k]));}
 const holes=Array.from({length:6},(_,i)=>poly(hole.map(v=>rotate(v,i*Math.PI/3)))),
  wheelShape=clip.difference(poly(outline),poly(circle([0,0],.036)),...holes);
 const wheel=attach('wheelBody',plate(wheelShape,-.055,.055),'wheel',PALETTE.driven);
 profiles.wheel=wheel.geometry.parameters.shapes[0].getPoints().map(v=>v.toArray());
 attach('wheelRearHub',ring(.036,.21,-.095,-.055),'wheel',PALETTE.driven);
 attach('wheelFrontHub',ring(.036,.21,.055,.080),'wheel',PALETTE.driven);
 attach('wheelAxle',disk(.033,-.18,.355),'fixed',PALETTE.muted);
 attach('wheelAxleRearCap',disk(.049,-.20,-.18),'fixed',PALETTE.muted);
 attach('wheelAxleFrontCap',disk(.055,.355,.375),'fixed',PALETTE.muted);

 // The apex is a true arc concentric with the rocker axle A (radius 36 px,
 // the right leg's own distance from A), both legs straight tangents from
 // their feet; the traced apex was centred 0.02 above A.
 const Apx=[598.0604838709677,272.83266129032256],
  frameOuter=[['M',310,1146],['Q',322,1125,327,1096],...concentricEnd([327,1096],[816,1000],Apx,36),['L',816,1000],['Q',846,1123,861,1146],['L',880,1150],['L',884,1170],
  ['L',728,1170],['L',728,1151],['Q',781,1154,765,1084],['L',705,826],['Q',699,782,650,779],
  ['L',523,780],['Q',481,782,469,821],['L',394,1105],['Q',383,1131,402,1148],['L',421,1151],
  ['L',427,1170],['L',269,1170],['L',270,1153],['L',310,1146]],
  frameOpening=[['M',510,707],['Q',502,703,508,683],['L',576,433],['Q',588,391,601,389],
   ['Q',614,389,619,427],['L',670,672],['Q',680,700,659,706],['Q',590,716,510,707]],
  frameShape=clip.difference(poly(sourceContour(frameOuter,source)),poly(sourceContour(frameOpening,source)),
   poly(circle([0,0],.036)),poly(circle(A,.036)));
 attach('frameA',plate(frameShape,.215,.315),'fixed',PALETTE.muted);
 attach('frameWheelBoss',ring(.036,.10,.315,.35),'fixed',PALETTE.muted);
 attach('framePivotBoss',ring(.036,.09,.315,.34),'fixed',PALETTE.muted,[...A,0]);
 attach('rockerAxle',disk(.033,.18,.46),'fixed',PALETTE.muted,[...A,0]);
 attach('rockerAxleCap',disk(.051,.46,.48),'fixed',PALETTE.muted,[...A,0]);

 // p101: lever B is one extrusion of circles joined by tangent lines: the
 // left end is an arc concentric with the left pawl pin (36 px), the right
 // pin's eye a circle concentric with it (42 px), and the hand lever runs on
 // as a straight taper from that eye to a round end (24.5 px, Brown's bar
 // width there), with no neck or bulb; Brown's swallowtail break notch is
 // drawing notation, so the lever ends whole.
 const hull=points=>{
  const sorted=[...points].sort((a,b)=>a[0]-b[0]||a[1]-b[1]),turn=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
  const chain=list=>{const out=[];for(const q of list){while(out.length>1&&turn(out.at(-2),out.at(-1),q)<=0)out.pop();out.push(q);}out.pop();return out;};
  return[...chain(sorted),...chain([...sorted].reverse())];
 };
 const leverLocal=v=>sub(source(v),A),eye=(pixel,r)=>circle(leverLocal(pixel),r/scale,256),
  leftEye=eye(pivotPx.left,36),rightEye=eye(pivotPx.right,42),handleEnd=eye([1222,285],24.5),
  leverShape=clip.difference(clip.union(poly(hull([...leftEye,...rightEye])),poly(hull([...rightEye,...handleEnd]))),
   poly(circle([0,0],.036)),...Object.values(arms).map(v=>poly(circle(v,.037))));
 attach('rockerB',plate(leverShape,.355,.435),'lever',PALETTE.driver);
 attach('rockerPivotBoss',ring(.036,.115,.435,.455),'lever',PALETTE.driver);
 // p101: each pawl pin carries a lever-coloured distance collar from the
 // lever's back face to the pawl eye, so no bare pin shows between them. The
 // collars turn with the prescribed lever (no change to the pawls' masses).
 for(const [key,r] of [['left',24],['right',28]])
  attach(key+'PivotCollar',ring(.037,r/scale,.166,.355),'lever',PALETTE.driver,[...arms[key],0]);
 const contours={
  // Each pawl's eye is a true arc concentric with its pin (radius 24 and
  // 28 px), the bar edges running straight and tangent into it from the
  // traced hook; the traced eyes were egg-shaped and off the pin.
  left:[['M',244,523],['Q',232,543,241,552],['Q',249,566,275,560],['L',322,556],
   ['Q',326,550,313,548],['Q',290,544,278,536],['Q',272,533,280,522],...concentricEnd([280,522],[244,523],pivotPx.left,24),['L',244,523]],
  right:[['M',456,380],['Q',430,391,439,401],['Q',450,412,478,406],['L',479,392],
   ...concentricEnd([479,392],[456,380],pivotPx.right,28),['L',456,380]]},
  toes={left:[['M',244,523],['Q',232,543,241,552],['Q',249,566,275,560],['L',322,556],
   ['Q',326,550,313,548],['Q',290,544,278,536],['Q',272,533,280,522],['L',244,523]],
   right:[['M',456,380],['Q',430,391,439,401],['Q',450,412,478,406],['L',479,392],['L',484,390],['L',477,370],['L',456,380]]};
 for(const key of ['left','right']){
  const local=v=>rotate(sub(source(v),pivots[key]),-initialAngles[key]),
   body=clip.difference(poly(sourceContour(contours[key],local)),poly(circle([0,0],.037))),
   fullToe=poly(sourceContour(toes[key],local)),
   toe=key==='left'&&leftRearRelief?clip.intersection(fullToe,poly([[180,518],[leftRearLimit,leftRearTop],[leftRearLimit,600],[180,600]].map(local))):fullToe;
  attach(key+'Pawl',plate(body,.10,.165),key,PALETTE.brass);
  const mesh=attach(key+'Hook',plate(toe,-.030,.10),key,PALETTE.brass);
  profiles[key]=mesh.geometry.parameters.shapes[0].getPoints().map(v=>v.toArray());
  attach(key+'PivotPin',disk(.034,.075,.435),'lever',PALETTE.muted,[...arms[key],0]);
  attach(key+'PivotBackCap',disk(.052,.055,.075),'lever',PALETTE.muted,[...arms[key],0]);
  attach(key+'PivotFrontCap',disk(.052,.435,.455),'lever',PALETTE.muted,[...arms[key],0]);
 }
 const anchorAt=(key,q)=>add(A,rotate(arms[key],q));
 const setState=({q=0,theta=0,leftAngle=initialAngles.left,rightAngle=initialAngles.right}={})=>{
  blocks.lever.rotation.z=q;blocks.wheel.rotation.z=theta;
  for(const key of ['left','right']){blocks[key].position.set(...anchorAt(key,q),0);blocks[key].rotation.z=key==='left'?leftAngle:rightAngle;}
  root.userData.kinematics={q,theta,leftAngle,rightAngle};root.updateMatrixWorld(true);
 };
 const masses=Object.fromEntries(['wheel','lever','left','right'].map(family=>[family,familyMass(parts,families,family)]));
 root.userData={parts,families,blocks,geometry:p,profiles,masses,source,anchorAt,setState,hideGround:true,cameraFov:8,
  fullCameraDirection:new THREE.Vector3(0,0,10),shadowCameraHalfExtent:2.5,shadowBias:-.00003,shadowNormalBias:.005,
  mechanism:'alternating-pull-pawl-ratchet-drive',fidelity:'authored'};
 setState();markShadows(root);return{root,setState,update:()=>{},cameraDirection:new THREE.Vector3(0,0,10)};
}
