import * as THREE from 'three';
import source from './weighted-clutch-source.mjs';
import {makeWeightedClutchLinkage,toWeightedClutchWorld as world} from './weighted-clutch-linkage.mjs';
import {bevelToothGeometry} from '../../src/simulation/bevel-geometry.js';
import {jawClutchGeometry} from '../../src/simulation/jaw-clutch-geometry.js';
import {poly,circle,capsule,sector,plate,disk,ring,turned,polygonClipping as clip} from '../../src/simulation/finite-plate-geometry.js';
import {conformingPlateMesh} from '../../src/simulation/conforming-plate-mesh.js';
import {PALETTE,matte,markShadows} from '../../src/simulation/primitives.js';
export {THREE};

const px=value=>value/source.scale;
const trace=commands=>{const path=new THREE.Path();for(const [method,...args]of commands)path[method](...args);return poly(path.getPoints(48).map(p=>world(p.toArray())));};
const rect=(x0,x1,y0,y1)=>poly([[x0,y0],[x1,y0],[x1,y1],[x0,y1]]);
const subtract=(a,b)=>a.map((v,k)=>v-b[k]);
const weightSphere=radius=>{
 const g=new THREE.SphereGeometry(radius,48,24),p=g.attributes.position,n=g.attributes.normal;
 // SphereGeometry leaves trigonometric residuals at its seam and south
 // pole. Identify those boundary vertices exactly for a closed solid.
 for(let row=0;row<=24;row++)for(let column=0;column<=48;column++){
  const i=row*49+column,first=row*49;
  if(row===0||row===24){p.setXYZ(i,0,row===0?radius:-radius,0);n.setXYZ(i,0,row===0?1:-1,0);}
  else if(column===48){p.setXYZ(i,p.getX(first),p.getY(first),p.getZ(first));n.setXYZ(i,n.getX(first),n.getY(first),n.getZ(first));}
 }
 return g;
};

