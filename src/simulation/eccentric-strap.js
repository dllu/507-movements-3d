import * as THREE from 'three';
import source from './eccentric-strap-source.js';
import {PALETTE, matte, markShadows} from './primitives.js';
import {circle, disk, ring, plate, poly, polygonClipping as clip} from './finite-plate-geometry.js';
import {makeEccentricStrapJoints} from './eccentric-strap-joints.js';

export {THREE};
const rectangle = (x0,y0,x1,y1) => poly([[x0,y0],[x1,y0],[x1,y1],[x0,y1]]);
const circular = (center,r) => poly(circle(center,r,256));
const sourcePoint = ([x,y]) => [(x-source.center[0])/source.scale,(source.center[1]-y)/source.scale];
const curve = points => new THREE.SplineCurve(points.map(p => new THREE.Vector2(...sourcePoint(p))))
  .getPoints(80).map(p => p.toArray());

export function makeEccentricStrap() {
  const root = new THREE.Group(), parts = {}, families = {};
  const materials = Object.fromEntries(Object.entries({input:PALETTE.driver,strap:PALETTE.driven,
    liner:PALETTE.brass,fastener:PALETTE.accent,shaft:PALETTE.ink,fixed:PALETTE.frame})
    .map(([name,color]) => [name,matte(color,{metalness:.18,roughness:.6})]));
  materials.collar=matte(PALETTE.muted,{metalness:.3,roughness:.55});
  const input = new THREE.Group(), strap = new THREE.Group(), outputSlide = new THREE.Group(), fixed = new THREE.Group();
  root.add(input,strap,outputSlide,fixed);
  const add = (name,geometry,group,material,family) => {
    const mesh = new THREE.Mesh(geometry,materials[material]); mesh.name=name; mesh.userData.role=name;
    group.add(mesh); parts[name]=mesh; families[name]=family; return mesh;
  };
  const eccentricity = (source.center[0]-source.shaft[0])/100;
  const outerRadius=source.outerRadius/100, flangeRadius=source.flangeRadius/100;
  const shaftRadius=source.shaftRadius/100, bearingRadius=flangeRadius-.025;
  const bearingClearance=.0015, linerInnerRadius=bearingRadius+bearingClearance;
  const strapInnerRadius=flangeRadius+.005, strapHalfDepth=.21, splitX=(source.clamp.seam-source.center[0])/100;
  const splitGap=.004, halfMasks=[rectangle(-3,-3,splitX-splitGap/2,3),rectangle(splitX+splitGap/2,-3,3,3)];
  const lugLeft=(source.clamp.left-source.center[0])/100, lugRight=(source.clamp.right-source.center[0])/100;
  const lugTop=(source.center[1]-source.clamp.upperTop)/100, lugBottom=(source.center[1]-source.clamp.lowerBottom)/100;
  const lugJoinY=1.2;
  const strapBlank=clip.difference(clip.union(circular([0,0],outerRadius),
    rectangle(lugLeft,1.05,lugRight,lugJoinY),rectangle(lugLeft,-lugJoinY,lugRight,-1.05)),circular([0,0],strapInnerRadius));
  const strapLower=clip.intersection(strapBlank,rectangle(-3,-lugJoinY,3,lugJoinY));
  const liners=clip.difference(circular([0,0],strapInnerRadius),circular([0,0],linerInnerRadius));
  const strapHalves=[], bearingLiners=[], strapLugs=[], strapBolts=[];
  for(let i=0;i<2;i++) {
    const side=i===0?'left':'right';
    strapHalves.push(add(side+'-strap-casting',plate(clip.intersection(strapLower,halfMasks[i]),-strapHalfDepth,strapHalfDepth),strap,'strap','strap'));
    bearingLiners.push(add(side+'-bearing-liner',plate(clip.intersection(liners,halfMasks[i]),-strapHalfDepth,strapHalfDepth),strap,'liner','strap'));
    const lowX=i===0?lugLeft:splitX+splitGap/2, highX=i===0?splitX-splitGap/2:lugRight;
    for(const [name,bottom,top,boltY] of [['upper',lugJoinY,lugTop,(288-source.clamp.upperBoltY)/100],
      ['lower',lugBottom,-lugJoinY,(288-source.clamp.lowerBoltY)/100]]) {
      // Above/below ±1.2 the casting is rectangular, so an X-axis
      // extrusion can drill the actual bolt bore without a mesh boolean.
      const section=clip.difference(rectangle(-strapHalfDepth,bottom,strapHalfDepth,top),circular([0,boltY],.057));
      const geometry=plate(section,lowX,highX);geometry.rotateY(Math.PI/2);
      strapLugs.push(add(side+'-'+name+'-bored-clamp',geometry,strap,'strap','strap'));
    }
  }
  for(const [name,boltY] of [['upper',(288-source.clamp.upperBoltY)/100],['lower',(288-source.clamp.lowerBoltY)/100]]) {
    const bolt=new THREE.Group();bolt.position.y=boltY;strap.add(bolt);strapBolts.push(bolt);
    const shank=disk(.055,lugLeft,lugRight,256);shank.rotateY(Math.PI/2);
    add(name+'-clamp-bolt-shank',shank,bolt,'fastener','strap');
    for(const [side,low,high] of [['head',lugLeft-.16,lugLeft],['nut',lugRight,lugRight+.20]]) {
      const geometry=disk(.145,low,high,6);geometry.rotateY(Math.PI/2);
      add(name+'-clamp-bolt-'+side,geometry,bolt,'fastener','strap');
    }
  }
  const inputShaft=add('input-shaft',disk(shaftRadius,-.74,.43,256),input,'shaft','input');
  // All sheave sections have the same off-center press-fit shaft bore.
  const sheave = (name,r,low,high,material='input') => {
    const mesh=add(name,plate(clip.difference(circular([0,0],r),circular([-eccentricity,0],shaftRadius)),low,high),input,material,'input');
    mesh.position.x=eccentricity;return mesh;
  };
  const sheaveBody=sheave('eccentric-bearing-journal',bearingRadius,-.22,.22);
  sheave('rear-retaining-flange',flangeRadius,-.25,-.22);
  sheave('front-retaining-flange',flangeRadius,.22,.25);
  // The raised boss Brown draws inside the strap is cast with the sheave:
  // same material, so it reads as a low step, not a pale inset disc.
  sheave('raised-sheave-face',source.faceRadius/100,.25,.27);
  const shaftCap=add('shaft-collar',ring(shaftRadius,source.collarRadius/100,.27,.365,256),input,'collar','input');

  const flangeThickness=(source.flange.right-source.flange.left)/200;
  const innerCouplingX=(source.flange.left-source.center[0])/100+flangeThickness/2;
  const flangeY=(source.center[1]-(source.flange.top+source.flange.bottom)/2)/100;
  const rodY=-.045, rodX=3.9, rodRadius=Math.hypot(rodX,rodY), rodLocalAngle=Math.atan2(rodY,rodX);
  const rodTop=curve(source.rodTop), rodBottom=curve(source.rodBottom);
  const rodOutline=[...rodTop,[rodX,rodY+.12],[rodX,rodY-.12],...rodBottom.reverse()];
  const joints=makeEccentricStrapJoints({rodLength:rodX,rodY,innerCouplingX,flangeThickness,
    flangeHalfHeight:(source.flange.bottom-source.flange.top)/200,flangeY,flangeBoltY:.465,flangeHeadRadius:.095,
    rodOutline,drivenMaterial:materials.strap,fastenerMaterial:materials.fastener});
  const {innerCouplingPlate,outerCouplingPlate,couplingBolts,eccentricRod,rodEndEye,crosshead,wristPin}=joints;
  strap.add(innerCouplingPlate,outerCouplingPlate,...couplingBolts,eccentricRod,rodEndEye);
  outputSlide.add(crosshead,wristPin);
  for(const [name,group,family] of [['inner-flange',innerCouplingPlate,'strap'],['outer-flange',outerCouplingPlate,'strap'],
    ...couplingBolts.map((bolt,i)=>['flange-bolt-'+i,bolt,'strap']),['eccentric-rod',eccentricRod,'strap'],
    ['crosshead',crosshead,'output'],['wrist-pin',wristPin,'output']]) {
    let index=0;group.traverse(o=>{if(o.isMesh){const key=name+(group===o?'':'-'+index++);parts[key]=o;families[key]=family;o.name=key;}});
  }
  // The neck is behind the strap face, leaving the source's circular rim
  // edge visible at the connection. Its root extends into the casting.
  const neckPolygon=poly([...curve(source.neckTop),...curve(source.neckBottom).reverse()]);
  const couplingNeck=add('flared-strap-neck',plate(clip.difference(neckPolygon,circular([0,0],outerRadius)),-.16,.16),strap,'strap','strap');
  const outputStemLength=.90, stemStart=joints.dimensions.outputStemStartX;
  const stem=disk(.115,stemStart,stemStart+outputStemLength,128);stem.rotateY(Math.PI/2);
  const outputStem=add('output-valve-stem',stem,outputSlide,'shaft','output');
  const sliderY=rodY, outputMinimumX=Math.sqrt((rodRadius-eccentricity)**2-sliderY**2), outputMaximumX=Math.sqrt((rodRadius+eccentricity)**2-sliderY**2);
  const guideMinimumX=outputMinimumX-.46, guideMaximumX=outputMaximumX+stemStart+outputStemLength+.12;
  const guideRails=[-1,1].map((sign,i)=>{
    const rail=joints.makeGuide(guideMinimumX,guideMaximumX,sliderY,sign,materials.fixed);
    fixed.add(rail);parts['crosshead-guide-'+i]=rail;families['crosshead-guide-'+i]='fixed';return rail;
  });
  // Complete the hidden support system with rear bores and substantial
  // feet. All supports stay behind the rotating eccentric and swinging strap.
  const baseY=-2.65, baseLow=baseY-.10, baseHigh=baseY+.10, fixedZ=-.57;
  const baseRail=add('base-rail',plate(rectangle(-1.45,baseLow,guideMaximumX,baseHigh),-.74,-.40),fixed,'fixed','fixed');
  const rearBearing=add('bored-rear-shaft-support',plate(clip.difference(clip.union(
    circular([0,0],.34),rectangle(-.29,baseHigh,.29,-.1)),circular([0,0],shaftRadius+.002)),fixedZ-.13,fixedZ+.13),fixed,'fixed','fixed');
  const guideSupports=[guideMinimumX+.25,guideMaximumX-.25].map((x,i)=>add('guide-support-'+i,
    plate(rectangle(x-.09,baseHigh,x+.09,sliderY-joints.dimensions.crossheadHalfHeight-joints.dimensions.guideClearance-.13),-.48,.48),fixed,'fixed','fixed'));

  const omega=-Math.PI/2, cyclePeriod=4;
  const stateAtTime = time => {
    if(!Number.isFinite(time))throw new Error('Nonfinite eccentric time');time=Math.max(0,time);
    const driverAngle=omega*time, c=Math.cos(driverAngle),s=Math.sin(driverAngle);
    const eccentricCenter=new THREE.Vector3(eccentricity*c,eccentricity*s,0);
    const vertical=sliderY-eccentricCenter.y, horizontal=Math.sqrt(rodRadius**2-vertical**2);
    const strapAngle=Math.atan2(vertical,horizontal)-rodLocalAngle;
    const eccentricVelocity=new THREE.Vector3(-eccentricity*s*omega,eccentricity*c*omega,0);
    const outputPoint=new THREE.Vector3(eccentricCenter.x+horizontal,sliderY,0);
    const strapAngularSpeed=-eccentricVelocity.y/horizontal;
    const outputVelocity=new THREE.Vector3(eccentricVelocity.x+vertical*eccentricVelocity.y/horizontal,0,0);
    return {driverAngle,driverAngularSpeed:omega,eccentricCenter,eccentricVelocity,strapAngle,strapAngularSpeed,
      outputPoint,outputVelocity,actualRodLength:rodRadius,relativeBearingAngularSpeed:omega-strapAngularSpeed,
      stage:Math.abs(outputVelocity.x)<1e-10?'dead-center':outputVelocity.x<0?'drawing-output':'pushing-output'};
  };
  // Brown breaks the rod off a short way beyond the bolted flanges; that is
  // his drawing convention, so the rod is shown whole to its wrist eye.
  const update = time => {
    const state=stateAtTime(time);input.rotation.z=state.driverAngle;
    strap.position.copy(state.eccentricCenter);strap.rotation.z=state.strapAngle;
    outputSlide.position.copy(state.outputPoint);root.userData.kinematics=state;root.updateMatrixWorld(true);
  };
  root.userData={parts,families,joints,source,shadowCameraHalfExtent:5.5,shadowBias:-.00003,shadowNormalBias:.003,hideGround:true,fidelity:'authored',reconstructionStatus:'rebuilt',
    mechanism:'eccentric-sheave-split-strap-slider',minimumDisplayCycleSeconds:4,playbackPeriod:4,
    animationTiming:{authoredCyclePeriod:4},stateAtTime,
    blocks:{input,inputShaft,sheaveBody,shaftCap,strap,leftStrapHalf:strapHalves[0],rightStrapHalf:strapHalves[1],
      leftBearingLiner:bearingLiners[0],rightBearingLiner:bearingLiners[1],strapLugs,strapBolts,couplingNeck,
      innerCouplingPlate,outerCouplingPlate,couplingBolts,eccentricRod,rodEndEye,crosshead,wristPin,outputSlide,outputStem,
      guideRails,guideSupports,baseRail,rearBearing},
    geometry:{eccentricity,sheaveRadius:bearingRadius,bearingClearance,linerInnerRadius,strapBodyInnerRadius:strapInnerRadius,
      strapOuterRadius:outerRadius,shaftRadius,shaftCenter:new THREE.Vector3(),cyclePeriod,fullTurn:2*Math.PI,
      inputAngularSpeed:omega,inputSpeedMagnitude:-omega,eccentricRodLength:rodRadius,rodX,rodY,rodLocalAngle,
      maximumStrapAngle:Math.max(...[-eccentricity,eccentricity].map(y=>Math.abs(Math.asin((sliderY-y)/rodRadius)-rodLocalAngle))),
      outputMinimumX,outputMaximumX,sliderY,outputStemLength,guideMinimumX,guideMaximumX,baseY,
      splitX,splitGap,lugJoinY,strapHalfDepth,flangeRadius,pressFitShaftSeats:true},
    qualification:'Circular sheave, strap, shaft collar, split lugs and flared rod follow the engraving readings. The rod continues to a complete guided crosshead. Shared centers, press fits, bearing/flange clearances, hidden depths and the support arrangement are reconstruction assumptions.',
    idealConstraints:'A continuous prescribed shaft drives a close-fitting eccentric journal. The split strap and rod form a rigid link with one pin in a line-constrained crosshead. These ideal revolute/prismatic constraints retain the small physical running clearances; this is a kinematic mechanism, not a loaded dynamics calculation.'};
  update(0);markShadows(root);return {root,update,cameraDirection:new THREE.Vector3(1.6,1.2,10)};
}
