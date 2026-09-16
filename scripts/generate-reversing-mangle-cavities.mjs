import * as THREE from 'three';
import {writeFile} from 'node:fs/promises';
import {createAuthoredGearMovement} from '../src/simulation/authored-gears.js';
import {mangleToothOutline} from '../src/simulation/mangle-gear-geometry.js';

const result={};
for(const id of [192,193]) {
  const model=createAuthoredGearMovement({id}),d=model.root.userData,g=d.geometry;
  const gear=d.blocks.pinion.userData.rotor.children[0];
  const first=d.stateAtInputTravel(-g.sourceRawPinionTravel);
  const segment=g.pitchSegments[0];
  const cutterStart=segment.startAngle+(segment.sweep<0?Math.PI:0)+Math.PI;
  const phase=first.pinionAngle-first.wheelAngle-cutterStart;
  const outline=gear.geometry.parameters.shapes.getPoints();
  // The existing cutter indexes its polar outline uniformly. Resample the
  // visible involute, retaining the factory's actual relative pinion phase.
  const pinionOutline=Array.from({length:2048},(_,i)=>{
    const angle=i*Math.PI*2/2048,ray=new THREE.Vector2(Math.cos(angle-phase),Math.sin(angle-phase));
    let radius=Infinity;
    for(let k=0;k<outline.length-1;k++) {
      const a=outline[k],edge=outline[k+1].clone().sub(a),den=ray.cross(edge);
      if(Math.abs(den)<1e-12)continue;
      const r=a.cross(edge)/den,u=a.cross(ray)/den;
      if(r>0&&u>=0&&u<=1)radius=Math.min(radius,r);
    }
    if(!Number.isFinite(radius))throw new Error('Pinion polar outline is not closed');
    return new THREE.Vector2(Math.cos(angle)*radius,Math.sin(angle)*radius);
  });
  const cut=mangleToothOutline({pinionOutline,pinionRadius:g.pinionPitchRadius,module:g.module,
    segments:g.pitchSegments,teeth:g.mangleTeeth},{regenerate:true});
  const finishingAllowance=.0003;
  const points=cut.points.map((p,i)=>{
    const s=d.stateAtPitchDistance(cut.perimeter*i/cut.points.length);
    return p.clone().addScaledVector(s.rightNormal,-finishingAllowance).toArray().map(x=>Math.round(x*1e9)/1e9);
  });
  result[id]={points,finishingAllowance,cutterClearance:cut.clearance,phase,samples:cut.count};
  console.log({id,points:points.length,phase});
}
await writeFile(new URL('../src/simulation/baked/reversing-mangle-cavities.js',import.meta.url),
  `// Generated offline by scripts/generate-reversing-mangle-cavities.mjs.\nexport default ${JSON.stringify(result)};\n`);
