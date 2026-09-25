import {replaceWithLaidRope} from '../laid-rope.js';
import {PALETTE} from '../primitives.js';
import {AxiallySeparatedBand} from '../axially-separated-band.js';
import {ReturnBandRoute} from './band-route.js';

// Shared by the offline factory and baked player; no rigid geometry generation.
export function makeSpringTreadleUpdater(root,{widths,pivot=[-2.862,-2.898]}){
 const blocks={treadle:root.getObjectByName('body:treadle'),pulley:root.getObjectByName('body:pulley')},upperAnchor={stem:root.getObjectByName('springAnchorStem'),head:root.getObjectByName('springAnchorHead')},springGeometry=root.getObjectByName('leaf').geometry,positions=springGeometry.attributes.position.array,n=widths.length,band=root.getObjectByName('band');
 // Brown hatches the band as a laid rope: the shared three-strand rope, its
 // lay fixed in the material from the spring end.
 band.material.color.set(PALETTE.belt);
 const update=s=>{
  if(s.leafPoints.length!==n)throw new RangeError('Spring state resolution differs from visible geometry');
  blocks.treadle.position.set(...pivot,0);blocks.treadle.rotation.z=s.treadle;
  blocks.pulley.rotation.z=s.rotorPhase;
  for(const m of [upperAnchor.stem,upperAnchor.head]){m.position.x=s.upper[0];m.position.y=s.upper[1];}
  for(let i=0;i<n;i++){
   const before=s.leafPoints[Math.max(0,i-1)],after=s.leafPoints[Math.min(n-1,i+1)],dx=after[0]-before[0],dy=after[1]-before[1],l=Math.hypot(dx,dy),nx=-dy/l,ny=dx/l,p=s.leafPoints[i],h=widths[i]/2;
   positions.set([p[0]+nx*h,p[1]+ny*h,.03,p[0]-nx*h,p[1]-ny*h,.03,p[0]+nx*h,p[1]+ny*h,-.15,p[0]-nx*h,p[1]-ny*h,-.15],i*12);
  }
  springGeometry.attributes.position.needsUpdate=true;springGeometry.computeVertexNormals();springGeometry.computeBoundingBox();springGeometry.computeBoundingSphere();
  const curve=new AxiallySeparatedBand(new ReturnBandRoute(s.upper,s.lower),{startZ:.24,endZ:.72});replaceWithLaidRope(band,curve,{radius:.048,tubularSegments:384});
  root.userData.state=s;root.userData.bandCurve=curve;root.updateMatrixWorld(true);
 };
 return update;
}
