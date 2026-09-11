import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { makeElasticRatchetStudy } from './lib/spring-pressed-ratchet-elastic.mjs';

const file=process.argv[2];if(!file)throw new Error('Supply the saved study JSON');
const data=JSON.parse(await readFile(file,'utf8')),study=makeElasticRatchetStudy(data.parameters),prefix=file.replace(/\.json$/,'-views');
const requested=[0,-3.1,-3.35,data.rows.at(-1).input];
const poses=requested.map(input=>data.snapshots.reduce((best,row)=>Math.abs(row.input-input)<Math.abs(best.input-input)?row:best));
const xy=p=>[220+100*p[0],195-100*p[1]],path=points=>points.map((p,i)=>`${i?'L':'M'}${xy(p).join(',')}`).join(' ');
const rotate=(p,a)=>[p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a)];
const panels=poses.map((pose,index)=>{
  const origin=[(index%2)*440,Math.floor(index/2)*450];
  let svg=`<g transform="translate(${origin})"><rect width="440" height="450" fill="#faf8f2" stroke="#c6c1b6"/><text x="15" y="25" font-family="sans-serif" font-size="15">Input ${(-pose.input*180/Math.PI).toFixed(1)}° CW · output ${(-pose.q*180/Math.PI).toFixed(2)}° CW</text>`;
  svg+='<circle cx="220" cy="195" r="152.37" fill="#ed764c" fill-opacity=".25" stroke="#be542c"/>';
  svg+=`<path d="${path(study.ratchet.points.map(p=>rotate(p,pose.q)))} Z" fill="#397c94" stroke="#235f74"/>`;
  const lower=study.rods[1].fixedLowerPoints;if(lower)svg+=`<path d="${path(lower)}" fill="none" stroke="#565f5a" stroke-width="12"/>`;
  for(let k=0;k<2;k++){
    const geometry=pose.geometries[k],rod=study.rods[k];
    for(let i=0;i<geometry.edges.length;i++)svg+=`<path d="${path([geometry.points[i],geometry.points[i+1]])}" fill="none" stroke="${k?'#646d63':'#c3973f'}" stroke-width="${50*(rod.widths[i]+rod.widths[i+1])}" stroke-linecap="round"/>`;
    const point=xy(geometry.points[0]);svg+=`<rect x="${point[0]-8}" y="${point[1]-8}" width="16" height="16" fill="#242c29"/>`;
  }
  for(const contact of pose.contacts){
    const point=xy(contact.point??contact.first),normal=contact.normal;
    svg+=`<circle cx="${point[0]}" cy="${point[1]}" r="3" fill="#e40058"/><path d="M${point} l${normal[0]*20},${-normal[1]*20}" stroke="#e40058" stroke-width="2"/>`;
  }
  return svg+`<text x="15" y="430" font-family="sans-serif" font-size="12">${[...new Set(pose.contacts.map(r=>r.kind))].join(' · ')} · study pose ${pose.step}</text></g>`;
});
await writeFile(prefix+'.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="880" height="900">${panels.join('')}</svg>`,{flag:'wx'});
const result=spawnSync('convert',[prefix+'.svg',prefix+'.png']);if(result.status!==0)throw new Error('Render failed: '+result.stderr);
await writeFile(prefix+'.json',JSON.stringify({file:prefix+'.png',study:file,poses:poses.map(r=>({step:r.step,input:r.input,q:r.q})),
  sha256:createHash('sha256').update(await readFile(prefix+'.png')).digest('hex'),inspected:false,
  qualification:'Planar elastic-study diagrams. Colored centerline strokes approximate the finite spring width and show contact normals. These are not production 3D captures or mesh-clearance evidence.'},null,2)+'\n',{flag:'wx'});
console.log({file:prefix+'.png',steps:poses.map(r=>r.step)});
