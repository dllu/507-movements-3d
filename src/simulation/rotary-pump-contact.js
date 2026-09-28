import * as THREE from 'three';
import {capsule,circle,poly,plate,polygonClipping} from './finite-plate-geometry.js';
import {curvedPipeWall,mergePassageParts} from './finite-fluid-passages.js';
import {portedCasingGeometry,squarePortHole} from './round-port-pipes.js';

// Cary's pistons c, c are one rigid bar through the drum. Its two rollers
// bear on opposite sides of the fixed heart cam a, so the cam has constant
// width through the axle: r(t)+r(t+pi)=2*CARY_MEAN_RADIUS. A retracted dwell
// at E (bottom) therefore pairs with an extended dwell at the top; the
// chamber wall is the matching curve traced by the bar ends, so the chamber
// is eccentric about the drum as Brown draws it.
// Pass 73: the flanks are a heart cam's uniform rise (Archimedean spirals),
// entered and left through short cycloidal ramps so the bar's velocity stays
// continuous. The steep spirals meet the E dwell in Brown's heart notch and
// the top dwell in its rounded point, instead of an egg-shaped harmonic cam.
const CARY_DWELL=20*Math.PI/180,CARY_MEAN_RADIUS=.89,CARY_LIFT=.36,CARY_RAMP=.12;
export const CARY_ROLLER_RADIUS=.13;
// Normalised rise y(u) on [0,1]: cycloidal ramps of width f at both ends
// joined by a uniform-velocity middle; returns y, dy/du and d2y/du2.
function heartRise(u){
  const f=CARY_RAMP,v=1/(1-f),k=Math.PI/f;
  if(u<f)return {y:v/2*(u-Math.sin(k*u)/k),first:v/2*(1-Math.cos(k*u)),second:v/2*k*Math.sin(k*u)};
  if(u>1-f){const r=heartRise(1-u);return {y:1-r.y,first:r.first,second:-r.second};}
  return {y:v*f/2+v*(u-f),first:v,second:0};
}
export function caryFollowerLaw(angle) {
  const signed=THREE.MathUtils.euclideanModulo(angle+Math.PI/2+Math.PI,2*Math.PI)-Math.PI;
  const s=Math.abs(signed),sign=Math.sign(signed),span=Math.PI-2*CARY_DWELL;
  if(s<=CARY_DWELL)return {radius:CARY_MEAN_RADIUS-CARY_LIFT,first:0,second:0};
  if(s>=Math.PI-CARY_DWELL)return {radius:CARY_MEAN_RADIUS+CARY_LIFT,first:0,second:0};
  const rise=heartRise((s-CARY_DWELL)/span);
  return {
    radius:CARY_MEAN_RADIUS-CARY_LIFT+2*CARY_LIFT*rise.y,
    first:2*CARY_LIFT*rise.first/span*sign,
    second:2*CARY_LIFT*rise.second/span**2,
  };
}
// Chamber wall: the envelope of the bar-end sealing heads (half-width
// angle 0.09) plus a 0.003 running clearance.
export function caryWallRadius(angle,pistonLength){
  let radius=0;
  for(let i=-8;i<=8;i++)radius=Math.max(radius,caryFollowerLaw(angle+.09*i/8).radius+pistonLength);
  return radius+.003;
}

const replace=(mesh,geometry)=>{mesh.geometry.dispose();mesh.geometry=geometry;};

