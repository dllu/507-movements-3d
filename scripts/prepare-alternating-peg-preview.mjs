import fs from 'node:fs';import crypto from 'node:crypto';import * as THREE from 'three';
import {makeAlternatingPegCandidate} from './lib/alternating-peg-candidate.mjs';
const file=process.env.PROBE_TRAJECTORY||'artifacts/review/077-long-lip-clock-finer.json',data=JSON.parse(fs.readFileSync(file)),candidate=makeAlternatingPegCandidate(data.geometry),u=candidate.root.userData,
 selected=new Set([0,data.rows.length-1]),bounds=new THREE.Box3();
for(let i=0;i<=128;i++)selected.add(Math.round((data.rows.length-1)*i/128));
for(let coordinate=0;coordinate<4;coordinate++)for(const sign of [-1,1]){let best=0;const value=r=>coordinate===0?r.q:r.x[coordinate-1];
 for(let i=1;i<data.rows.length;i++)if(sign*value(data.rows[i])>sign*value(data.rows[best]))best=i;selected.add(best);}
for(const index of selected){const r=data.rows[index];u.setState({q:r.q,theta:r.x[0],upperAngle:r.x[1],lowerAngle:r.x[2]});bounds.union(new THREE.Box3().setFromObject(candidate.root,true));}
bounds.expandByScalar(.005);
const output='artifacts/review/077-long-lip-finer-preview-data.json',report={movement:77,productionChanged:false,mechanicsPassed:false,period:data.parameters.period,pitch:u.geometry.pitch,
 geometry:data.geometry,rows:data.rows.map(r=>[r.time,r.q,...r.x]),sampledMotionBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},
 qualification:'Uncertified linear interpolation of a sampled dynamics trajectory for visual review. Initial cycle followed by repeated second-cycle motion. A future accepted cache needs an interpolation-clearance certificate.',
 sources:[file,'scripts/prepare-alternating-peg-preview.mjs','scripts/lib/alternating-peg-candidate.mjs'].map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync(output,JSON.stringify(report)+'\n');console.log({output,rows:report.rows.length,bounds:report.sampledMotionBounds});
