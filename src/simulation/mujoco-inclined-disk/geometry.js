import * as THREE from 'three';
import source from './source.js';
import {plate,poly,circle,disk,ring,polygonClipping as clip} from '../finite-plate-geometry.js';
import {PALETTE,matte,markShadows} from '../primitives.js';
import {wallGuide} from '../wall-guide-hardware.js';
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
  attach('axle',disk(pinRadius,-.16,.16,64),'follower',PALETTE.ink).rotation.y=Math.PI/2;
  for(const [i,sign] of [-1,1].entries())attach('axleHead'+i,disk(.039,-.012,.012,64),'follower',PALETTE.ink,[sign*.172,0,0]).rotation.y=Math.PI/2;
  attach('roller',ring(pinRadius+.001,rollerRadius,-rollerHalfWidth,rollerHalfWidth,segments),'roller',PALETTE.brass).rotation.y=Math.PI/2;
  const bearingProfile=clip.difference(clip.union(poly(circle([0,0],x(source.axis[0])-x(164),96)),poly([[0,-.26],[x(282),-.26],[x(282),.26],[0,.26]])),poly(circle([0,0],shaftRadius+.003,96)));
  attach('bearingBracket',plate(bearingProfile,y(373),y(319)),'frame',PALETTE.muted).rotation.x=-Math.PI/2;
  // Brown's wall corner is a section; the wall runs back behind the disk
  // (its depth is inferred) far enough to carry the rod guide's post.
  const wallBack=-1.35,wallFront=.3;
  attach('wall',new THREE.BoxGeometry(x(477)-x(282),y(286)-y(510),wallFront-wallBack),'frame',PALETTE.muted,[(x(477)+x(282))/2,(y(286)+y(510))/2,(wallFront+wallBack)/2]);
  // Brown draws the wall as a hatched corner section; the model shows the
  // plain solid wall (hatching is engraving notation).
  attach('thrustCollar',ring(shaftRadius+.0015,.24,y(382),y(373)-.002,96),'input',PALETTE.driver).rotation.x=-Math.PI/2;
  for(const [i,yy] of [336,355].entries())attach('fastener'+i,disk(.045,.26,.29,6),'frame',PALETTE.ink,[x(263),y(yy),0]);
  // The rod runs on past Brown's crop into a fixed guide just above the
  // plate's top edge. A narrow web carries the guide back to a slender post
  // standing on the wall top behind the disk, directly behind the rod (and
  // narrower than it), so the rod hides the post in the plate's view.
  const guideHalfLength=.08,rodRadius=px(source.rodRadius),plateTop=y(0),guideY=plateTop+.18;
  const postWidth=.1,postFront=-1.15,backZ=postFront-postWidth,wallTop=y(286);
  for(const mesh of wallGuide({name:'guide',axis:'y',halfLength:guideHalfLength,boreRadius:rodRadius+.003,outerRadius:.125,zWall:postFront}))
    attach(mesh.name,mesh.geometry,'frame',PALETTE.muted,[followerX+mesh.position.x,guideY+mesh.position.y,mesh.position.z]).rotation.copy(mesh.rotation);
  attach('guidePost',new THREE.BoxGeometry(postWidth,guideY+guideHalfLength-wallTop,postWidth),'frame',PALETTE.muted,
    [followerX,(guideY+guideHalfLength+wallTop)/2,postFront-postWidth/2]);
  const expectedHeight=angle=>half/Math.cos(tilt)+followerX*Math.tan(tilt)*Math.cos(angle)+
    (rollerRadius*Math.sqrt(1-Math.sin(tilt)**2*Math.cos(angle)**2)+rollerHalfWidth*Math.abs(Math.sin(tilt)*Math.cos(angle)))/Math.cos(tilt);
  // Long enough to stay in the guide at the lowest follower position.
  let minimumHeight=Infinity;for(let i=0;i<720;i++)minimumHeight=Math.min(minimumHeight,expectedHeight(2*Math.PI*i/720));
  const rodTop=guideY+guideHalfLength+.06-minimumHeight,drawnRodTop=px(source.rollerCenter[1]-source.rodTop);
  const rod=attach('rod',disk(rodRadius,.225,drawnRodTop,96),'follower',PALETTE.driven);rod.rotation.x=-Math.PI/2;
  // The coaxial run past Brown's crop rides on the drawn rod as a child
  // mesh: it moves with the follower but, like the fixed guide, is kept out
  // of the native mass so the validated dynamics are unchanged.
  const rodExtension=new THREE.Mesh(disk(rodRadius,drawnRodTop,rodTop,96),rod.material);
  rodExtension.name='rodExtension';rodExtension.userData.role='rodExtension';rodExtension.userData.beyondPlateCrop=true;rod.add(rodExtension);
  for(const name of ['guide','guideWeb','guidePost'])parts[name].userData.beyondPlateCrop=true;
  blocks.follower.position.set(followerX,expectedHeight(0),0);blocks.roller.position.copy(blocks.follower.position);
  Object.assign(root.userData,{parts,families,blocks,source,hideGround:true,expectedHeight,geometry:{tilt,depth,radius,shaftRadius,followerX,rollerRadius,rollerHalfWidth,pinRadius,segments,guideY,guideHalfLength,rodRadius,rodTop,backZ,plateTop}});
  markShadows(root);root.updateMatrixWorld(true);
  return {root,focus:new THREE.Vector3(.5,-.3,0),cameraDirection:new THREE.Vector3(3,2,10)};
}