export function correctCaryPump(root) {
  const d=root.userData,b=d.blocks,g=d.geometry;
  const rollerRadius=CARY_ROLLER_RADIUS,outline=[];
  for(let i=0;i<2048;i++){
    const a=i*2*Math.PI/2048,{radius:r,first:rp}=caryFollowerLaw(a),c=Math.cos(a),s=Math.sin(a),length=Math.hypot(r,rp);
    outline.push([r*c-rollerRadius*(r*c+rp*s)/length,r*s-rollerRadius*(r*s-rp*c)/length]);
  }
  // The cam sits behind the bar's central bridge, which crosses in front of it.
  const camBack=-g.casingDepth*.38,camFront=.10;
  replace(b.fixedHeartCam,plate(polygonClipping.difference(poly(outline),poly(circle([0,0],.234,256))),camBack,camFront));
  const outlineLine=root.children.find(o=>o.userData.role==='fixed-heart-cam-contact-outline');
  // Pass 73: no ink outline is drawn round the cam (whole parts, not
  // engraving notation).
  root.remove(outlineLine);outlineLine.geometry.dispose();
  const slots=poly([[-1.8,-.14],[1.8,-.14],[1.8,.14],[-1.8,.14]]);
  replace(b.drumShell,plate(polygonClipping.difference(poly(circle([0,0],g.drumOuterRadius,512)),poly(circle([0,0],g.drumInnerRadius,512)),slots),-g.casingDepth*.415,g.casingDepth*.415));
  const spider=polygonClipping.union(poly(circle([0,0],.35,128)),poly([[-1.42,-.08],[1.42,-.08],[1.42,.08],[-1.42,.08]]),poly([[-.08,-1.42],[.08,-1.42],[.08,1.42],[-.08,1.42]]));
  const rearSpider=new THREE.Mesh(plate(spider,-.44,-.315),b.drumShell.material);rearSpider.userData.role='rear-spider-joining-drum-to-driving-axle';b.drum.add(rearSpider);b.rearSpider=rearSpider;
  for(const p of b.pistons){
    replace(p.blade,new THREE.BoxGeometry(g.pistonLength-.10,.17,g.casingDepth*.63));p.blade.position.x=-.05;
    // Rollers run in the cam's layer only.
    replace(p.follower,new THREE.CylinderGeometry(rollerRadius,rollerRadius,camFront-camBack-.02,64));p.follower.position.z=(camFront+camBack)/2;
    const edge=Array.from({length:33},(_,i)=>{const y=-.135+.27*i/32;return[Math.sqrt((g.casingInnerRadius-.0001)**2-y*y)-g.camMaximumRadius-g.pistonLength/2,y]});
    const shape=poly([...edge,...edge.map(([x,y])=>[x-.13,y]).reverse()]);
    replace(p.sealingHead,plate(shape,-g.casingDepth*.34,g.casingDepth*.34));p.sealingHead.position.x=0;
  }
  // Brown's single rigid bar c-c: a bridge in front of the cam joins the two
  // rollers, swelling round a slot that lets it slide past the axle.
  {
    const half=g.pistonLength/2,width=2*g.camMeanRadius,near=-half,far=-half-width;
    const slotNear=-(g.camMinimumRadius+half),slotFar=-(g.camMaximumRadius+half),slotHalf=.245;
    const body=polygonClipping.union(
      poly([[far,-.05],[near,-.05],[near,.05],[far,.05]]),
      capsule([slotFar,0],[slotNear,0],slotHalf+.09,96));
    const bridge=new THREE.Mesh(plate(polygonClipping.difference(body,capsule([slotFar,0],[slotNear,0],slotHalf,96)),.12,g.casingDepth*.38),b.pistons[0].blade.material);
    bridge.userData.role='rigid-bridge-joining-pistons-c-c-into-one-bar';
    b.pistons[0].piston.add(bridge);b.pistonBridge=bridge;
  }
  // Chamber wall traced by the bar ends; E is the thick lower wall between
  // ports L and M, with a packing block at its crown.
  const wall=[],outer=[];
  for(let i=0;i<720;i++){const a=i*2*Math.PI/720,r=caryWallRadius(a,g.pistonLength);wall.push([r*Math.cos(a),r*Math.sin(a)]);outer.push([(r+.30)*Math.cos(a),(r+.30)*Math.sin(a)]);}
  const outletAngle=-Math.PI/3,rot=([x,y])=>[x*Math.cos(outletAngle)-y*Math.sin(outletAngle),x*Math.sin(outletAngle)+y*Math.cos(outletAngle)];
  const packing=poly([...Array.from({length:17},(_,i)=>{const a=-Math.PI/2-.14+.28*i/16;return[1.575*Math.cos(a),1.575*Math.sin(a)];}),...Array.from({length:17},(_,i)=>{const a=-Math.PI/2+.14-.28*i/16;return[1.74*Math.cos(a),1.74*Math.sin(a)];})]);
  // Pass 57: the ports pierce only the wall's middle layer (square holes of
  // half-width 0.29 round the pipes' bores), so the wall stays whole in front
  // of and behind each round pipe and no open notch shows at the joints.
  const portHalf=.29,outletU=[Math.cos(outletAngle),Math.sin(outletAngle)];
  const holes=[squarePortHole(outletU,1.3,2.8,portHalf),poly([[-.85-portHalf,-3.2],[-.85+portHalf,-3.2],[-.85+portHalf,-1.0],[-.85-portHalf,-1.0]])];
  replace(b.casing,portedCasingGeometry(polygonClipping.difference(poly(outer),poly(wall),packing),-g.casingDepth/2,g.casingDepth/2,0,portHalf,holes));
  // Brown's section removes only the front head. The back head closes the
  // casing behind the drum's rear spider: a rim flush with the casing's rear
  // face, recessed round the spider, and a plate bored for axle A, which
  // runs on into a blind bearing boss.
  {
    const back=-g.casingDepth/2,envelope=poly(outer),material=[].concat(b.casing.material)[0];
    const parts=[
      ['fixed-back-head-rim-round-drum-spider',plate(polygonClipping.difference(envelope,poly(circle([0,0],1.50,256))),back-.07,back)],
      ['fixed-back-head-closing-casing',plate(polygonClipping.difference(envelope,poly(circle([0,0],.234,96))),back-.17,back-.07)],
      ['fixed-back-bearing-boss-for-axle-A',plate(polygonClipping.difference(poly(circle([0,0],.40,96)),poly(circle([0,0],.234,96))),-.74,back-.17)],
      ['fixed-back-bearing-boss-cap',plate(poly(circle([0,0],.40,96)),-.80,-.74)],
    ];
    b.backHead=parts.map(([role,geometry])=>{const mesh=new THREE.Mesh(geometry,material);mesh.userData.role=role;mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return mesh;});
  }
  replace(b.portSeparatorE,plate(polygonClipping.difference(packing,poly(wall)),-g.casingDepth*.45,g.casingDepth*.45));b.portSeparatorE.position.set(0,0,0);
  d.caryWallRadiusAtAngle=angle=>caryWallRadius(angle,g.pistonLength);
  // H leaves M through the wall's throat, turns and runs round the casing
  // hard against it (its 0.34 wall merges 0.02 into the casing's outer face,
  // like Brown's cast passage), then rises straight up the right side into
  // the goose-neck. Pass 93: it looped down in an S below the casing before.
  const hugAt=deg=>{const a=deg*Math.PI/180,r=caryWallRadius(a,g.pistonLength)+.30+.32;return new THREE.Vector3(r*Math.cos(a),r*Math.sin(a),0);};
  let side=0;for(let deg=-60;deg<=60;deg+=.5)side=Math.max(side,hugAt(deg).x);
  // Pass 96: from M the pipe leaves radially only as far as the casing's
  // outer face, turns right along the lower wall and joins the hugging run
  // at -34 degrees. Its underside now dips at most 0.13 below the casing's
  // bottom near M (forced: port M sits at -60 degrees and the pipe is 0.68
  // across); running radially out to r 2.35 it sagged 0.41 below it.
  const curve=new THREE.CatmullRomCurve3([
    new THREE.Vector3(...rot([1.72,0]),0),
    new THREE.Vector3(.95,-1.645,0),
    new THREE.Vector3(1.45,-1.62,0),
    ...[-34,-24,-14,-5].map(hugAt),
    new THREE.Vector3(side,.35,0),new THREE.Vector3(side,1.55,0),
    new THREE.Vector3(side+.22,2.38,0),new THREE.Vector3(side+.80,2.38,0),new THREE.Vector3(side+1.0,1.55,0),
  ],false,'centripetal');
  replace(b.dischargeH.shell,curvedPipeWall(curve,.29,.34,128));
  b.dischargeH.shell.userData.curve=curve;
  replace(b.dischargeH.water,new THREE.TubeGeometry(curve,128,.21,12,false));
  // F rises straight into L beside E.
  b.inletF.position.set(-.13,.75,0);
  const inletShell=b.inletF.children[0];
  const walls=[new THREE.BoxGeometry(.1,1.58,.8268),new THREE.BoxGeometry(.1,1.58,.8268),new THREE.BoxGeometry(.66,1.58,.06),new THREE.BoxGeometry(.66,1.58,.06)];
  walls[0].translate(-.38,0,0);walls[1].translate(.38,0,0);walls[2].translate(0,0,-.3834);walls[3].translate(0,0,.3834);
  replace(inletShell,mergePassageParts(walls));inletShell.position.y=-3.0;
  replace(b.frontCover,plate(polygonClipping.difference(poly(circle([0,0],g.casingInnerRadius,512)),poly(circle([0,0],.234,128))),-.006,.006));
  d.solidReview={qualification:'One rigid piston bar c-c whose rollers bear on opposite sides of a constant-width heart cam; the eccentric chamber wall is the envelope of its ends. Radial drum slots, a bridge slot past the axle, the rear drive spider and open casing ports are finite. The 20-degree dwells and harmonic flanks are reconstructed; cam contact is kinematic, with no solved pressure, return load or hydraulic torque.'};
  finish(root);
}

function finish(root){const d=root.userData;d.hideGround=true;d.minimumDisplayCycleSeconds=d.geometry.cycleDuration;root.traverse(o=>{for(const m of o.material?[].concat(o.material):[])m.fog=false;});}
