import * as THREE from 'three';
import {poly,circle,polygonClipping as clip} from '../finite-plate-geometry.js';
import {fitDiagonalHandle} from './handle-fit.js';

// Outer boundary traced from plate 181, registered at the catch pivot. The
// rounded head is a compromise between both plates, whose radial dimensions
// differ. Keep the upper holding ledge at its qualified source-181 coordinates.
// The two catching faces belong to this continuous plate, not circular sockets.
export function diagonalCatchProfile() {
 const headLandmarks={lip:[203,117],leftShoulder:[179,117]};
 const path=new THREE.Shape();
 path.moveTo(...headLandmarks.lip);
 path.bezierCurveTo(200,132,180,130,...headLandmarks.leftShoulder);
 path.bezierCurveTo(177,100,199,92,212,103);
 path.bezierCurveTo(216,108,213,113,217,120);
 path.lineTo(211,126);
 path.bezierCurveTo(211,145,224,161,235,174);
 path.bezierCurveTo(242,190,251,197,268,194);
 path.bezierCurveTo(289,191,304,208,306,226);
 path.bezierCurveTo(308,244,321,259,341,281);
 path.bezierCurveTo(359,300,371,322,373,343);
 path.lineTo(374,354);
 path.lineTo(365,352);
 path.lineTo(363,333);
 path.quadraticCurveTo(355,339,350,337);
 path.quadraticCurveTo(354,319,344,305);
 path.bezierCurveTo(329,281,301,258,277,259);
 path.bezierCurveTo(254,267,235,254,232,234);
 path.bezierCurveTo(229,214,218,196,207,182);
 path.bezierCurveTo(197,168,205,143,...headLandmarks.lip);
 path.closePath();
 const raster=path.getPoints(12).map(p=>[p.x,p.y]);
 const outline=poly(raster.map(([x,y])=>[(x-271)*.0125,(234-y)*.0125]));
 return {raster,headLandmarks,polygons:clip.difference(outline,poly(circle([0,0],.12,96)))};
}

// Registered faces compensate for the fitted handle axes and finite shoe
// clearance: upper holding face 3 px higher, lower heel 6 px right/5 px up.
// Keep the unregistered trace available as the failed control reconstruction.
export function diagonalLatchFinger(side,{registered=true}={}) {
 const fit=fitDiagonalHandle(side),angle=side==='upper'?0:fit.angle;
 const raster=side==='upper'
  ? [[218,122],[229,127],[233,143],[222,148],[registered?211:213,registered?129:127]].map(([x,y])=>[x,y-(registered?3:0)])
  : [[326,296],[329,288],[332,307],[331,320],[323,321],[320,312]];
 const points=raster.map(([x,y])=>[(x-271)*.0125-fit.pivot[0],(234-y)*.0125-fit.pivot[1]]);
 let polygons=poly(points),heelRaster=null;
 if(side==='lower'){
  const c=Math.cos(-angle),s=Math.sin(-angle);
  heelRaster=[[350,340],[348,349],[333,349],[335,340],[342,339]].map(([x,y])=>[x+(registered?6:0),y-(registered?5:0)]);
  const heel=heelRaster.map(([x,y])=>{const dx=(x-271)*.0125-fit.pivot[0],dy=(234-y)*.0125-fit.pivot[1];return[dx*c-dy*s,dx*s+dy*c];});
  polygons=clip.union(polygons,poly(heel));
 }
 return {raster,heelRaster,points,polygons,fit,angle,registered};
}
