import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWeightedClutchDistributedCandidate} from './lib/weighted-clutch-distributed-candidate.mjs';
import {makeWeightedClutchKeyEngagementTightStud} from './lib/weighted-clutch-key-engagement-tight-stud.mjs';
import {makeWeightedClutchNativeJawsPruned} from './lib/weighted-clutch-native-jaws-pruned.mjs';
import {measureWeightedClutchJawProfile} from './lib/weighted-clutch-measure-jaw-profile.mjs';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources,writeGzipStudyReport} from './lib/study-report-io.mjs';

const direction=process.env.PROBE_DIRECTION??'CW',prefix=process.env.PROBE_PREFIX??'artifacts/review/087-sequence-'+direction+'-fine',
  input=process.env.PROBE_INPUT??'artifacts/review/087-fixed-orbit-next-measured-'+direction+'-fine.json',parent=readStudyReport(input),
  branch=parent.summaries?.find(s=>s.direction===direction)??parent.segments?.at(-1),
  libraryFiles=['CW','CCW'].map(d=>'artifacts/review/087-fixed-orbit-next-measured-'+d+'-fine.json'),libraries=libraryFiles.map(readStudyReport),
  extraFile=process.env.PROBE_PROFILES,extra=extraFile?readStudyReport(extraFile):null,
  holdStep=Number(process.env.PROBE_HOLD_DT??.0025),motionStep=Number(process.env.PROBE_MOTION_DT??.00025),
  reversals=Number(process.env.PROBE_REVERSALS??4),horizon=90,sharedProgress=process.env.PROBE_SHARED_PROFILE_PROGRESS,
  primary={...branch.seatProfile,input0:branch.profile.input0,omegaInput:branch.profile.omegaInput},
  profiles=[primary],sources=freezeStudySources([...parent.sources.map(s=>s.file),input,branch.file,...libraryFiles,
    ...libraries.flatMap(r=>r.sources.map(s=>s.file)),...(extra?[extraFile,...extra.sources.map(s=>s.file)]:[]),
    'scripts/study-weighted-clutch-fixed-orbit-sequence-shared.mjs','scripts/lib/weighted-clutch-measure-jaw-profile.mjs',
    'scripts/lib/weighted-clutch-native-jaws-pruned.mjs','scripts/lib/weighted-clutch-key-engagement-tight-stud.mjs'],prefix),
  model=makeWeightedClutchDistributedCandidate(parent.options),jaws=makeWeightedClutchNativeJawsPruned(model),
  profileAdditions=[],segments=[],progress=fs.openSync(prefix+'-progress.jsonl','wx'),tau=2*Math.PI;
