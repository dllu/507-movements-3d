import {circle,poly,polygonClipping} from './finite-plate-geometry.js';

// Brown draws each valve as a curved leaf: a nearly straight trailing edge
// and a bellied leading edge that tapers into the sealing lip at the wall.
export function oldPumpVaneOutline(rotorRadius,length,belly=0.2){
  const reach=length-.08,count=48,top=[],bottom=[];
  for(let i=0;i<=count;i++){const s=i/count,x=reach*s;top.push([x,.05+.012*Math.sin(Math.PI*s)]);bottom.push([x,-.05-belly*Math.sin(Math.PI*s**1.7)**1.4]);}
  const leaf=poly([...bottom,...top.reverse()]);
  const blade=polygonClipping.difference(polygonClipping.union(poly(circle([0,0],.19,96)),leaf),poly(circle([0,0],.134,96)));
  const edge=Array.from({length:33},(_,i)=>{const y=-.09+.18*i/32;return[y<0?Math.sqrt((length-.0001)**2-y*y):Math.sqrt((rotorRadius+length-.0001)**2-y*y)-rotorRadius,y]});
  const lip=poly([...edge,...edge.map(([x,y])=>[x-.12,y]).reverse()]);
  return {blade,lip};
}
