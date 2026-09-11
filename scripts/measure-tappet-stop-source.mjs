import{readFile,writeFile}from'node:fs/promises';
import{createHash}from'node:crypto';
import * as THREE from 'three';
import{makeTappetStudStop}from'../src/simulation/tappet-stud-stop.js';
const m=makeTappetStudStop();m.update(0);m.root.updateMatrixWorld(true);const{geometry:p,paths,parts}=m.root.userData;
const origin=[352,415],scale=260;
const project=(q,mesh)=>{const v=new THREE.Vector3(Math.fround(q[0]),Math.fround(q[1]),0).applyMatrix4(mesh.matrixWorld);return[origin[0]+scale*v.x,origin[1]-scale*v.y];};
const polylines={cam:paths.cam.map(q=>project(q,parts.driverDisk)),tappet:paths.tappet.map(q=>project(q,parts.tappet)),stop:paths.stop.map(q=>project(q,parts.stopBody))};
const readings={
 cam:[[352,87],[118,183],[29,390],[78,590],[247,726],[373,744],[439,722],[446,675],[531,694],[603,627],[670,511],[675,420],[638,255],[520,128]],
 tappet:[[405,466],[486,444],[565,421],[641,399],[721,376],[784,355],[406,366],[486,357],[565,349],[644,340],[725,332],[775,325],[795,330],[801,340],[793,350]],
 stop:[[457,831],[521,839],[606,829],[658,817],[726,816],[824,792],[906,759],[990,725],[1073,718],[984,650],[950,687],[914,705],[869,722],[816,722],[771,716],[740,704],[725,687],[697,675],[670,675],[645,688],[629,711],[618,733],[588,750],[553,758],[513,763],[478,760],[437,750],[418,749],[392,820]],
 driven:[[1016,88],[1236,172],[1340,386],[1324,532],[1204,687],[1040,745],[890,718],[739,601],[689,467],[705,310],[850,130]],
 driverHub:[[281,416],[351,348],[420,417],[352,483]],
 drivenHub:[[939,416],[1009,350],[1076,418],[1015,484]],
};
const circles={driven:{center:[1016,415],radius:1.26*scale},driverHub:{center:origin,radius:.26*scale},drivenHub:{center:[1016,415],radius:.26*scale}};
function segment(q,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((q[0]-a[0])*dx+(q[1]-a[1])*dy)/(dx*dx+dy*dy)||0));const point=[a[0]+t*dx,a[1]+t*dy];return{point,distance:Math.hypot(q[0]-point[0],q[1]-point[1])};}
const rows=[];
for(const[name,points]of Object.entries(readings))for(const source of points){let hit;
 if(circles[name]){const{center,radius}=circles[name],dx=source[0]-center[0],dy=source[1]-center[1],length=Math.hypot(dx,dy),point=[center[0]+radius*dx/length,center[1]+radius*dy/length];hit={point,distance:Math.abs(length-radius)};}
 else {const line=polylines[name];hit=line.map((q,i)=>segment(source,q,line[(i+1)%line.length])).sort((a,b)=>a.distance-b.distance)[0];}
 rows.push({part:name,source,model:hit.point,errorPixels:hit.distance});
}
const studCenters=[[729,416],[775,249],[933,146],[1105,146],[1241,251],[1297,416],[1234,593],[1089,691],[898,679],[777,583]];
const studs=studCenters.map(source=>{const centers=Array.from({length:10},(_,i)=>({stud:i,point:project([0,0],parts['stud'+i])}));const hit=centers.sort((a,b)=>Math.hypot(source[0]-a.point[0],source[1]-a.point[1])-Math.hypot(source[0]-b.point[0],source[1]-b.point[1]))[0];return{source,...hit,errorPixels:Math.hypot(source[0]-hit.point[0],source[1]-hit.point[1])};});
const summary=Object.fromEntries(Object.keys(readings).map(part=>{const samples=rows.filter(r=>r.part===part);return[part,{count:samples.length,maximumPixels:Math.max(...samples.map(r=>r.errorPixels)),rmsPixels:Math.sqrt(samples.reduce((s,r)=>s+r.errorPixels**2,0)/samples.length)}];}));
summary.studCenters={count:studs.length,maximumPixels:Math.max(...studs.map(r=>r.errorPixels)),rmsPixels:Math.sqrt(studs.reduce((s,r)=>s+r.errorPixels**2,0)/studs.length)};
const reference=await readFile('artifacts/reference/brown-065-detail.png');
await writeFile('artifacts/review/065-source-outline.json',JSON.stringify({movement:65,reference:'../reference/brown-065-detail.png',referenceSHA256:createHash('sha256').update(reference).digest('hex'),projection:{origin,scale,inputAngle:p.sourceGamma},method:'One orthographic anchor and scale; independently read Brown boundary points are matched to the Float32-projected extrusion outlines or circular rims. Ten manually read stud centers are compared to the regular pattern. These sampled errors are not a whole-image registration or a maximum over every source stroke.',qualification:'The engraving has uneven studs and stylized notch/arm boundaries. Ten equally spaced studs, finite conjugate contact profiles and hidden depths are construction choices; exact superposition is not claimed.',boundaryReadings:rows.length,summary,rows,studs},null,2)+'\n');
const colors={cam:'#00efff',tappet:'#22ff66',stop:'#ff30cb',driven:'#00efff',driverHub:'#00efff',drivenHub:'#00efff'};
let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="870" viewBox="0 0 1400 870"><image href="data:image/png;base64,${reference.toString('base64')}" width="1400" height="870"/><g fill="none" stroke-width="2">`;
for(const[name,line]of Object.entries(polylines))svg+=`<path d="${line.map((p,i)=>(i?'L':'M')+p.join(',')).join(' ')}Z" stroke="${colors[name]}"/>`;
for(const[name,{center,radius}]of Object.entries(circles))svg+=`<circle cx="${center[0]}" cy="${center[1]}" r="${radius}" stroke="${colors[name]}"/>`;
for(let i=0;i<10;i++){const q=project([0,0],parts['stud'+i]);svg+=`<circle cx="${q[0]}" cy="${q[1]}" r="${p.pinRadius*scale}" stroke="#00efff"/>`;}
for(const row of rows)svg+=`<path d="M${row.source.join(',')} L${row.model.join(',')}" stroke="#ffeb00"/><circle cx="${row.source[0]}" cy="${row.source[1]}" r="2.5" stroke="#ffeb00"/>`;
svg+='</g></svg>';await writeFile('artifacts/review/065-source-overlay.html','<!doctype html><meta charset="utf-8"><style>body{margin:0}</style>'+svg);console.log({boundaryReadings:rows.length,summary});
