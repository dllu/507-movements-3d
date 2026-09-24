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
  const depth=.22,bodyDepth=.28,rodRoots=source.rodRoots.map(y=>(originY-y)/100),rodTips=source.rodTips.map(y=>(originY-y)/100);
  // Brown's yoke is a smooth casting: straight top and bottom edges joined by
  // evenly bowed sides. The hand-traced ink (kept as profiles.tracedOuter and
  // tracedHole) wobbles, so both outlines are ideal curves through its
  // corners and widest points: each side is one quadratic arc.
  const bowed=(tl,tr,br,bl,rightX,leftX)=>{
    const arc=(a,b,x,steps=48)=>{
      const c=[2*x-(a[0]+b[0])/2,(a[1]+b[1])/2],result=[];
      for(let i=1;i<steps;i++){const t=i/steps,u=1-t;result.push([u*u*a[0]+2*u*t*c[0]+t*t*b[0],u*u*a[1]+2*u*t*c[1]+t*t*b[1]]);}
      return result;
    };
    return poly([tl,tr,...arc(tr,br,rightX),br,bl,...arc(bl,tl,leftX)].map(point));
  };
  const tracedOuter=poly([...side(source.outerLeft.map(point)),...side(source.outerRight.map(point)).reverse()]);
  const oL=source.outerLeft,oR=source.outerRight,iL=source.innerLeft,iR=source.innerRight;
  const xs=(points,f)=>f(...points.map(p=>p[0]));
  let outer=bowed(oL[0],oR[0],oR.at(-1),oL.at(-1),xs(oR,Math.max),xs(oL,Math.min));
  // The short, flat attachment lands join the round rods to the slightly
  // sloping engraved bars without burying cylindrical end caps in the plate.
  for(const [i,sign] of [1,-1].entries()) {
    const end=rodRoots[i],inner=end-sign*.08;
    outer=clip.union(outer,poly([[-rodRadius,end],[rodRadius,end],[rodRadius,inner],[-rodRadius,inner]]));
  }
  const tracedHole=poly([...side(source.innerLeft.map(point)),...side(source.innerRight.map(point)).reverse()]);
  // The opening keeps Brown's straight rail edges but its sides must clear
  // the cam corners' horizontal sweep (the envelope reaches the largest
  // radius at mid-height), so each side is one gentle bow outside the
  // envelope, turned into the rail edges by small round corners.
  const envelope=triangularEccentricEnvelope(profile);
  const idealHole=(()=>{
    const [top,bottom]=[source.upperHoleY,source.lowerHoleY].map(y=>(originY-y)/100),mid=(top+bottom)/2;
    const reach=Math.max(...envelope.boundary.map(p=>Math.abs(p[0]))),bulge=reach+.05,corner=.12;
    const sideX=y=>bulge-.07*(y-mid)**2,points=[],steps=48;
    const yHigh=top-corner,yLow=bottom+corner;
    // Round corner between side point (x0, y0) and the rail edge at y1.
    const round=(x0,y0,y1,sign,fromEdge)=>{
      const cx=x0-sign*corner;
      for(let i=0;i<=12;i++){const a=Math.PI/2*(fromEdge?12-i:i)/12;points.push([cx+sign*corner*Math.cos(a),y0+(y1-y0)*Math.sin(a)]);}
    };
    for(const sign of [1,-1]) {
      const x=y=>sign*sideX(y),ys=sign>0?[yHigh,yLow]:[yLow,yHigh],edges=sign>0?[top,bottom]:[bottom,top];
      round(x(ys[0]),ys[0],edges[0],sign,true);
      for(let i=1;i<steps;i++){const y=ys[0]+(ys[1]-ys[0])*i/steps;points.push([x(y),y]);}
      round(x(ys[1]),ys[1],edges[1],sign,false);
    }
    return poly(points);
  })();
  const hole=clip.union(idealHole,poly(envelope.boundary));
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
    // Brown breaks the rods off at rodTips; the run on to the hidden guide is
    // a separate coaxial piece of the same rigid yoke (same total mass),
    // removed by source presentation with the guides it enters.
    for(const [name,ends] of [['rod'+i,[rodRoots[i],rodTips[i]]],['rodExtension'+i,[rodTips[i],sign*rodEnd]]]) {
      const rod=attach(name,disk(rodRadius,...ends.sort((a,b)=>a-b),96),'yoke',PALETTE.driven);rod.rotation.x=-Math.PI/2;
    }
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
  Object.assign(root.userData,{parts,families,blocks,source,profile,envelope,hideGround:true,profiles:{outer,hole,tracedHole,tracedOuter,idealHole,cam:outline},
    geometry:{originY,chordTolerance,depth,bodyDepth,clearance,bearingHalfSpacing,bearingHalfWidth,holeY,rodRoots,rodTips,rodRadius,rodEnd,guideHalfLength,guideCenter}});
  markShadows(root);root.updateMatrixWorld(true);
  return {root,focus:new THREE.Vector3(0,0,0),cameraDirection:new THREE.Vector3(.6,.3,10)};
}
