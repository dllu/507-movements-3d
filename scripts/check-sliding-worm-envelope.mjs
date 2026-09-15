import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {Vector3} from 'three';
const file='/dev/shm/143-refined-profile.json',{parameters:p,profile:c}=JSON.parse(fs.readFileSync(file));
const module=2*p.pitchRadius/p.teeth,lead=module/2,axialPitch=Math.PI*module,distance=p.pitchRadius+p.wormPitchRadius,tangent=Math.tan(p.pressureAngle);
const rows=[];let excluded=0;
for(let j=0;j<=c.axialSteps;j++)for(let i=0;i<c.angularSteps;i++){
 const k=j*(c.angularSteps+1)+i,radius=c.radii[k]+c.clearance,theta=-Math.PI/p.teeth+2*Math.PI/p.teeth*i/c.angularSteps,phase=c.generatingPhases[k];
 const q=new Vector3(-radius*Math.sin(theta+phase),radius*Math.cos(theta+phase),p.depth*(j/c.axialSteps-.5)),y=q.y-distance,z=q.z,r=Math.hypot(y,z);
 // Only regular working-flank points: exclude uncut blank, root relief,
 // cutter tip extension, and the finite worm's axial end boundary.
 if(radius>=p.pitchRadius+module-1e-7||r<=p.wormPitchRadius-1.25*module+1e-6||r>=p.wormPitchRadius+module-1e-6||Math.abs(q.x)>=p.wormLength/2-1e-6){excluded++;continue;}
 const angle=Math.atan2(y,-z)+Math.PI/2-p.teeth*phase;
 const unwrapped=q.x-lead*angle,s=unwrapped-axialPitch*Math.floor(unwrapped/axialPitch+.5),sign=Math.sign(s);
 const normal=new Vector3(sign,tangent*y/r+sign*lead*z/(r*r),tangent*z/r-sign*lead*y/(r*r)).normalize();
 const output=q.clone().cross(normal).z,input=q.clone().sub(new Vector3(0,distance,0)).cross(normal.clone().negate()).x;
 const equationError=Math.abs(Math.abs(s)+(r-p.wormPitchRadius)*tangent-axialPitch/4);
 const residual=Math.abs(input+output/p.teeth)/Math.max(Math.abs(input),Math.abs(output/p.teeth));
 rows.push({axial:j,angular:i,phase,equationError,residual,output});
}
const report={movement:143,method:'Analytic axial-worm flank normal at each stored generating phase and unrelieved generating radius. Compares input/output normal-force power at the nominal 22:1 ratio. Excludes cutter-tip/root/end boundaries and uncut blank. This checks regular generating-envelope points, not every triangle or loaded backlash motion.',sources:[file,'scripts/check-sliding-worm-envelope.mjs','src/simulation/worm-wheel-profile.js'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')})),summary:{samples:rows.length,excluded,maximumEquationError:Math.max(...rows.map(r=>r.equationError)),maximumPowerResidual:Math.max(...rows.map(r=>r.residual)),overTwoPercent:rows.filter(r=>r.residual>.02).length},worst:rows.sort((a,b)=>b.residual-a.residual).slice(0,20)};
fs.writeFileSync('docs/validation/143-envelope.json',JSON.stringify(report,null,2)+'\n');console.log(report.summary);
