import {circle,poly,polygonClipping} from './finite-plate-geometry.js';

export function oldPumpVaneOutline(rotorRadius,length){
  const blade=polygonClipping.difference(polygonClipping.union(poly(circle([0,0],.19,96)),poly([[0,-.06],[length-.08,-.06],[length-.08,.06],[0,.06]])),poly(circle([0,0],.134,96)));
  const edge=Array.from({length:33},(_,i)=>{const y=-.09+.18*i/32;return[y<0?Math.sqrt((length-.0001)**2-y*y):Math.sqrt((rotorRadius+length-.0001)**2-y*y)-rotorRadius,y]});
  const lip=poly([...edge,...edge.map(([x,y])=>[x-.12,y]).reverse()]);
  return {blade,lip};
}