for(const r of [parent,...libraries,...(extra?[extra]:[])]){verifyStudySources(r.sources);assert.deepEqual(r.options,parent.options);}
assert(branch.settled&&!branch.error&&primary&&Number.isInteger(reversals)&&reversals>0&&holdStep>0&&motionStep>0);
assert.equal(primary.input0,branch.profile.input0);assert.equal(primary.omegaInput,branch.profile.omegaInput);
for(const p of [...libraries.flatMap(r=>r.summaries.flatMap(s=>[s.profile,...s.otherProfiles])),...(parent.profiles??[]),...(extra?.profiles??(extra?.otherProfiles?[extra.profile,...extra.otherProfiles]:[]))]){
  if(!profiles.some(t=>t.side===p.side&&Math.abs(t.peak.angle-p.peak.angle)<1e-10))profiles.push(p);
}
const makeDynamics=()=>makeWeightedClutchKeyEngagementTightStud(model,primary,branch.friction,profiles.slice(1));
let d=makeDynamics(),state=branch.end,side=branch.side,error=null;
assert.equal(state.phase.input,d.phase(state.q,state.time).input);
function advance(before,h,segment){
  for(let tries=0;tries<25;tries++){
    try{return d.advance(before,h);}
    catch(error){
      const match=error.message.match(/^Unmeasured potentially contacting (left|right) jaw phase ([-.\d]+)/);
      if(!match)throw error;
      // The progress journal is only a discovery feed. Each published native
      // report is immutable and is verified before becoming a solver input.
      if(sharedProgress&&fs.existsSync(sharedProgress)){
        const records=fs.readFileSync(sharedProgress,'utf8').split('\n').slice(0,-1).filter(Boolean).map(JSON.parse),
          side=match[1],angle=Number(match[2]);let extended=false;
        for(const record of records.filter(r=>r.event==='profile-added')){
          if(sources.some(s=>s.file===record.file))continue;
          assert.equal(hashStudyFile(record.file),record.sha256);const shared=readStudyReport(record.file),p=shared.profiles[0],
            turns=Math.round((angle-(p.low+p.high)/2)/tau),local=angle-turns*tau;
          if(p.side!==side||local<p.low-1e-10||local>p.high+1e-10)continue;
          verifyStudySources(shared.sources);assert.deepEqual(shared.options,parent.options);
          const oldMass=d.mass(before.q),oldForce=d.forces(before.q,before.v),oldInput=d.phase(before.q,before.time).input;
          for(const source of shared.sources)if(!sources.some(s=>s.file===source.file))sources.push(source);
          sources.push({file:record.file,sha256:record.sha256,immutableArtifactReference:true});
          profiles.push(p);d=makeDynamics();
          const massDifference=Math.max(...oldMass.map((v,i)=>Math.abs(v-d.mass(before.q)[i]))),
            forceDifference=Math.max(...oldForce.map((v,i)=>Math.abs(v-d.forces(before.q,before.v)[i])));
          assert(massDifference<1e-12&&forceDifference<1e-12);assert.equal(oldInput,d.phase(before.q,before.time).input);
          const addition={file:record.file,sha256:record.sha256,segment,time:before.time,side,start:angle,
            massDifference,forceDifference,shared:true};profileAdditions.push(addition);
          fs.writeSync(progress,JSON.stringify({event:'profile-added',...addition})+'\n');
          console.log({direction,segment,event:'reuse-published-native-tooth',file:record.file});extended=true;break;
        }
        if(extended)continue;
      }
      const side=match[1],start=Number(match[2]),number=profileAdditions.length+1,file=prefix+'-native-'+number+'-'+side+'.json',
        journalFile=file.replace(/\.json$/,'-queries.jsonl'),journal=fs.openSync(journalFile,'wx'),
        oldMass=d.mass(before.q),oldForce=d.forces(before.q,before.v),oldInput=d.phase(before.q,before.time).input;
      let measured;
      console.log({direction,segment,event:'measure-native-tooth',side,start,time:before.time});
      try{measured=measureWeightedClutchJawProfile(jaws,{side,start,direction,jawCount:model.root.userData.geometry.jawCount,
        input0:primary.input0,omegaInput:primary.omegaInput,onSample:(r,count)=>{
          fs.writeSync(journal,JSON.stringify(r)+'\n');if(count%1024===0)console.log({direction,segment,side,nativeQueries:count});
        }});}finally{fs.closeSync(journal);}
      verifyStudySources(sources);
      fs.writeFileSync(file,JSON.stringify({movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,
        sources: sources.slice(),options:parent.options,profiles:[measured.profile],checks:[measured.checks],
        journal:{file:journalFile,sha256:hashStudyFile(journalFile)},
        trigger:{segment,time:before.time,q:before.q,v:before.v,h,message:error.message},
        qualification:'An on-demand native tooth measurement requested by the continuous sequence. Only geometry tables are extended; the interrupted state and attempted step remain unchanged.'})+'\n',{flag:'wx'});
      sources.push({file,sha256:hashStudyFile(file),immutableArtifactReference:true},{file:journalFile,sha256:hashStudyFile(journalFile),immutableArtifactReference:true});
      profiles.push(measured.profile);d=makeDynamics();
      const massDifference=Math.max(...oldMass.map((v,i)=>Math.abs(v-d.mass(before.q)[i]))),
        forceDifference=Math.max(...oldForce.map((v,i)=>Math.abs(v-d.forces(before.q,before.v)[i])));
      assert(massDifference<1e-12&&forceDifference<1e-12);assert.equal(oldInput,d.phase(before.q,before.time).input);
      profileAdditions.push({file,sha256:hashStudyFile(file),segment,time:before.time,side,start,massDifference,forceDifference});
      fs.writeSync(progress,JSON.stringify({event:'profile-added',...profileAdditions.at(-1)})+'\n');
    }
  }
  throw Error('Repeated native profile extension without an accepted step');
}
function seated(row,target){
  const phase=d.phase(row.q,row.time),speed=(target==='left'?1:-1)*model.root.userData.geometry.mainRatio*primary.omegaInput;
  return profiles.find(p=>{
    if(p.side!==target)return false;
    const turns=Math.round((phase.relativeJaws[target]-p.peak.angle)/tau);
    return Math.abs(phase.relativeJaws[target]-p.peak.angle-turns*tau)<1e-8&&Math.abs(p.peak.gap+(target==='left'?1:-1)*row.q[2])<1e-8&&
      Math.max(...row.v.slice(0,3).map(Math.abs))<1e-7&&Math.max(...row.v.slice(3).map(v=>Math.abs(v-speed)))<1e-6;
  });
}
try{for(let segment=1;segment<=reversals;segment++){
  const start=state,fromSide=side,target=side==='left'?'right':'left',rows=[start],events=[],sign=side==='left'?-1:1,
    farSlot=side==='left'?'slot-upper':'slot-lower';let nextStud=null,seat=null,seatProfile=null,inMotion=false;
  const loaded=(row,kind)=>row.active.some(c=>c.kind===kind&&c.impulse>1e-12);
  let lastStud=loaded(state,'stud');
  try{while(state.time<start.time+horizon-1e-12&&!(seat&&state.time>=seat.time+.25-1e-12)){
    const before=state,gap=d.stud.evaluate(state.q[0],d.phase(state.q,state.time).e).gap,
      h=inMotion||gap<.005?motionStep:holdStep;
    state=advance(before,Math.min(h,start.time+horizon-state.time),segment);rows.push(state);
    const event=kind=>events.push({kind,time:state.time,bracket:[before.time,state.time],q:state.q,v:state.v}),stud=loaded(state,'stud');
    if(stud&&!nextStud){nextStud=state;inMotion=true;event('next-stud');}
    if(stud!==lastStud)event(stud?'stud-contact':'stud-release');lastStud=stud;
    if(!events.some(e=>e.kind==='weight-over-center')&&sign*(state.q[0]-model.root.userData.linkage.parameters.overCenterAngle)>=0)event('weight-over-center');
    if(!events.some(e=>e.kind==='far-slot')&&loaded(state,farSlot)){event('far-slot');inMotion=true;}
    if(!events.some(e=>e.kind==='withdrawal-threshold')&&(state.q[2]-start.q[2])*(side==='left'?1:-1)>.002){event('withdrawal-threshold');inMotion=true;}
    if(!events.some(e=>e.kind==='opposite-jaw-loaded')&&state.active.some(c=>c.kind.startsWith('jaw-'+target+'-')&&c.impulse>1e-12))event('opposite-jaw-loaded');
    const p=seated(state,target);
    if(p){if(!seat){seat=state;seatProfile=p;event('seat-candidate');}}
    else if(seat){event('seat-departure');seat=null;seatProfile=null;}
    if(rows.length%10000===0)console.log({direction,segment,time:state.time,states:rows.length,inMotion});
  }}catch(e){error={message:e.message,stack:e.stack};}
  const file=prefix+'-segment-'+segment+'.json.gz',summary={direction,segment,fromSide,side:target,profile:primary,otherProfiles:profiles.slice(1),
    seatProfile,friction:branch.friction,parameters:d.parameters,holdStep,motionStep,horizon,start,end:state,states:rows.length,error,
    nextStud,seat,events,settled:!!seat&&state.time>=seat.time+.25-1e-12,minimumGap:rows.reduce((m,r)=>Math.min(m,r.minimumGap),Infinity)};
  verifyStudySources(sources);
  await writeGzipStudyReport(file,{movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,sources:sources.slice(),options:parent.options,...summary,rows});
  segments.push({...summary,file});fs.writeSync(progress,JSON.stringify({event:'segment',file,time:state.time,states:rows.length,error,settled:summary.settled})+'\n');
  console.log({direction,segment,file,states:rows.length,error,settled:summary.settled,nextStud:nextStud?.time,seat:seat?.time,q:state.q});
  if(error||!summary.settled)break;side=target;
}}finally{fs.closeSync(progress);}
verifyStudySources(sources);
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:87,productionChanged:false,candidateIntegrated:false,mechanicsPassed:false,
  sources,options:parent.options,input,direction,holdStep,motionStep,reversals,horizon,profiles,profileAdditions,segments,
  qualification:'Continuous segmented sequence beginning at the qualified second seated state. State and input clock persist across reversals. Missing native profiles can be loaded from verified immutable reports announced by an active coarse run, or measured when unavailable. Discovery journals are not physical inputs. Geometry profiles inherit the continuing input clock only in the primary metadata; the actual state is unchanged. Table extension preserves the attempted state, mass, forces and input phase. The input alone is prescribed; seating and reversal are observed. Independent step, contact, energy, source and rendering qualification remain required.'})+'\n',{flag:'wx'});
assert(segments.length===reversals&&segments.every(s=>s.settled&&!s.error&&s.nextStud));
