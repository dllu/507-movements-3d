import{readFile,writeFile}from'node:fs/promises';
import{spawnSync}from'node:child_process';
import{createHash}from'node:crypto';
import{circleFit}from'./lib/source-circle-fit.mjs';
const file='artifacts/reference/brown-072-detail.png',source=await readFile(file),width=1910,height=1260;
const decoded=spawnSync('convert',[file,'-depth','8','rgb:-'],{maxBuffer:9*1024*1024});
if(decoded.status!==0||decoded.stdout.length!==width*height*3)throw new Error('Invalid source decode');
const readRays=(center,low,high,angles)=>{
  const points=[],missing=[];
  for(const degrees of angles){const angle=degrees*Math.PI/180;let start=null,end=null;
    for(let radius=low;radius<=high;radius+=.25){
      const x=Math.round(center[0]+radius*Math.cos(angle)),y=Math.round(center[1]-radius*Math.sin(angle));
      const dark=decoded.stdout[3*(width*y+x)]<100;
      if(dark&&start===null)start=radius;
      if(!dark&&start!==null){end=radius-.25;break;}
    }
    if(start===null||end===null){missing.push(degrees);continue;}
    const radius=(start+end)/2;points.push([center[0]+radius*Math.cos(angle),center[1]-radius*Math.sin(angle)]);
  }
  return{points,missing};
};
const hubRead=readRays([919,816],55,76,Array.from({length:36},(_,i)=>i*10)),hub=circleFit(hubRead.points);
const flankRead=readRays(hub.center,98,238,Array.from({length:44},(_,i)=>2+i*2)),flank=circleFit(flankRead.points);
const report={movement:72,status:'source-geometry-study',productionChanged:false,
 source:{file,sha256:createHash('sha256').update(source).digest('hex'),width,height,pdfPage:26,printedPage:22,scaleTo:6000,crop:[910,2580,width,height],inspected:true},
 method:'First dark radial-stroke midpoints on the input hub and unobstructed upper-right cam flank. Fit a circle to the flank without forcing its center to the shaft. A circular-flank interpretation must still be compared with the complete source and tested mechanically.',
 hub:{...hub,missing:hubRead.missing},flank:{...flank,missing:flankRead.missing},
 tipReadings:[[913,610],[1130,814],[914,1015],[708,810]],
 follower:{center:[907,582],radius:27,method:'Approximate manual reading of the rounded bottom nose, not a rotating roller.'},
 pivot:{center:[1505,725],radius:50,method:'Approximate manual reading of the rounded pivot foot in its socket.'},
 animationAvailable:false,animationReviewed:false};
await writeFile('artifacts/review/072-source-geometry-study.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({hub:{center:hub.center,radius:hub.radius,rms:hub.rmsResidual,missing:hubRead.missing},
 flank:{center:flank.center,radius:flank.radius,rms:flank.rmsResidual,missing:flankRead.missing},offset:flank.center.map((v,i)=>v-hub.center[i])});
