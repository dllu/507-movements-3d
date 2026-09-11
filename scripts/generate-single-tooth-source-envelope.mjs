import { writeFile } from 'node:fs/promises';
import clipping from 'polygon-clipping';
import { makeSingleToothSourceDriver } from './lib/single-tooth-source-driver.mjs';
import { singleToothIndexParameters, makeSingleToothIndexMotion } from './lib/single-tooth-index-motion.mjs';

const suffix = process.env.CANDIDATE_SUFFIX ?? 'source-envelope';
const steps = Number(process.env.ENVELOPE_STEPS ?? 1024);
const p = singleToothIndexParameters({ sourceAngle: Math.PI/4, outputRadius: 1.417,
  indexLaw: 'constant-ratio', halfIndex: Math.PI/10 });
const motion = makeSingleToothIndexMotion(p), driver = makeSingleToothSourceDriver();
const snap = x=>Math.round(x*1e9)/1e9;
const quantize = multi=>multi.map(poly=>poly.map(ring=>ring.map(q=>q.map(snap))));
const rotate = (polygon,a,offset=[0,0]) => polygon.map(ring => ring.map(([x,y]) => [
  snap(x*Math.cos(a)-y*Math.sin(a)+offset[0]), snap(x*Math.sin(a)+y*Math.cos(a)+offset[1])]));
const circle = (x,y,r,n=2560) => [Array.from({length:n},(_,i)=>[snap(x+r*Math.cos(2*Math.PI*i/n)),snap(y+r*Math.sin(2*Math.PI*i/n))])];
// First construct one indexed sector. Its full finite driver sweep also checks
// clearance of the relieved disc during indexing, not only its tooth tip.
let sector = clipping.difference(circle(0,0,p.outputRadius),
  ...[-p.halfPitch,p.halfPitch].map(a=>rotate(circle(-p.centerDistance,0,p.driverRadius+p.clearance),a)));
for(let i=0;i<=steps;i++) {
  const angle=-0.75+1.5*i/steps, state=motion.atTime((p.sourceAngle-angle)/p.driverSpeed);
  const cutter=rotate(rotate(driver,angle,[-p.centerDistance,0]),-state.outputAngle);
  sector=clipping.difference(sector,cutter);
  if(sector.length!==1)throw new Error(`Disconnected output at phase ${i}`);
}
let output=quantize(sector);
for(let i=1;i<p.notches;i++) {
  console.log({repeat:i,vertices:output[0][0].length});
  output=quantize(clipping.intersection(output,sector.map(poly=>rotate(poly,i*p.pitch))));
}
if(output.length!==1)throw new Error('Repeated cutter disconnected wheel');
const result={movement:68,status:'isolated-source-envelope-candidate',parameters:p,driver,output:output[0],steps,
  method:'Own Bezier tracing of the public-domain Brown tooth, fitted circle, constant-ratio trial law. Complete finite driver envelope including approach/departure; tenfold repetition. No force/contact or convergence acceptance yet. Tooth envelope has zero nominal clearance and must be audited before integration.'};
await writeFile(`artifacts/review/068-${suffix}.json`,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
await writeFile(`scripts/lib/single-tooth-${suffix}-profile.mjs`,'// Isolated source-traced tooth candidate.\nexport default '+JSON.stringify({parameters:p,driver,output:output[0]})+';\n',{flag:'wx'});
console.log({driverVertices:driver[0].length,outputVertices:output[0][0].length,holes:output[0].length-1,steps});
