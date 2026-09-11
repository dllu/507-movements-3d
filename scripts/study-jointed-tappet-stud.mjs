import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {vadd,vsub,vmul,vdot,vcross,vrotate,makeJointedTappetContactStudy} from './lib/jointed-tappet-contact-study.mjs';

const study=makeJointedTappetContactStudy(),p=study.parameters,
  source=point=>[(point[0]-p.center[0])/p.scale,(p.center[1]-point[1])/p.scale],
  driverCenter=source([454.8228117048603,593.4140417418711]),D=source([1187,358]),orbit=vsub(D,driverCenter),
  studRadius=24/p.scale,barRadius=41/p.scale,A=p.B,R=vsub(source([1282,589]),p.C),axis=vsub(R,A),square=vdot(axis,axis),
  at=(angle,q)=>{
    const stud=vadd(driverCenter,vrotate(orbit,-angle)),local=vrotate(vsub(stud,p.C),-q),
      fraction=Math.max(0,Math.min(1,vdot(vsub(local,A),axis)/square)),center=vadd(A,vmul(axis,fraction)),
      delta=vsub(local,center),distance=Math.hypot(...delta),normal=vmul(delta,1/distance),
      point=vadd(p.C,vrotate(vadd(center,vmul(normal,barRadius)),q)),worldNormal=vrotate(normal,q);
    return{gap:distance-barRadius-studRadius,stud,point,normal:worldNormal,fraction,
      tappetMoment:-vcross(vsub(point,p.C),worldNormal)};
  },rows=[],failures=[],releases=[];
let q=0,maximumStep=0;
for(let i=0;i<=2400;i++){
  const angle=2*Math.PI*i/2400,previous=q;let contact=at(angle,q),mode='rest-stop';
  // First repair the small overlap created by the next input step by moving
  // in the driven (clockwise) direction. Preserve the connected clear branch.
  if(contact.gap< -1e-11){
    let high=q,low=null;
    for(let j=1;j<=2000;j++){const trial=q-.002*j;if(at(angle,trial).gap>=0){low=trial;break;}high=trial;}
    if(low===null){failures.push({kind:'driver-trapped',angle,q});break;}
    for(let j=0;j<40;j++){const mid=(low+high)/2;if(at(angle,mid).gap<0)high=mid;else low=mid;}q=low;
  }
  // Gravity requests increasing q. Stop at the first stud contact encountered
  // from this branch; crossing an intervening solid is never permitted.
  let low=q,high=null;
  for(let trial=q+.002;trial<0;trial+=.002){if(at(angle,trial).gap<0){high=trial;break;}low=trial;}
  if(high===null&&at(angle,0).gap<0)high=0;
  if(high!==null){
    for(let j=0;j<40;j++){const mid=(low+high)/2;if(at(angle,mid).gap<0)high=mid;else low=mid;}
    q=low;mode='stud-contact';
  }else q=0;
  contact=at(angle,q);maximumStep=Math.max(maximumStep,Math.abs(q-previous));
  if(q===0&&previous<-.01)releases.push({angle,previousQ:previous,qualification:'Instantaneous quasistatic return only; inertia must resolve this branch change.'});
  if(contact.gap< -1e-8||mode==='stud-contact'&&contact.tappetMoment>=0)failures.push({kind:'invalid-contact',angle,q,...contact});
  rows.push({angle,phase:angle/(2*Math.PI),q,mode,...contact});
}
const report={movement:76,status:'isolated-source-capsule-stud-study',productionChanged:false,
  parameters:{driverCenter,orbit,studRadius,barRadius,A,R,C:p.C},rows,failures,releases,maximumStep,
  minimumQ:Math.min(...rows.map(r=>r.q)),
  source:{file:'scripts/study-jointed-tappet-stud.mjs',sha256:createHash('sha256').update(await readFile('scripts/study-jointed-tappet-stud.mjs')).digest('hex')},
  qualification:'The visible tappet is approximated by a capsule and D by a finite circle on the fitted clockwise orbit. Contact follows the previously connected nonpenetrating angular branch with a rest limit q<=0. Gravity is assumed to request increasing q; actual mass and inertia are not yet solved. The release jump is diagnostic and must not become an animated teleport. Counting wheel, dog, holding pawl and axial hardware are not certified.'};
await writeFile('artifacts/review/076-source-capsule-stud-study.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({poses:rows.length,minimumQ:report.minimumQ,maximumStep,failures,releases,
  firstContact:rows.find(r=>r.mode==='stud-contact'),lastContact:rows.filter(r=>r.mode==='stud-contact').at(-1)});
