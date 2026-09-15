import fs from 'node:fs';
import crypto from 'node:crypto';
import {makeSilkTraverseGears} from '../src/simulation/silk-traverse-gears.js';
import {silkTraverseDimensions as source} from '../src/data/silk-traverse-dimensions.js';
import {polygonClipping as clip} from '../src/simulation/finite-plate-geometry.js';
const g=makeSilkTraverseGears(),outline=mesh=>mesh.userData.outline.map(p=>p.toArray());
const transform=(points,angle,center=[0,0])=>[[points.map(([x,y])=>[center[0]+x*Math.cos(angle)-y*Math.sin(angle),center[1]+x*Math.sin(angle)+y*Math.cos(angle)])]];
const area=p=>p.reduce((sum,p)=>sum+p.reduce((sum,r,k)=>{let a=0;for(let i=0;i<r.length;i++){const q=r[(i+1)%r.length];a+=r[i][0]*q[1]-q[0]*r[i][1];}return sum+(k===0?1:-1)*Math.abs(a)/2;},0),0);
try{
 const sun=outline(g.sun),planet=outline(g.planet),fixed=transform(sun,g.sunPhase);let maximumArea=0,interferingPoses=0;
 for(let i=0;i<720;i++){
  const angle=(i+.371)*6*Math.PI/720,c=Math.cos(angle),s=Math.sin(angle),center=[g.orbit[0]*c-g.orbit[1]*s,g.orbit[0]*s+g.orbit[1]*c];
  const overlap=area(clip.intersection(fixed,transform(planet,g.planetPhase+(1+g.ratio)*angle,center)));
  maximumArea=Math.max(maximumArea,overlap);if(overlap>1e-12)interferingPoses++;
 }
 const report={sunTeeth:source.sunTeeth,planetTeeth:source.planetTeeth,module:g.module,orbit:g.orbit,profileShifts:[.6,-.6],dedenda:[1.02,1],cutterTipRadiusInModules:.05,sunOuterRadiusPixels:Math.max(...sun.map(p=>Math.hypot(...p)))*100,planetOuterRadiusPixels:Math.max(...planet.map(p=>Math.hypot(...p)))*100,sunRootRadiusPixels:g.sun.userData.rootRadius*100,measuredOuterRadii:[source.sunOuterRadius,source.planetOuterRadius],relativePlanetTurnsPerCarrierTurn:g.ratio,carrierTurnsPerModulation:1/g.ratio,samples:720,interferingPoses,maximumIntersectionArea:maximumArea,sources:['src/data/silk-traverse-dimensions.js','src/simulation/silk-traverse-gears.js','src/simulation/coaxial-gear-geometry.js','scripts/prototype-silk-traverse-gears.mjs'].map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync('docs/validation/142-gear-prototype.json',JSON.stringify(report,null,2)+'\n');console.log(report);
 fs.writeFileSync('/dev/shm/142-gear-profile.json',JSON.stringify({...report,sun,planet,sunPhase:g.sunPhase,planetPhase:g.planetPhase}));
}finally{g.sun.dispose();g.planet.dispose();}