export function makeWeightedClutchCandidate(){
 const root=new THREE.Group(),parts={},families={},blocks={},gears={},profiles={},linkage=makeWeightedClutchLinkage(),L=linkage.parameters,
  shaftRadius=px(source.shaft.radius),shaftBore=shaftRadius+.002,mainPitch=394/300,mainRatio=42/30,
  eCenter=world(source.wheelE.hub.center),ePitch=262/300,eRatio=36/30,axisX=new THREE.Vector3(1,0,0),axisZ=new THREE.Vector3(0,0,1);
 const group=(name,position=[0,0,0],axis=axisZ)=>{
  const g=new THREE.Group();g.position.fromArray(position);g.quaternion.setFromUnitVectors(axisZ,axis);root.add(g);blocks[name]=g;return g;
 };
 const add=(name,geometry,family,color=PALETTE.muted,parent=blocks[family],position=[0,0,0])=>{
  const m=new THREE.Mesh(geometry,matte(color,{metalness:.17,roughness:.61}));m.name=name;m.position.fromArray(position);parent.add(m);parts[name]=m;families[name]=family;return m;
 };
 group('fixed');
 const cone=(name,axis,apex,teeth,pitchRadius,angle,faceScale,color,bore)=>{
  const g=group(name,apex,axis),rotor=new THREE.Group();g.add(rotor);
  const outerDistance=pitchRadius/Math.tan(angle),tooth=bevelToothGeometry({teeth,innerDistance:outerDistance*faceScale,outerDistance,
   pitchConeAngle:angle,toothHeight:2.25*2*pitchRadius/teeth,toothThicknessFactor:.985,flankSegments:24,tipSegments:8}),
   p=tooth.attributes.position,n=tooth.attributes.normal,count=p.count/6;
  for(let i=0;i<2*count;i++){
   const x=p.getX(i),y=p.getY(i),r=Math.hypot(x,y),v=new THREE.Vector3(Math.tan(angle)*x/r,Math.tan(angle)*y/r,1).normalize();
   if(i<count)v.negate();n.setXYZ(i,v.x,v.y,v.z);
  }
  const end=tooth.userData.root,backDepth=name==='B'||name==='C'?.16:.07,
   openRim=name==='input'||name==='E',innerZ=end.z*faceScale,innerRadius=end.radius*faceScale,
   // The two face-on wheels have open centers in the engraving. Their
   // conical rims are backed by narrow webs; spokes connect them to hubs.
   profile=openRim?[[innerZ,innerRadius-.018],[innerZ,innerRadius],[end.z,end.radius],
    [end.z+backDepth,end.radius],[innerZ+backDepth,innerRadius-.018]]:
    [[innerZ,bore],[innerZ,innerRadius],[end.z,end.radius],
     [end.z+.035,end.radius],[end.z+backDepth,end.radius*.72],[end.z+backDepth,bore]],
   body=add(name+'Body',turned(profile,192),name,color,rotor),toothMeshes=[];
  for(let i=0;i<teeth;i++){
   const m=add(name+'Tooth'+i,tooth,name,color,rotor);m.rotation.z=2*Math.PI*i/teeth;m.userData={index:i,bevelTooth:true};toothMeshes.push(m);
  }
  Object.assign(g.userData,{axis,rotor,body,toothMeshes,teeth,pitchConeAngle:angle,pitchRadius,outerDistance,faceScale,profile});gears[name]=g;return g;
 };
 const sideAngle=Math.atan(1/mainRatio),inputAngle=Math.PI/2-sideAngle,
  B=cone('B',new THREE.Vector3(-1,0,0),[0,0,0],30,mainPitch/mainRatio,sideAngle,.735,PALETTE.accent,shaftBore),
  C=cone('C',axisX,[0,0,0],30,mainPitch/mainRatio,sideAngle,.735,PALETTE.driven,shaftBore),
  input=cone('input',new THREE.Vector3(0,0,-1),[0,0,0],42,mainPitch,inputAngle,.735,PALETTE.driver,.14),
  pinion=cone('pinion',new THREE.Vector3(-1,0,0),[...eCenter,0],30,ePitch/eRatio,Math.atan(1/eRatio),.68,PALETTE.driven,shaftBore),
  E=cone('E',axisZ,[...eCenter,0],36,ePitch,Math.atan(eRatio),.68,PALETTE.driven,.12);
 const localAngle=(g,p)=>{const v=p.clone().applyQuaternion(g.quaternion.clone().invert());return Math.atan2(v.y,v.x);};
 // The working generators face the rear input. The two opposed side gears
 // rotate in opposite world directions, while their local spins agree.
 const generator=new THREE.Vector3(Math.cos(sideAngle),0,-Math.sin(sideAngle)),
  phaseC=localAngle(C,generator),phaseB=localAngle(B,new THREE.Vector3(-generator.x,0,generator.z)),
  phaseInput=localAngle(input,generator)-Math.PI/42,
  eGenerator=new THREE.Vector3(-Math.cos(Math.atan(1/eRatio)),0,Math.sin(Math.atan(1/eRatio))),
  phasePinion=localAngle(pinion,eGenerator),phaseE=localAngle(E,eGenerator)-Math.PI/36;
 const jawCount=12,jawHeight=px(source.clutch.jawHeight),jawRadius=px(source.clutch.outerRadius),jawAxialRelief=.0003,
  jawMaterial=()=>new THREE.MeshStandardMaterial({vertexColors:true,metalness:.18,roughness:.6}),
  x=value=>(value-source.origin[0])/source.scale;
 const jaw=(name,profile,movingIndices,direction,family,parent,phase=0,keyed=false)=>{
  const relieved=profile.map(([z,r],i)=>[z-(keyed&&movingIndices.includes(i)?direction*jawAxialRelief:0),r]),
   geometry=jawClutchGeometry(relieved,{movingIndices,direction,jawCount,jawHeight,boreRadius:shaftBore,
    keyHalfWidth:keyed?.022:0,keywayTop:keyed?.166:0,symmetric:true,frontRadialSegments:8,
    color:family==='D'?PALETTE.brass:family==='B'?PALETTE.accent:PALETTE.driven,phase});
  const m=add(name,geometry,family,PALETTE.brass,parent);m.material.dispose();m.material=jawMaterial();return m;
 };
 const bFace=-x(source.clutch.leftFace),cFace=x(source.clutch.rightFace),
  bJaw=jaw('leftLooseJaw',[[bFace,shaftBore],[bFace,jawRadius],[1.02,jawRadius],[1.02,shaftBore]],[0,1],-1,'B',B.userData.rotor),
  cJaw=jaw('rightLooseJaw',[[cFace,shaftBore],[cFace,jawRadius],[1.04,jawRadius],[1.04,shaftBore]],[0,1],-1,'C',C.userData.rotor);
 bJaw.rotation.z=-phaseB;cJaw.rotation.z=-phaseC;
 const D=group('D',[0,0,0],axisX),dLeft=x(source.clutch.movingLeftFace),dRight=x(source.clutch.movingRightFace),waist=x(source.clutch.waist),grooveHalf=.055,
  dl=jaw('leftSlidingJaw',[[dLeft,shaftBore],[dLeft,jawRadius],[waist-.15,jawRadius],[waist-.075,.27],[waist-grooveHalf,.27],
   [waist-grooveHalf,.185],[waist,.185],[waist,shaftBore]],[0,1],-1,'D',D,Math.PI/jawCount,true),
  dr=jaw('rightSlidingJaw',[[waist,shaftBore],[waist,.185],[waist+grooveHalf,.185],[waist+grooveHalf,.27],[waist+.075,.27],
   [waist+.14,jawRadius],[dRight,jawRadius],[dRight,shaftBore]],[6,7],1,'D',D,Math.PI/jawCount,true);
 // The output shaft ends in the E pinion. Extending it behind the entire
 // front wheel would cross the perpendicular wheel spindle.
 const shaft=group('shaft',[0,0,0],axisX),shaftLeft=x(source.shaft.left),shaftRight=eCenter[0]-.58;
 add('outputShaft',disk(shaftRadius,shaftLeft,shaftRight,128),'shaft',PALETTE.muted,shaft);
 const featherLeft=-bFace+jawHeight+.03,featherRight=cFace-jawHeight-.03;
 add('shaftFeather',plate(rect(-.021,.021,shaftRadius-.005,.160),featherLeft,featherRight),'shaft',PALETTE.brass,shaft);
 for(const [name,axial]of [['Left',x(105)],['Right',x(1325)]]){
  const bearing=add('shaftBearing'+name,ring(shaftBore,.244,axial-.033,axial+.033,128),'fixed');bearing.quaternion.setFromUnitVectors(axisZ,axisX);
 }
 const inputRotor=input.userData.rotor;
 add('inputHub',ring(.14,.22,.93,1.22,128),'input',PALETTE.driver,inputRotor);
 for(const sign of [-1,1])add('inputHiddenSpoke'+sign,plate(rect(sign<0?-1.27:.12,sign<0?-.12:1.27,-.11,.11),1.05,1.13),'input',PALETTE.driver,inputRotor);
 add('rearInputShaft',disk(.137,1.05,1.85,128),'input',PALETTE.muted,inputRotor);
 const rearBearing=add('rearInputBearing',ring(.141,.225,1.50,1.68,128),'fixed');rearBearing.quaternion.copy(input.quaternion);
 // A plain front wheel carries the stud; the bevel teeth remain behind it.
 const front=new THREE.Group();front.rotation.z=-phaseE;E.userData.rotor.add(front);const frontZ=.86;
 const frontProfile=clip.difference(poly(circle([0,0],px(source.wheelE.outer.radius),256)),
  poly(circle([0,0],px(source.wheelE.inner.radius),256)));
 let wheel=clip.union(frontProfile,poly(circle([0,0],px(source.wheelE.hub.radius),128)));
 for(let i=0;i<4;i++){const a=i*Math.PI/2,b=[Math.cos(a)*.65,Math.sin(a)*.65];wheel=clip.union(wheel,capsule([0,0],b,.047,64));}
 wheel=clip.difference(wheel,poly(circle([0,0],.121,128)));
 add('studWheelFront',conformingPlateMesh(plate(wheel,frontZ,frontZ+.09)),'E',PALETTE.driven,front);
 add('studWheelAxle',disk(.118,-.45,frontZ+.10,128),'E',PALETTE.muted,front);
 add('studWheelRearBearing',ring(.122,.19,-.38,-.16,128),'fixed',PALETTE.muted,blocks.fixed,[...eCenter,0]);
 add('studWheelRimBridge',ring(.77,.82,.79,frontZ+.02,192),'E',PALETTE.driven,front);
 add('studWheelHub',ring(.121,px(source.wheelE.hub.radius),.72,frontZ+.08,128),'E',PALETTE.driven,front);
 add('studWheelAxleCap',disk(px(source.wheelE.shaft.radius),frontZ+.085,frontZ+.115,128),'E',PALETTE.muted,front);
 const stud=subtract(world(source.wheelE.stud.center),eCenter),studRadius=px(source.wheelE.stud.radius);
 add('reversingStud',ring(.068,studRadius,frontZ+.04,1.32,96),'E',PALETTE.brass,front,[...stud,0]);
 add('reversingStudPin',disk(.067,frontZ+.04,1.36,96),'E',PALETTE.muted,front,[...stud,0]);

 const lever=group('lever',[...L.F,0]),bell=group('bell',[...L.G,0]),quadrant=group('quadrant',[...L.F,0]),shifter=group('shifter',[...L.F,0]),rod=group('rod');
 const local=(point,pivot)=>subtract(world(point),pivot),fWeight=local(source.lever.weight.center,L.F),fTip=local(source.lever.tip,L.F),
  leverShape=clip.difference(clip.union(capsule([0,0],fTip,px(source.lever.halfWidth),96),poly(circle([0,0],px(source.lever.pivot.radius),128))),
   poly(circle([0,0],.175,128)),poly(circle(L.armF,.058,96)));
 add('weightedLever',conformingPlateMesh(plate(leverShape,1.42,1.48)),'lever',PALETTE.brass,lever);
 add('leverRodPin',disk(.056,1.315,1.50,96),'lever',PALETTE.muted,lever,[...L.armF,0]);
 add('weightF',weightSphere(px(source.lever.weight.radius)),'lever',PALETTE.brass,lever,[...fWeight,1.52]);
 const upper=local(source.bell.upperEnd,L.G),gShape=clip.difference(clip.union(capsule([0,0],upper,px(source.bell.upperHalfWidth),96),
   capsule([0,0],L.armG,px(source.bell.lowerHalfWidth),96),poly(circle([0,0],px(source.bell.pivot.radius),128))),poly(circle([0,0],.113,128)));
 add('bellCrankG',conformingPlateMesh(plate(gShape,1.22,1.28)),'bell',PALETTE.muted,bell);
 add('bellRodPin',disk(.070,1.21,1.40,96),'bell',PALETTE.muted,bell,[...L.armG,0]);
 const rodShape=clip.difference(clip.union(capsule([0,0],[L.rodLength,0],.061,96),poly(circle([L.rodLength,0],.136,96)),poly(circle([0,0],.092,96))),
  poly(circle([0,0],.058,96)),poly(circle([L.rodLength,0],.074,96)));
 add('connectingRod',conformingPlateMesh(plate(rodShape,1.32,1.38)),'rod',PALETTE.muted,rod);
 const q=source.quadrant,radius=px(q.radius),half=px(q.slotHalfWidth),a=q.startDegrees*Math.PI/180,b=q.endDegrees*Math.PI/180,
  shiftPolygon=polygons=>polygons.map(rings=>rings.map(ring=>ring.map(p=>subtract(p,L.F)))),
  slot=clip.union(sector(radius-half,radius+half,a,b,128),... [a,b].map(t=>poly(circle([radius*Math.cos(t),radius*Math.sin(t)],half,96)))),
  quadrantShape=clip.difference(clip.union(shiftPolygon(trace(q.outer)),poly(circle([0,0],.205,128))),slot,poly(circle([0,0],.175,128)));
 profiles.quadrant=quadrantShape;profiles.slot=slot;
 add('slottedQuadrant',conformingPlateMesh(plate(quadrantShape,1.12,1.18)),'quadrant',PALETTE.muted,quadrant);
 const collar=local(source.shifter.collar,L.F),shifterShape=clip.difference(clip.union(capsule([0,0],collar,px(source.shifter.halfWidth),96),
  poly(circle([0,0],.20,128))),poly(circle([0,0],.175,128)));
 add('clutchShifterLever',conformingPlateMesh(plate(shifterShape,1.22,1.28)),'shifter',PALETTE.muted,shifter);
 add('clutchShifterBridge',plate(rect(collar[0]-.023,collar[0]+.023,collar[1]-.025,collar[1]+.025),.17,1.24),'shifter',PALETTE.muted,shifter);
 for(const [name,pivot,radius]of [['Lever',L.F,.172],['Bell',L.G,.110]]){
  add(name+'FixedPivot',disk(radius,1.04,name==='Lever'?1.54:1.42,128),'fixed',PALETTE.muted,blocks.fixed,[...pivot,0]);
  add(name+'PivotRearSeat',disk(radius*1.35,.98,1.08,128),'fixed',PALETTE.muted,blocks.fixed,[...pivot,0]);
 }
 const outputBase=shaft.quaternion.clone(),outputSpin=new THREE.Quaternion();
 const setState=({inputAngle=0,outputAngle=0,leverAngle=0,quadrantAngle=0,shifterAngle=0,clutchShift=0}={})=>{
  if(![inputAngle,outputAngle,leverAngle,quadrantAngle,shifterAngle,clutchShift].every(Number.isFinite))throw Error('Nonfinite weighted clutch pose');
  const link=linkage.atAngle(leverAngle);input.userData.rotor.rotation.z=phaseInput+inputAngle;
  B.userData.rotor.rotation.z=phaseB-mainRatio*inputAngle;C.userData.rotor.rotation.z=phaseC-mainRatio*inputAngle;
  pinion.userData.rotor.rotation.z=phasePinion-outputAngle;E.userData.rotor.rotation.z=phaseE+outputAngle/eRatio;
  outputSpin.setFromAxisAngle(axisZ,outputAngle);shaft.quaternion.copy(outputBase).multiply(outputSpin);
  D.quaternion.copy(shaft.quaternion);D.position.x=clutchShift;
  lever.rotation.z=leverAngle;quadrant.rotation.z=quadrantAngle;shifter.rotation.z=shifterAngle;bell.rotation.z=link.bellAngle;
  rod.position.set(...link.A,0);rod.rotation.z=link.rodAngle;root.updateMatrixWorld(true);
  return root.userData.state={inputAngle,outputAngle,leverAngle,quadrantAngle,shifterAngle,clutchShift,...link};
 };
 root.userData={source,parts,families,blocks,gears,profiles,linkage,hideGround:true,cameraFov:8,shadowCameraHalfExtent:7,shadowBias:-.00003,shadowNormalBias:.002,
  fidelity:'candidate',mechanism:'weighted-clutch-source-reconstruction',geometry:{mainPitch,mainRatio,sideAngle,inputAngle,ePitch,eRatio,shaftRadius,shaftBore,
   jawCount,jawHeight,jawRadius,jawAxialRelief,waist,grooveHalf,collar,frontZ,stud,studRadius,shaftRight,featherLeft,featherRight},
  qualification:'Isolated finite geometry and measured four-bar candidate. The quadrant and shifter have independent coordinates until their lost-motion coupling is resolved. Gear ratios, hidden depths, jaw profile, supports and stud layers are explicit hypotheses. No gravity/contact-derived reversal or complete clearance is claimed.'};
 setState();markShadows(root);return{root,setState,update:()=>{},cameraDirection:new THREE.Vector3(0,0,10)};
}
