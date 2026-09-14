import fs from 'node:fs';
import {makeBowDrillGeometry,THREE} from '../src/simulation/mujoco-bow-drill/geometry.js';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const input=process.env.SOURCE_REPORT??'/dev/shm/124-source.json';
const widthInput=process.env.WIDTH_REPORT;
const bindingInput=process.env.BINDING_REPORT;
const prefix=process.env.PROBE_PREFIX??'/dev/shm/124-source-comparison';
const sources=freezeStudySources([input,...(widthInput?[widthInput]:[]),...(bindingInput?[bindingInput]:[]),'scripts/compare-bow-drill-source.mjs',
  ...fs.readdirSync('src/simulation/mujoco-bow-drill').filter(n=>n.endsWith('.js')).map(n=>'src/simulation/mujoco-bow-drill/'+n),
  'src/simulation/finite-plate-geometry.js','src/simulation/clutch-section-geometry.js',
  'src/simulation/primitives.js','scripts/lib/study-report-io.mjs','package-lock.json'],prefix);
const source=JSON.parse(fs.readFileSync(input)),model=makeBowDrillGeometry(),u=model.root.userData;
const toPixels=p=>[100*p[0]+u.source.axis[0],u.source.axis[1]-100*p[1]];
function outline(mesh){
  mesh.updateMatrix();const g=mesh.geometry,p=g.attributes.position,idx=g.index,edges=new Map();
  const key=p=>p.map(v=>Math.round(v*1e6)).join(',');
  for(let i=0;i<(idx?.count??p.count);i+=3){
    const ps=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,idx?idx.getX(i+j):i+j).applyMatrix4(mesh.matrix));
    const z=ps[1].clone().sub(ps[0]).cross(ps[2].clone().sub(ps[0])).z;
    const points=ps.map(p=>p.toArray());
    for(let j=0;j<3;j++){const a=points[j],b=points[(j+1)%3],k=[key(a),key(b)].sort().join('|');const e=edges.get(k)??{a,b,front:false,back:false};if(z>1e-12)e.front=true;else e.back=true;edges.set(k,e);}
  }
  return [...edges.values()].filter(e=>e.front&&e.back).map(e=>[toPixels(e.a),toPixels(e.b)]);
}
const distance=(p,a,b)=>{const d=b.map((v,i)=>v-a[i]),length=d[0]**2+d[1]**2,t=length?Math.max(0,Math.min(1,((p[0]-a[0])*d[0]+(p[1]-a[1])*d[1])/length)):0;return Math.hypot(...p.map((v,i)=>v-a[i]-t*d[i]));};
const compare=(points,segments)=>{if(!segments.length)throw Error('Empty projected outline');const errors=points.map(p=>Math.min(...segments.map(([a,b])=>distance(p,a,b))));return{points:points.length,rmsPixels:Math.sqrt(errors.reduce((s,x)=>s+x*x,0)/errors.length),maximumPixels:Math.max(...errors),errors};};
const stock=outline(u.parts.stock);
const circles=Object.fromEntries([['outer','frontFlange'],['rim','frontLand'],['hub','frontHub'],['shaft','shaft']].map(([sourceName,part])=>[sourceName,compare(source.circles[sourceName].points,outline(u.parts[part]))]));
const cord=u.profile.cordPath.points.map(toPixels),cordSegments=cord.slice(1).map((p,i)=>[cord[i],p]);
const results={bow:compare(source.bow.flatMap(b=>[b.outer,b.inner]),stock),tips:Object.fromEntries(Object.entries(source.tipContour).map(([name,points])=>[name,compare(points,stock)])),circles,freeCord:compare(source.string,cordSegments)};
if(widthInput)results.freeCordContours=compare(JSON.parse(fs.readFileSync(widthInput)).readings.flatMap(r=>r.contours),outline(u.parts.initialCord));
if(bindingInput){const rs=JSON.parse(fs.readFileSync(bindingInput)).readings;results.bindings=Object.fromEntries([...new Set(rs.map(r=>r.feature))].map(name=>{const readings=rs.filter(r=>r.feature===name);return[name,compare(readings.map(r=>r.point),outline(u.parts[readings[0].part]))];}));}
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify({sources,results,qualification:'Distances from independently measured source ink to projected visible triangle silhouettes (cord: projected centerline). Tips use sparse manual contour points. No motion or finite contact qualification.'},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(results,(key,value)=>key==='errors'?undefined:value,2));
model.root.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
