import * as THREE from 'three';
import source from './source.js';
import {plate,poly,circle,disk,ring,polygonClipping as clip} from '../finite-plate-geometry.js';
import {PALETTE,matte,markShadows} from '../primitives.js';
export {THREE};
export function makeInclinedDiskGeometry({segments=192}={}) {
  const root=new THREE.Group(),parts={},families={},blocks={};
  const attach=(name,geometry,family,color,position=[0,0,0])=>{
    if(!blocks[family]){blocks[family]=new THREE.Group();root.add(blocks[family]);}
    const mesh=new THREE.Mesh(geometry,matte(color,{metalness:.14,roughness:.6}));
    mesh.name=name;mesh.position.fromArray(position);blocks[family].add(mesh);parts[name]=mesh;families[name]=family;return mesh;
  };
  const px=x=>x/100,x=v=>px(v-source.axis[0]),y=v=>px(source.axis[1]-v);
  const tilt=source.tilt,depth=px(source.diskThickness),half=depth/2,shaftRadius=px(source.shaftRadius);
  const radius=(x(source.diskRight)+half*Math.sin(tilt))/Math.cos(tilt),followerX=x(source.followerX);
  const rollerRadius=px(source.rollerRadius),rollerHalfWidth=px(source.rollerHalfWidth),pinRadius=.021;
  const cam=attach('disk',disk(radius,-half,half,segments),'input',PALETTE.driver);cam.rotation.set(-Math.PI/2,0,tilt,'ZYX');
  attach('shaft',disk(shaftRadius,y(source.shaftBottom),y(292),96),'input',PALETTE.ink).rotation.x=-Math.PI/2;
  // The bell hub terminates on the actual inclined underside. Each ring
  // interpolates from a flat lower neck to that plane; no overlapping cone.
  const vertices=[],indices=[],rings=12,count=96,bottom=y(292);
  for(let j=0;j<=rings;j++)for(let i=0;i<count;i++) {
    const t=j/rings,r=.22+.19*t*t,a=2*Math.PI*i/count,xx=r*Math.cos(a),z=r*Math.sin(a);
    vertices.push(xx,bottom*(1-t)+t*(-half/Math.cos(tilt)+xx*Math.tan(tilt)),z);
  }
  const lowerRing=vertices.length/3;vertices.push(...vertices.slice(0,count*3));
  const upperRing=vertices.length/3;vertices.push(...vertices.slice(rings*count*3,(rings+1)*count*3));
  const lower=vertices.length/3;vertices.push(0,bottom,0);const upper=vertices.length/3;vertices.push(0,-half/Math.cos(tilt),0);
  for(let j=0;j<rings;j++)for(let i=0;i<count;i++){const a=j*count+i,b=j*count+(i+1)%count,c=b+count,d=a+count;indices.push(a,d,b,b,d,c);}
  for(let i=0;i<count;i++){const k=(i+1)%count;indices.push(lower,lowerRing+i,lowerRing+k,upper,upperRing+k,upperRing+i);}
  const hub=new THREE.BufferGeometry();hub.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));hub.setIndex(indices);hub.computeVertexNormals();
  attach('hub',hub,'input',PALETTE.driver);
  // Source-facing fork cheeks lie on either side of a radial axle.
  const cheek=clip.difference(clip.union(poly(circle([0,-.055],.05,64)),poly([[-.05,-.055],[.05,-.055],[.05,.15],[-.05,.15]])),poly(circle([0,0],pinRadius+.001,64)));
  for(const [i,sign] of [-1,1].entries())attach('cheek'+i,plate(cheek,-.0225,.0225),'follower',PALETTE.driven,[sign*.085,0,0]).rotation.y=Math.PI/2;
  attach('forkBridge',plate(poly([[-.1075,.15],[-.0603,.225],[.0603,.225],[.1075,.15]]),-.05,.05),'follower',PALETTE.driven);
  attach('rod',disk(px(source.rodRadius),.225,px(source.rollerCenter[1]-source.rodTop),96),'follower',PALETTE.driven).rotation.x=-Math.PI/2;
  attach('axle',disk(pinRadius,-.16,.16,64),'follower',PALETTE.ink).rotation.y=Math.PI/2;
  for(const [i,sign] of [-1,1].entries())attach('axleHead'+i,disk(.039,-.012,.012,64),'follower',PALETTE.ink,[sign*.172,0,0]).rotation.y=Math.PI/2;
  attach('roller',ring(pinRadius+.001,rollerRadius,-rollerHalfWidth,rollerHalfWidth,segments),'roller',PALETTE.brass).rotation.y=Math.PI/2;
  const bearingProfile=clip.difference(clip.union(poly(circle([0,0],x(source.axis[0])-x(164),96)),poly([[0,-.26],[x(282),-.26],[x(282),.26],[0,.26]])),poly(circle([0,0],shaftRadius+.003,96)));
  attach('bearingBracket',plate(bearingProfile,y(373),y(319)),'frame',PALETTE.muted).rotation.x=-Math.PI/2;
  attach('wall',new THREE.BoxGeometry(x(477)-x(282),y(286)-y(510),.6),'frame',PALETTE.muted,[(x(477)+x(282))/2,(y(286)+y(510))/2,0]);
  attach('thrustCollar',ring(shaftRadius+.0015,.24,y(382),y(373)-.002,96),'input',PALETTE.driver).rotation.x=-Math.PI/2;
  for(const [i,yy] of [336,355].entries())attach('fastener'+i,disk(.045,.26,.29,6),'frame',PALETTE.ink,[x(263),y(yy),0]);
  const guideY=1,guideHalfLength=.08,rodRadius=px(source.rodRadius),backZ=-1.7,postX=1.95;
  const guideProfile=clip.difference(clip.union(poly(circle([0,0],.125,96)),poly([[-.05,0],[.05,0],[.05,-backZ],[-.05,-backZ]])),poly(circle([0,0],rodRadius+.003,96)));
  attach('guide',plate(guideProfile,-guideHalfLength,guideHalfLength),'frame',PALETTE.muted,[followerX,guideY,0]).rotation.x=-Math.PI/2;
  attach('upperBracket',new THREE.BoxGeometry(postX-followerX,.16,.12),'frame',PALETTE.muted,[(postX+followerX)/2,guideY,backZ]);
  attach('post',new THREE.BoxGeometry(.12,1.75,.12),'frame',PALETTE.muted,[postX,.205,backZ]);
  attach('lowerBracket',new THREE.BoxGeometry(.12,.12,-backZ-.3),'frame',PALETTE.muted,[postX,-.61,(backZ-.3)/2]);
  const expectedHeight=angle=>half/Math.cos(tilt)+followerX*Math.tan(tilt)*Math.cos(angle)+
    (rollerRadius*Math.sqrt(1-Math.sin(tilt)**2*Math.cos(angle)**2)+rollerHalfWidth*Math.abs(Math.sin(tilt)*Math.cos(angle)))/Math.cos(tilt);
  blocks.follower.position.set(followerX,expectedHeight(0),0);blocks.roller.position.copy(blocks.follower.position);
  Object.assign(root.userData,{parts,families,blocks,source,hideGround:true,expectedHeight,geometry:{tilt,depth,radius,shaftRadius,followerX,rollerRadius,rollerHalfWidth,pinRadius,segments,guideY,guideHalfLength,rodRadius,backZ,postX}});
  markShadows(root);root.updateMatrixWorld(true);
  return {root,focus:new THREE.Vector3(.5,-.3,0),cameraDirection:new THREE.Vector3(3,2,10)};
}
