import * as THREE from 'three';
import source from './source.js';
import {triangularEccentricProfile} from '../triangular-eccentric-profile.js';
import {triangularEccentricEnvelope} from './envelope.js';
import {cubicPolyline} from '../cubic-polyline.js';
import {plate,poly,circle,disk,ring,polygonClipping as clip} from '../finite-plate-geometry.js';
import {hatchedSectionFace} from '../section-hatch.js';
import {PALETTE,matte,markShadows} from '../primitives.js';

export {THREE};

function side(points) {
  const result=[];
  for(let i=0;i<points.length-1;i++) {
    const b=points[i],c=points[i+1],a=points[i-1]??b,d=points[i+2]??c;
    result.push(...cubicPolyline([b,b.map((x,k)=>x+(c[k]-a[k])/6),c.map((x,k)=>x-(d[k]-b[k])/6),c],.001).points.slice(0,-1));
  }
  return [...result,points.at(-1)];
}

export function makeTriangularEccentricGeometry({chordTolerance=.00001}={}) {
  const root=new THREE.Group(),parts={},families={},blocks={};
  const attach=(name,geometry,family,color,position=[0,0,0])=>{
    if(!blocks[family]){blocks[family]=new THREE.Group();root.add(blocks[family]);}
    const mesh=new THREE.Mesh(geometry,matte(color,{metalness:.14,roughness:.6}));
    mesh.name=name;mesh.position.fromArray(position);blocks[family].add(mesh);parts[name]=mesh;families[name]=family;return mesh;
  };
  const profile=triangularEccentricProfile({width:source.width/100,smallRadius:source.smallRadius/100});
  const outline=profile.outline(chordTolerance),originY=source.axis[1]-profile.amplitude*100;
  const point=([x,y])=>[(x-source.axis[0])/100,(originY-y)/100];
  const radius=source.shaftRadius/100,rodRadius=source.rodRadius/100,clearance=.001;
  const depth=.22,bodyDepth=.28,rodRoots=source.rodRoots.map(y=>(originY-y)/100);
  let outer=poly([...side(source.outerLeft.map(point)),...side(source.outerRight.map(point)).reverse()]);
  // The short, flat attachment lands join the round rods to the slightly
  // sloping engraved bars without burying cylindrical end caps in the plate.
  for(const [i,sign] of [1,-1].entries()) {
    const end=rodRoots[i],inner=end-sign*.08;
    outer=clip.union(outer,poly([[-rodRadius,end],[rodRadius,end],[rodRadius,inner],[-rodRadius,inner]]));
  }
  const tracedHole=poly([...side(source.innerLeft.map(point)),...side(source.innerRight.map(point)).reverse()]);
  const envelope=triangularEccentricEnvelope(profile),hole=clip.union(tracedHole,poly(envelope.boundary));
  attach('yoke',plate(clip.difference(outer,hole),-bodyDepth/2,bodyDepth/2),'yoke',PALETTE.driven);
  attach('cam',plate(clip.difference(poly(outline),poly(circle([0,0],radius+.001,128))),-depth/2,depth/2),'input',PALETTE.driver);
  attach('shaft',disk(radius,-.76,.31,128),'input',PALETTE.ink);
  // Brown hatches the exposed shaft end as a section. Presentation only: it
  // is not a mass-bearing part.
  {const face=hatchedSectionFace(radius);face.position.z=.31;blocks.input.add(face);}
  attach('collar',ring(radius+.001,source.collarRadius/100,.15,.30,128),'input',PALETTE.driver);
  const bearingHalfSpacing=profile.width/2+clearance,bearingHalfWidth=profile.height+.04;
  const holeY=[source.upperHoleY,source.lowerHoleY].map(y=>(originY-y)/100);
  for(const [i,sign] of [1,-1].entries()) {
    const ys=[holeY[i],sign*bearingHalfSpacing].sort((a,b)=>a-b);
    attach('liner'+i,new THREE.BoxGeometry(2*bearingHalfWidth,ys[1]-ys[0],bodyDepth),'yoke',PALETTE.brass,[0,(ys[0]+ys[1])/2,0]);
  }
  const guideHalfLength=.11,guideCenter=Math.max(...rodRoots.map(Math.abs))+profile.amplitude+guideHalfLength+.07;
  const rodEnd=guideCenter+guideHalfLength+profile.amplitude+.04,postX=1.76,postHalfWidth=.06;
  for(const [i,sign] of [1,-1].entries()) {
    const ends=[rodRoots[i],sign*rodEnd].sort((a,b)=>a-b);
    const rod=attach('rod'+i,disk(rodRadius,...ends,96),'yoke',PALETTE.driven);rod.rotation.x=-Math.PI/2;
    const guideProfile=clip.difference(clip.union(poly(circle([0,0],.27,128)),
      poly([[-.08,0],[.08,0],[.08,.49],[-.08,.49]])),poly(circle([0,0],rodRadius+.005,96)));
    const guide=attach('guide'+i,plate(guideProfile,-guideHalfLength,guideHalfLength),'frame',PALETTE.muted,[0,sign*guideCenter,0]);
    guide.rotation.x=-Math.PI/2;
    attach('crossbar'+i,new THREE.BoxGeometry(2*(postX-postHalfWidth),2*guideHalfLength,.18),'frame',PALETTE.muted,[0,sign*guideCenter,-.58]);
    attach('post'+i,new THREE.BoxGeometry(2*postHalfWidth,2*(guideCenter+guideHalfLength),.18),'frame',PALETTE.muted,[sign*postX,0,-.58]);
  }
  const shaftSupport=clip.difference(clip.union(poly(circle([0,0],.29,128)),
    poly([[-postX+postHalfWidth,-.07],[postX-postHalfWidth,-.07],[postX-postHalfWidth,.07],[-postX+postHalfWidth,.07]])),poly(circle([0,0],radius+.002,128)));
  attach('shaftSupport',plate(shaftSupport,-.67,-.49),'frame',PALETTE.muted);
  blocks.input.rotation.z=source.phase;blocks.yoke.position.y=profile.amplitude;
  Object.assign(root.userData,{parts,families,blocks,source,profile,envelope,hideGround:true,profiles:{outer,hole,tracedHole,cam:outline},
    geometry:{originY,chordTolerance,depth,bodyDepth,clearance,bearingHalfSpacing,bearingHalfWidth,holeY,rodRoots,rodRadius,rodEnd,guideHalfLength,guideCenter}});
  markShadows(root);root.updateMatrixWorld(true);
  return {root,focus:new THREE.Vector3(0,0,0),cameraDirection:new THREE.Vector3(.6,.3,10)};
}
