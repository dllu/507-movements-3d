import {sourceLeaf} from './source.js';

export function returnLeafAssembly({segments,tailSegments,EI,viscosity,mass}){
 const source=sourceLeaf({segments,tailSegments}),points=source.points,lengths=points.slice(1).map((p,i)=>p.distanceTo(points[i])),angles=points.slice(1).map((p,i)=>Math.atan2(p.y-points[i].y,p.x-points[i].x));
 let bodies='';
 for(let i=0;i<lengths.length;i++){
  const angle=angles[i]-(i?angles[i-1]:0),pos=i?`${lengths[i-1]} 0 0`:points[0].toArray().join(' '),dual=i?(lengths[i-1]+lengths[i])/2:1;
  bodies+=`<body name="leaf-${i}" pos="${pos}" euler="0 0 ${angle}">${i?`<joint name="bend-${i}" axis="0 0 1" stiffness="${EI/dual}" damping="${viscosity/dual}" springref="0"/>`:''}<geom type="box" pos="${lengths[i]/2} 0 0" size="${lengths[i]/2} .015 .06" mass="${mass*lengths[i]/source.length}"/><site name="end-${i}" pos="${lengths[i]} 0 0"/>`;
  if(i===source.eyeIndex-1){const d=source.tie.clone().sub(points[i]),c=Math.cos(angles[i]),s=Math.sin(angles[i]);bodies+=`<site name="tie" pos="${c*d.x+s*d.y} ${-s*d.x+c*d.y} 0"/>`;}
 }
 bodies+='</body>'.repeat(lengths.length);
 return {source,points,lengths,bodies};
}
