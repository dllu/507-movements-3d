import fs from 'node:fs';
import source from './lib/treadle-ratchet-source.mjs';
import {makeTreadleRatchetLinkage,treadleSourcePoint} from './lib/treadle-ratchet-linkage.mjs';
const model=makeTreadleRatchetLinkage(),p=model.parameters,rows=[],initial=model.atTime(0),
 errors={strapLength:0,rodLength:0,sourceJointPixels:0,sourceStrapPixels:0,repeat:0},range={front:[Infinity,-Infinity],rear:[Infinity,-Infinity],contactX:[Infinity,-Infinity],arm:[]};
for(const [name,target] of [['front',source.lowerStrapPin],['rear',source.upperStrapPin]])
 errors.sourceStrapPixels=Math.max(errors.sourceStrapPixels,Math.hypot(...initial.cable[name].map((v,j)=>v-treadleSourcePoint(target)[j]))*source.scale);
for(const [i,name] of ['lower','upper'].entries())for(const [part,target] of [['top',source.circles[name+'RodTop'].center],['bottom',source[name+'RodBottom']],['pawlPivot',source.circles[name+'PawlPivot'].center]])
 errors.sourceJointPixels=Math.max(errors.sourceJointPixels,Math.hypot(...initial.arms[i][part].map((v,j)=>v-treadleSourcePoint(target)[j]))*source.scale);
for(let i=0;i<=1024;i++){
 const t=i*p.period/1024,s=model.atTime(t),repeat=model.atTime(t+p.period);
 errors.strapLength=Math.max(errors.strapLength,Math.abs(s.cable.length-p.targetLength));
 errors.repeat=Math.max(errors.repeat,Math.abs(s.frontAngle-repeat.frontAngle),Math.abs(s.rearAngle-repeat.rearAngle));
 for(const [name,v] of [['front',s.frontAngle],['rear',s.rearAngle]]){range[name][0]=Math.min(range[name][0],v);range[name][1]=Math.max(range[name][1],v);}
 for(const x of s.cable.contactX){range.contactX[0]=Math.min(range.contactX[0],x);range.contactX[1]=Math.max(range.contactX[1],x);}
 for(let j=0;j<2;j++){const a=s.arms[j];errors.rodLength=Math.max(errors.rodLength,Math.abs(a.rodLength-p.arms[j].rodLength));
  range.arm[j]??=[Infinity,-Infinity];range.arm[j][0]=Math.min(range.arm[j][0],a.armAngle);range.arm[j][1]=Math.max(range.arm[j][1],a.armAngle);}
 if(i%128===0)rows.push({time:t,state:s});
}
const width=(source.pulley.axialEdges[1]-source.pulley.axialEdges[0])/source.scale,strapWidth=20/source.scale,
 edgeMargin=width/2-strapWidth/2-Math.max(...range.contactX.map(x=>Math.abs(x-p.pulley[0]))),
 report={movement:82,status:'geometric-linkage-study',passed:errors.strapLength<1e-12&&errors.rodLength<1e-12&&errors.sourceJointPixels<1e-8&&edgeMargin>0,
 poses:1025,errors,range,pulleyFaceMarginPixels:edgeMargin*source.scale,axialDriftPixels:(range.contactX[1]-range.contactX[0])*source.scale,
 parameters:p,rows,qualification:model.qualification};
fs.writeFileSync('artifacts/review/082-linkage-study.json',JSON.stringify(report,null,2)+'\n');console.log({...report,rows:undefined,parameters:undefined});if(!report.passed)process.exitCode=1;
