import * as THREE from 'three';
// Top-view tracing of the upper jaw; the lower outline is approximately
// reflected in the board centerline, with its separately measured pivot.
export function benchClampProfile(side) {
 const path=new THREE.Shape();path.moveTo(38,309);
 path.bezierCurveTo(20,318,27,288,50,253);
 path.bezierCurveTo(90,198,170,143,231,121);
 path.bezierCurveTo(313,95,382,111,412,128);
 path.bezierCurveTo(449,148,464,185,447,211);
 path.bezierCurveTo(435,235,403,240,382,227);
 path.bezierCurveTo(371,218,367,206,366,190);
 path.bezierCurveTo(338,196,318,212,282,215);
 path.bezierCurveTo(223,213,194,205,139,227);
 path.bezierCurveTo(98,244,68,274,47,302);
 path.bezierCurveTo(43,308,40,310,38,309);path.closePath();
 const pivot=side===0?[268,166]:[274,359],scale=.012;
 const raster=path.getPoints(16).slice(0,-1).map(p=>side===0?[p.x,p.y]:[p.x+3,528-p.y]);
 const points=raster.map(p=>new THREE.Vector2((p[0]-pivot[0])*scale,(pivot[1]-p[1])*scale));
 const triangles=THREE.ShapeUtils.triangulateShape(points,[]);
 return {pivot:[(pivot[0]-123)*scale,(264-pivot[1])*scale],points,triangles,raster};
}
