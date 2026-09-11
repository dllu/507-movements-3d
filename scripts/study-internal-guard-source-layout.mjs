import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {circleFit} from './lib/source-circle-fit.mjs';
const file='artifacts/reference/brown-071-detail.png',source=await readFile(file),width=1480,height=1270;
const decoded=spawnSync('convert',[file,'-depth','8','rgb:-'],{maxBuffer:8*1024*1024});
if(decoded.status!==0||decoded.stdout.length!==width*height*3)throw new Error('Source decode failed');
const readCircle=(center,low,high,angles)=>{
  const points=[],missing=[];
  for(const degrees of angles){
    const angle=degrees*Math.PI/180;let start=null,end=null;
    for(let radius=low;radius<=high;radius+=.25){
      const x=Math.round(center[0]+radius*Math.cos(angle)),y=Math.round(center[1]-radius*Math.sin(angle));
      const dark=decoded.stdout[3*(width*y+x)]<100;
      if(dark&&start===null)start=radius;
      if(!dark&&start!==null){end=radius-.25;break;}
    }
    if(start===null||end===null){missing.push(degrees);continue;}
    const radius=(start+end)/2;points.push([center[0]+radius*Math.cos(angle),center[1]-radius*Math.sin(angle)]);
  }
  return{...circleFit(points),missing};
};
const output=readCircle([434,770],350,415,Array.from({length:47},(_,i)=>65+i*5));
const angles=Array.from({length:49},(_,i)=>-120+i*5);
const driverOuter=readCircle([907,716],390,440,angles),driverInnerSolid=readCircle([907,716],350,388,angles);
const studPoints=[[303,486],[490,462],[675,565],[745,744],[701,944],[539,1055],[361,1083],[194,965],[116,814],[149,604]];
const extraMark=[622,734],studOrbit=circleFit(studPoints);
const rimPoints=[[886,382],[982,390],[1097,442],[1177,525],[1229,625],[1244,734],[1227,831],
  [1181,921],[1113,999],[1012,1040],[904,1049],[791,1031],[696,969],[604,862],[576,758],[581,662],[615,562],[674,478],[772,411]];
const rim=circleFit(rimPoints);
const centerDistance=Math.hypot(driverOuter.center[0]-output.center[0],driverOuter.center[1]-output.center[1]);
const report={movement:71,status:'source-layout-diagnosis',productionChanged:false,
  source:{file,sha256:createHash('sha256').update(source).digest('hex'),pdfPage:26,printedPage:22,scaleTo:6000,crop:[3100,1180,width,height],inspected:true},
  method:'Visible-circle first dark-stroke radial midpoints; manual readings of the dotted inner guard and ten circular marks on the large output orbit. The extra circular mark is preserved separately because it lies far inside that orbit. This study does not decide its mechanical role or certify the source stud arrangement.',
  output,driverOuter,driverInnerSolid,rim,studOrbit,extraMark:{point:extraMark,distanceFromOutputCenter:Math.hypot(extraMark[0]-output.center[0],extraMark[1]-output.center[1]),mechanicalRole:'unresolved'},
  centerDistance,centerlineAngle:Math.atan2(output.center[1]-driverOuter.center[1],driverOuter.center[0]-output.center[0]),
  ratios:{driverOuterToOutput:driverOuter.radius/output.radius,driverInnerSolidToOutput:driverInnerSolid.radius/output.radius,
    dottedGuardToOutput:rim.radius/output.radius,orbitToOutput:studOrbit.radius/output.radius,centersToOutput:centerDistance/output.radius},
  animationAvailable:false,animationReviewed:false,
  unresolved:['The additional circular mark at (622,734) is not on the ten-mark outer orbit; its role must be resolved before reconstruction.',
    'B has an outer solid circle, a smaller solid circle and the dotted guard circle. Their physical depth and radius relationships need a coherent 3D interpretation.',
    'The source upper and lower notches have oblique straight edges; a replacement must test actual finite studs against those edges.']};
await writeFile('artifacts/review/071-source-layout-study.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
const marks=[...studPoints.map((point,i)=>({point,label:String(i+1),color:'#007fff'})),{point:extraMark,label:'X',color:'#ee0055'}]
  .map(({point,label,color})=>`<circle cx="${point[0]}" cy="${point[1]}" r="29" fill="none" stroke="${color}" stroke-width="3"/><text x="${point[0]+29}" y="${point[1]-22}" fill="${color}" font-size="29" font-family="sans-serif">${label}</text>`).join('');
await writeFile('artifacts/review/071-source-stud-readings.svg',`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}"><image xlink:href="data:image/png;base64,${source.toString('base64')}" width="${width}" height="${height}"/>${marks}</svg>`,{flag:'wx'});
console.log({output:{center:output.center,radius:output.radius,rms:output.rmsResidual,missing:output.missing},
  driverOuter:{center:driverOuter.center,radius:driverOuter.radius,rms:driverOuter.rmsResidual,missing:driverOuter.missing},
  driverInnerSolid:{center:driverInnerSolid.center,radius:driverInnerSolid.radius,rms:driverInnerSolid.rmsResidual,missing:driverInnerSolid.missing},
  rim:{center:rim.center,radius:rim.radius,rms:rim.rmsResidual},studOrbit:{center:studOrbit.center,radius:studOrbit.radius,rms:studOrbit.rmsResidual},
  ratios:report.ratios,extraMark:report.extraMark});
