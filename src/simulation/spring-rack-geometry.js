import * as THREE from 'three';
import measured from '../data/spring-rack-source.js';
import {makeSpringRackCoil} from './spring-rack-coil.js';
import {PALETTE,matte,markShadows} from './primitives.js';
import {poly,circle,capsule,plate,ring,disk,polygonClipping as clip,familyMass} from './finite-plate-geometry.js';

const source=point=>[(point[0]-measured.center[0])/measured.scale,(measured.center[1]-point[1])/measured.scale],
 px=value=>value/measured.scale,rect=(left,right,bottom,top)=>poly([[left,bottom],[right,bottom],[right,top],[left,top]]);

export function makeSpringRackGeometry({pressureDegrees=10,rackTipWidthPixels=22,backlashPixels=.5,rackPhasePixels=0,gearPhaseOffset=0,stopTopSource=703}={}){
 const root=new THREE.Group(),parts={},families={},blocks={},profiles={},
  p={source:measured,pressureAngle:pressureDegrees*Math.PI/180,teeth:measured.virtualTeeth,installedTeeth:measured.gearTeeth,
   pitch:px(measured.pitch),pitchRadius:px(measured.pitch*measured.virtualTeeth/(2*Math.PI)),gearPhase:measured.gearPhase+gearPhaseOffset,
   outerRadius:px(measured.gearTipRadius),blankRadius:1,rackRootX:source([653,0])[0],rackTipX:source([685,0])[0],
   rackTipWidth:px(rackTipWidthPixels),backlash:px(backlashPixels),rackPhasePixels,
   layers:{gear:[-.03,.09],flange:[-.08,-.03],rack:[.1-px(15),.1+px(15)]},
   spring:{turns:8,axisX:source([640,0])[0],axisZ:.1,radius:px(42.5),wireRadius:px(4.5),top:source([0,83])[1],bottom:source([0,487])[1]},
   guide:{stemX:[629,649],stemZ:[.1-px(6),.1+px(6)],channelX:[627,651],channelZ:[.1-px(8),.1+px(8)],stemEndSourceY:1000},
   stop:{sourceX:639,sourceY:800,slotTop:stopTopSource,slotBottom:1120,slotRadius:4.5,pinRadius:3}};
 p.stop.minimumY=px(p.stop.slotTop+p.stop.pinRadius-p.stop.sourceY);
 p.stop.maximumY=px(p.stop.slotBottom-p.stop.pinRadius-p.stop.sourceY);
 p.baseRadius=p.pitchRadius*Math.cos(p.pressureAngle);p.rootRadius=-p.rackTipX-px(4);
 p.rackAddendum=p.rackTipX+p.pitchRadius;
 p.rackPitchThickness=p.rackTipWidth+2*p.rackAddendum*Math.tan(p.pressureAngle);
 p.pitchHalfAngle=(p.pitch-p.rackPitchThickness-p.backlash)/(2*p.pitchRadius);
 const involute=r=>{const v=Math.sqrt(Math.max(0,(r/p.baseRadius)**2-1));return v-Math.atan(v);},
  halfAngle=r=>p.pitchHalfAngle+involute(p.pitchRadius)-involute(r);
 p.tipHalfAngle=halfAngle(p.outerRadius);if(!(p.tipHalfAngle>0))throw Error('Intersecting involute tips');
 p.contactRatio=(Math.sqrt(p.outerRadius**2-p.baseRadius**2)-p.pitchRadius*Math.sin(p.pressureAngle)+p.rackAddendum/Math.sin(p.pressureAngle))
  /(p.pitch*Math.cos(p.pressureAngle));
 for(const family of ['fixed','gear','rack','spring']){blocks[family]=new THREE.Group();root.add(blocks[family]);}
 const attach=(name,geometry,family,color,position=[0,0,0])=>{
  const mesh=new THREE.Mesh(geometry,matte(color,{metalness:.2,roughness:.57}));mesh.name=name;mesh.position.fromArray(position);
  parts[name]=mesh;families[name]=family;blocks[family].add(mesh);return mesh;
 };
 const gearPoints=[],angularPitch=2*Math.PI/p.teeth,startRadius=Math.max(p.rootRadius,p.baseRadius),polar=(r,a)=>[r*Math.cos(a),r*Math.sin(a)];
 for(let i=0;i<p.teeth;i++){
  const theta=i*angularPitch,lo=theta-angularPitch/2,hi=theta+angularPitch/2;
  if(i<p.installedTeeth){
   const lowAngle=theta-halfAngle(startRadius),highAngle=theta+halfAngle(startRadius);
   for(let k=0;k<=8;k++)gearPoints.push(polar(p.rootRadius,lo+(lowAngle-lo)*k/8));
   if(startRadius>p.rootRadius)gearPoints.push(polar(startRadius,lowAngle));
   for(let k=1;k<=96;k++){const r=startRadius+(p.outerRadius-startRadius)*k/96;gearPoints.push(polar(r,theta-halfAngle(r)));}
   for(let k=1;k<=16;k++)gearPoints.push(polar(p.outerRadius,theta-p.tipHalfAngle+2*p.tipHalfAngle*k/16));
   for(let k=95;k>=0;k--){const r=startRadius+(p.outerRadius-startRadius)*k/96;gearPoints.push(polar(r,theta+halfAngle(r)));}
   if(startRadius>p.rootRadius)gearPoints.push(polar(p.rootRadius,highAngle));
   for(let k=1;k<=8;k++)gearPoints.push(polar(p.rootRadius,highAngle+(hi-highAngle)*k/8));
  }else for(let k=0;k<=32;k++)gearPoints.push(polar(p.rootRadius,lo+(hi-lo)*k/32));
 }
 const bore=px(measured.circles.shaftInner.radius+1.5),faceRadius=px(measured.circles.wheelInner.radius),hubRadius=px(measured.circles.shaftOuter.radius),
  gearShape=clip.difference(poly(gearPoints),poly(circle([0,0],faceRadius,256)));
 profiles.gear=poly(gearPoints);
 attach('workingGear',plate(gearShape,...p.layers.gear),'gear',PALETTE.driver);
 attach('rearFlange',ring(bore,1,...p.layers.flange,256),'gear',PALETTE.driver);
 attach('recessedFace',ring(bore,faceRadius,-.03,.075,256),'gear',PALETTE.driver);
 attach('gearHub',ring(bore,hubRadius,.075,.145,128),'gear',PALETTE.driver);
 attach('fixedAxle',disk(px(measured.circles.shaftInner.radius),-.12,.165,128),'fixed',PALETTE.muted);
 attach('axleRearCap',disk(px(28),-.135,-.12,128),'fixed',PALETTE.muted);
 const horizontal=(outer,hole,low,high)=>{
  const geometry=plate(hole?clip.difference(outer,hole):outer,low,high);geometry.rotateX(-Math.PI/2);return geometry;
 },xzRectangle=(xs,zs)=>rect(source([xs[0],0])[0],source([xs[1],0])[0],-zs[1],-zs[0]),
  channel=xzRectangle(p.guide.channelX,p.guide.channelZ),rodLow=source([0,1257])[1],rodHigh=source([0,507])[1];
 // Four touching closed walls form the hollow rod. The rear wall has a real
 // closed slot for the fixed stop pin; no stop force is applied to an empty
 // location or through a painted opening.
 for(const [name,xs,zs]of [['rackLeftWall',[617,627],p.layers.rack],['rackRightWall',[651,653],p.layers.rack],
  ['rackFrontWall',[627,651],[p.guide.channelZ[1],p.layers.rack[1]]]])
  attach(name,horizontal(xzRectangle(xs,zs),null,rodLow,rodHigh),'rack',PALETTE.driven);
 const rearOutline=rect(source([627,0])[0],source([651,0])[0],rodLow,rodHigh),
  stopSlot=capsule(source([p.stop.sourceX,p.stop.slotTop+p.stop.slotRadius]),source([p.stop.sourceX,p.stop.slotBottom-p.stop.slotRadius]),px(p.stop.slotRadius),128),
  rearShape=clip.difference(rearOutline,stopSlot);
 attach('slottedRackRearWall',plate(rearShape,p.layers.rack[0],p.guide.channelZ[0]),'rack',PALETTE.driven);
 profiles.stopSlot=stopSlot;
 const plateSeat=(name,range,family,hole,depth)=>attach(name,horizontal(xzRectangle([range.left,range.right],[.1-px(depth/2),.1+px(depth/2)]),hole,
  source([0,range.bottom])[1],source([0,range.top])[1]),family,family==='rack'?PALETTE.driven:PALETTE.muted);
 plateSeat('movingSpringSeat',measured.rod.movingSeat,'rack',channel,100);
 const stemShape=xzRectangle(p.guide.stemX,p.guide.stemZ);
 attach('fixedSlidingMandrel',horizontal(stemShape,null,source([0,p.guide.stemEndSourceY])[1],source([0,20])[1]),'fixed',PALETTE.muted);
 attach('fixedTravelStopPin',disk(px(p.stop.pinRadius),-.11,.1,128),'fixed',PALETTE.muted,[...source([p.stop.sourceX,p.stop.sourceY]),0]);
 attach('travelStopRearCap',disk(px(6),-.125,-.11,128),'fixed',PALETTE.muted,[...source([p.stop.sourceX,p.stop.sourceY]),0]);
 plateSeat('upperSpringSeat',measured.rod.upperSeat,'fixed',stemShape,100);
 plateSeat('lowerRackGuide',measured.rod.lowerGuide,'fixed',xzRectangle([616,654],[p.layers.rack[0]-px(1),p.layers.rack[1]+px(1)]),48);
 profiles.rackTeeth=[];
 for(let i=0;i<measured.rackTeeth;i++){
  const cy=source([0,measured.rackUpperStrokeOrigin+11+measured.pitch*i+rackPhasePixels])[1],
   tipHalf=p.rackTipWidth/2,rootHalf=tipHalf+(p.rackTipX-p.rackRootX)*Math.tan(p.pressureAngle),
   shape=poly([[p.rackRootX,cy-rootHalf],[p.rackTipX,cy-tipHalf],[p.rackTipX,cy+tipHalf],[p.rackRootX,cy+rootHalf]]);
  attach('rackTooth'+i,plate(shape,...p.layers.rack),'rack',PALETTE.driven);profiles.rackTeeth.push(shape);
 }
 const spring=makeSpringRackCoil({...p.spring,referenceSpan:p.spring.top-p.spring.bottom-2*p.spring.wireRadius});
 attach('compressionSpring',spring.geometry,'spring',PALETTE.brass);
 const setState=({q=0,rackY=0}={})=>{
  blocks.gear.rotation.z=p.gearPhase+q;blocks.rack.position.y=rackY;
  const coil=spring.update(p.spring.bottom+rackY,p.spring.top,p.spring.axisX,p.spring.axisZ);
  root.userData.kinematics={q,rackY,gearAngle:p.gearPhase+q,spring:coil};root.updateMatrixWorld(true);return root.userData.kinematics;
 };
 root.userData={parts,families,blocks,geometry:p,profiles,source,setState,halfAngle,involute,
  hideGround:true,cameraFov:8,shadowCameraHalfExtent:6,shadowBias:-.00003,shadowNormalBias:.003,
  mechanism:'mutilated-spur-rack-compression-spring-return',fidelity:'authored',
  qualification:'Six involute teeth and seven finite rack teeth follow the measured source. A shallow rear flange, hollow rack with concealed sliding mandrel, rear travel-stop slot/pin, actual guide passages and constant-section spring wire are reconstruction assumptions. Motion follows the integrated finite-contact reconstruction.'};
 setState();root.userData.masses={rack:familyMass(parts,families,'rack')};markShadows(root);
 return {root,setState,update:()=>{},cameraDirection:new THREE.Vector3(0,0,10)};
}
