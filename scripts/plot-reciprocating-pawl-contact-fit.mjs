import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {makeReciprocatingPawlStudy,reciprocatingPawlSource,pawlSourcePoint} from './lib/reciprocating-pawl-contact-study.mjs';

const sourceFile='artifacts/reference/brown-075-detail.png',source=await readFile(sourceFile),
  readings=JSON.parse(await readFile('artifacts/review/075-reviewed-source-tips.json','utf8')),
  {center,scale}=reciprocatingPawlSource,
  pixel=p=>[center[0]+scale*p[0],center[1]-scale*p[1]],
  rotate=(p,a)=>[p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a)],rows=[];
for(const teeth of [33,34]){
  const study=makeReciprocatingPawlStudy({teeth,faceAngle:.06,sourcePoseGravity:true}),state=study.atPhase(study.parameters.sourcePhase),
    profile=study.points.map(p=>pixel(rotate(p,state.wheelAngle))),
    tips=Array.from({length:teeth},(_,i)=>pixel([Math.cos(state.wheelAngle+.06+i*study.parameters.pitch),Math.sin(state.wheelAngle+.06+i*study.parameters.pitch)])),
    errors=readings.tipReadings.filter(p=>p.point).map(({index,point})=>{
      const distances=tips.map(p=>Math.hypot(p[0]-point[0],p[1]-point[1])),distance=Math.min(...distances);
      return{index,point,distance,nearestTip:distances.indexOf(distance)};
    }),noseB=pixel(state.B.center),noseH=pixel(state.H.center),
    noseErrorB=Math.hypot(...noseB.map((v,i)=>v-reciprocatingPawlSource.movingNose[i])),
    noseErrorH=Math.hypot(...noseH.map((v,i)=>v-reciprocatingPawlSource.holdingNose[i]));
  const circles=tips.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="#0077e6"/>`).join(''),
    noses=[noseB,noseH].map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="${study.parameters.noseRadius*scale}" fill="none" stroke="#eb243c" stroke-width="3"/>`).join(''),
    svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1250" height="1360" viewBox="0 0 1250 1360">
<image width="1250" height="1360" xlink:href="data:image/png;base64,${source.toString('base64')}"/>
<path d="M${profile.map(p=>p.join(',')).join('L')}Z" fill="none" stroke="#0077e6" stroke-width="2.4"/>
${circles}${noses}<rect x="40" y="1230" width="1160" height="90" fill="white" opacity=".93"/>
<text x="60" y="1266" font-family="DejaVu Sans" font-size="25">Isolated contact study: ${teeth} teeth, root 0.87, face angle 0.06 rad</text>
<text x="60" y="1302" font-family="DejaVu Sans" font-size="22">Blue: wheel profile. Red: finite nose circles. No production change.</text></svg>`;
  const file=`artifacts/review/075-contact-fit-${teeth}.svg`;
  await writeFile(file,svg,{flag:'wx'});
  rows.push({teeth,file,parameters:study.parameters,noseB,noseH,noseErrorB,noseErrorH,
    tipRms:Math.sqrt(errors.reduce((a,b)=>a+b.distance**2,0)/errors.length),tipMaximum:Math.max(...errors.map(x=>x.distance)),errors});
}
await writeFile('artifacts/review/075-contact-fit-study.json',JSON.stringify({movement:75,status:'isolated-contact-source-fit',productionChanged:false,
  source:{file:sourceFile,sha256:createHash('sha256').update(source).digest('hex')},rows,
  qualification:'Nearest-crest distances are not a one-to-one tooth-count proof. The engraving has irregular spacing and hidden crests. Red circles use the contact solver, not the source nose point.'},null,2)+'\n',{flag:'wx'});
console.log(rows.map(({teeth,noseErrorB,noseErrorH,tipRms,tipMaximum})=>({teeth,noseErrorB,noseErrorH,tipRms,tipMaximum})));
