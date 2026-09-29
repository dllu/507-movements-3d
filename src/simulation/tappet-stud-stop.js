// Source-fitted ten-stud index with a finite rounded tappet and a bored stop.
import * as THREE from 'three';
import { PALETTE, matte, markShadows } from './primitives.js';
import { turnedClutchGeometry } from './clutch-section-geometry.js';
import { polygonClipping as clip } from './finite-plate-geometry.js';
import bakedStopOutline from '../data/tappet-stud-stop-outline.js';
import { makeTappetStudStopContact, TAU, add, sub, scale, norm, rotate, polar, closestSegment } from './tappet-stud-stop-contact.js';

function simplify(points, tolerance=2e-7) {
  if(points.length<3)return points;
  let maximum=0,index=0;
  for(let i=1;i+1<points.length;i++){
    const distance=closestSegment(points[i],points[0],points.at(-1)).distance;
    if(distance>maximum){maximum=distance;index=i;}
  }
  if(maximum<=tolerance)return [points[0],points.at(-1)];
  return [...simplify(points.slice(0,index+1),tolerance).slice(0,-1),...simplify(points.slice(index),tolerance)];
}

export function makeTappetStudStop({computeStopOutline=false,...options}={}) {
  // p101: the stop's toe is rounded (radius 0.04) and C's notch is one clean V
  // (two straight flanks and a root arc; see tappet-stud-stop-contact.js).
  const motion=makeTappetStudStopContact({toeRadius:.04,leftExtension:.05,rightExtension:-.03,...options});
  const stopTheta=gamma=>motion.stopAtGamma(gamma).theta;
  const {p}=motion, root=new THREE.Group(), input=new THREE.Group(), output=new THREE.Group(), stop=new THREE.Group();
  root.add(input,output,stop);output.position.x=p.D;stop.position.set(...p.pivot,0);
  const parts={},families={},paths={};
  const attach=(name,geometry,color,parent,family)=>{
    const mesh=new THREE.Mesh(geometry,matte(color,{metalness:.15,roughness:.64}));
    mesh.name=name;parts[name]=mesh;families[name]=family;parent.add(mesh);return mesh;
  };
  const extrusion=(shape,lo,hi,segments=96)=>{
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:hi-lo,bevelEnabled:false,curveSegments:segments});
    geometry.translate(0,0,lo);return geometry;
  };
  const drum=(radius,bore,lo,hi,segments=512)=>turnedClutchGeometry([[lo,bore],[lo,radius],[hi,radius],[hi,bore]],{angularSegments:segments});
  const polygon=points=>{const s=new THREE.Shape(points.map(q=>new THREE.Vector2(...q)));s.closePath();return s;};
  paths.cam=p.cam;
  // C's plain disk is deep enough to reach the stop's plane, so the stop is
  // one flat plate whose own corner rides C's rim and drops into the notch.
  const driverDiskDepth=[-.10,.31];p.driverDiskDepth=driverDiskDepth;
  attach('driverDisk',extrusion(polygon(paths.cam),...driverDiskDepth),PALETTE.driver,input,'input');
  attach('driverHub',drum(.26,0,-.15,.475),PALETTE.driver,input,'input');
  attach('driverShaft',drum(.17,0,-.35,.49),PALETTE.ink,input,'input');
  attach('drivenDisk',drum(1.26,0,-.10,.10),PALETTE.driven,output,'output');
  attach('drivenHub',drum(.26,0,-.15,.475),PALETTE.driven,output,'output');
  attach('drivenShaft',drum(.17,0,-.35,.49),PALETTE.ink,output,'output');
  for(let i=0;i<10;i++){
    const mesh=attach('stud'+i,drum(p.pinRadius,0,.085,.48,2048),PALETTE.ink,output,'output');
    mesh.position.set(...polar(p.R,p.betaStart+i*p.pitch),0);
  }
  // Tappet A is a tapered bar between two true arcs: its rounded tip and a
  // root end concentric with C's shaft (radius h, so the flat underside is
  // tangent to both). The root lies inside C's hub.
  const rootRadius=p.h,tipDistance=norm(p.tipCenter),
    tangentAngle=Math.atan2(p.tipCenter[1],p.tipCenter[0])+Math.acos((rootRadius-p.tipRadius)/tipDistance);
  const tappet=new THREE.Shape();tappet.moveTo(0,-p.h);tappet.lineTo(p.tipCenter[0],-p.h);
  tappet.absarc(...p.tipCenter,p.tipRadius,-Math.PI/2,tangentAngle,false);
  tappet.absarc(0,0,rootRadius,tangentAngle,1.5*Math.PI,false);tappet.closePath();
  paths.tappet=tappet.getPoints(512).map(q=>q.toArray());
  // Tappet A lies on C's (deepened) front face, in front of the stop and
  // clear of the end of the stop's fixed pin.
  attach('tappet',extrusion(tappet,.31,.42,512),PALETTE.accent,input,'input');
  const localPixel=(x,y)=>sub([(x-352)/260,(415-y)/260],p.pivot);
  // Brown's toe point, just inside the rounded toe (whose arc touches C's
  // rim at rest, centred toeRadius outside it).
  const toeTip=sub(polar(p.driverRadius+.01,p.toeAngle),p.pivot);
  const outline=new THREE.Shape();outline.moveTo(...toeTip);
  const quadratic=(cx,cy,x,y)=>outline.quadraticCurveTo(...localPixel(cx,cy),...localPixel(x,y));
  const line=(x,y)=>outline.lineTo(...localPixel(x,y));
  // The boss hump over the pin is the circle unioned in trimStop.
  const pivotBossRadius=.26;p.pivotBossRadius=pivotBossRadius;
  quadratic(512,782,615,736);line(745,706);
  quadratic(805,735,844,725);outline.lineTo(...p.tooth[0]);outline.lineTo(...p.tooth[1]);outline.lineTo(...p.tooth[2]);
  quadratic(1000,713,948,746);quadratic(832,793,763,814);quadratic(710,820,671,817);
  quadratic(550,857,440,835);line(390,822);outline.closePath();
  // The stop is a single flat plate in the studs' plane. Its toe is part of
  // the same outline: the toe point rides C's rim and drops into C's notch,
  // and the plate is trimmed wherever C (deepened to this plane) sweeps
  // through it during the index, so only the toe point meets C.
  // The toe: a round end of radius toeRadius joined by tangent lines to
  // Brown's toe base (the convex hull of the arc and the base points).
  paths.toe=[...Array.from({length:384},(_,i)=>add(p.toeCenter,polar(p.toeRadius,TAU*i/384))),add(toeTip,[.12,-.25]),add(toeTip,[-.08,-.34])];
  {const pts=[...paths.toe].sort((a,b)=>a[0]-b[0]||a[1]-b[1]),turn=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
   const half=list=>{const out=[];for(const q of list){while(out.length>=2&&turn(out.at(-2),out.at(-1),q)<=0)out.pop();out.push(q);}out.pop();return out;};
   paths.toe=[...half(pts),...half([...pts].reverse())];}
  // The trimmed outline is computed offline (the swept clip is slow) by
  // scripts/generate-tappet-stud-stop-outline.mjs; the 065 tests recompute it.
  const trimStop=(poses=480)=>{
    const ring=points=>{const r=points.map(q=>[q[0],q[1]]);r.push(r[0]);return r;};
    // The pivot end is a true circle concentric with the fixed pin (the
    // traced hump centred 0.035 up-left of it).
    const drawn=clip.union([ring(outline.getPoints(96).map(q=>q.toArray()))],[ring(paths.toe)],
      [ring(Array.from({length:512},(_,i)=>polar(pivotBossRadius,TAU*i/512)))]);
    const toStop=(q,gamma,theta)=>rotate(sub(rotate(q,gamma),p.pivot),-theta);
    const near=q=>norm(sub(q,p.toeCenter))<.45;
    const stopRelief=.006,toePocket=[ring(Array.from({length:96},(_,i)=>add(p.toeCenter,polar(p.toeRadius+.03,TAU*i/96))))];
    const rimArc=Array.from({length:2048},(_,i)=>sub(polar(p.driverRadius,TAU*i/2048),p.pivot)).filter(near);
    let trimmed=clip.difference(drawn,[ring([...rimArc,sub([0,0],p.pivot)])]);
    for(let i=0;i<=poses;i++){
      const gamma=p.gammaStart+(p.gammaEnd-.03-p.gammaStart)*i/poses,theta=stopTheta(gamma);
      // Away from the toe point the trimmed edge keeps a running clearance.
      const keep=(q,k)=>{const d=norm(sub(toStop(q,gamma,theta),p.toeCenter));return norm(q)<p.driverRadius-1e-9||d<.05||(d<.25&&k%8===0)||k%128===0;};
      const exact=paths.cam.filter(keep).map(q=>toStop(q,gamma,theta));
      const relieved=paths.cam.filter(keep).map(q=>toStop(scale(q,1+stopRelief/norm(q)),gamma,theta));
      trimmed=clip.difference(trimmed,[ring(exact)],clip.difference([ring(relieved)],toePocket));
    }
    trimmed=trimmed.sort((a,b)=>b[0].length-a[0].length)[0][0];
    const points=[];
    for(const q of trimmed.slice(0,-1)){
      const last=points.at(-1);
      if(!last||norm(sub(q,last))>2e-4||norm(sub(q,p.toeCenter))<1e-9)points.push(q);
      else if(norm(sub(last,p.toeCenter))>1e-9&&norm(sub(q,p.toeCenter))<norm(sub(last,p.toeCenter)))points[points.length-1]=q;
    }
    return points;
  };
  paths.stop=computeStopOutline||!bakedStopOutline.points?trimStop():bakedStopOutline.points;
  const stopShape=new THREE.Shape(paths.stop.map(q=>new THREE.Vector2(...q)));
  const bore=new THREE.Path();bore.absarc(0,0,.174,0,TAU,false);stopShape.holes.push(bore);
  attach('stopBody',extrusion(stopShape,.145,.265,96),PALETTE.accent,stop,'stop');
  const pivot=attach('fixedPivot',drum(.17,0,-.18,.30),PALETTE.ink,root,'fixed');pivot.position.set(...p.pivot,0);
  for(const [name,lo,hi] of [['rearPivotHead',.115,.135],['frontPivotHead',.275,.295]]){
    const head=attach(name,drum(.23,.17,lo,hi),PALETTE.ink,root,'fixed');head.position.set(...p.pivot,0);
  }
  p.inputSpeed=.65;p.period=TAU/p.inputSpeed;p.sourceGamma=16.15*Math.PI/180;
  const stateAtTime=time=>{
    const travel=p.gammaStart-p.sourceGamma+p.inputSpeed*time,cycle=Math.floor(travel/TAU),phase=travel-cycle*TAU;
    const gamma=p.gammaStart-phase,s=motion.motion(gamma), q=motion.stopAtGamma(gamma);
    return {...s,cycle,phase,gamma,driverAngle:p.sourceGamma-p.inputSpeed*time,
      outputAngle:cycle*p.pitch+s.beta-p.betaStart,stopAngle:q.theta,stop:q,
      stage:gamma>p.gammaEnd?'index-'+s.stage:'locked-dwell'};
  };
  root.userData={reconstructionStatus:'rebuilt',fidelity:'authored',hideGround:true,cameraFov:9,
    mechanism:'single-tappet-ten-stud-index-with-alternating-notch-stop',
    fullCameraDirection:new THREE.Vector3(-5,3,10),shadowCameraHalfExtent:4.7,shadowBias:-.00012,shadowNormalBias:.005,
    blocks:{input,output,stop},parts,families,geometry:p,paths,stateAtTime,
    animationTiming:{authoredCyclePeriod:p.period},minimumDisplayCycleSeconds:5,
    idealConstraints:'The shafts have ideal grounded bearings. Rigid contact prescribes the index and locking; initial strike impulses, compliance and loaded inertia are not simulated.'};
  markShadows(root);
  // Brown draws D's studs end-on as small round holes. Their long depth
  // otherwise throws oblique shadow streaks across D in the face-on view.
  for(let i=0;i<10;i++)parts['stud'+i].castShadow=false;
  const update=time=>{const state=stateAtTime(time);input.rotation.z=state.driverAngle;output.rotation.z=state.outputAngle;stop.rotation.z=state.stopAngle;root.userData.kinematics=state;};
  update(0);return {root,update,motion,cameraDirection:new THREE.Vector3(0,0,10)};
}
