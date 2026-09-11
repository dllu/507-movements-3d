import{readFile,writeFile}from'node:fs/promises';
import{makeTiltHammerCandidate}from'./lib/tilt-hammer-candidate.mjs';
import{tiltHammerSource as source}from'./lib/tilt-hammer-source-profile.mjs';
import{extrudedPlateContours}from'./lib/extruded-plate-contours.mjs';
const model=makeTiltHammerCandidate(),{parts,geometry:p}=model.root.userData;
model.update(p.inputStart/p.omega);model.root.updateMatrixWorld(true);
const reference=JSON.parse(await readFile('artifacts/review/072-refined-source-flank.json','utf8'));
const readings={
  camBody:[...reference.flank.points,[708,807],[717,782],[744,753],[776,730],[811,710],[847,696],[876,691],[914,690],
    [797,816],[797,846],[800,881],[810,923],[826,956],[847,985],[874,1006],[913,1015],
    [922,924],[956,925],[995,918],[1036,904],[1075,882],[1104,850],[1126,818]],
  hammerBody:[[282,258],[286,174],[299,128],[326,105],[445,119],[568,134],[680,154],[755,182],[836,222],[920,265],
    [1000,292],[1105,324],[1226,357],[1361,392],[1507,417],[1471,600],[1428,545],[1350,512],[1240,482],[1131,456],
    [1062,451],[1011,461],[978,490],[960,526],[942,557],[920,560],[860,548],[864,499],[847,433],[824,395],
    [803,380],[701,355],[590,328],[480,303],[385,283],[883,582],[887,600],[907,615],[918,605],[930,577],
    [1451,729],[1460,755],[1486,773],[1513,777],[1538,763],[1550,737]],
  striker:[[351,321],[401,333],[474,348],[542,363],[558,342]],
  hammerSleeve:[[1505,417],[1562,421],[1620,427],[1597,544],[1575,660],[1522,650],[1472,641]],
  workpiece:[[39,264],[96,315],[180,355],[258,380],[320,391],[339,422],[394,446],[451,458],[497,458],[526,450],[550,418],
    [618,428],[628,442],[600,480],[559,512],[495,525],[417,525],[345,518],[275,493],[200,452],[126,409],[70,363]],
  anvil:[[151,533],[390,533],[622,533],[622,800],[622,1050],[390,1050],[151,1050],[151,800]],
  foundation:[[50,1050],[850,1050],[1178,1050],[1178,810],[1290,810],[1368,690],[1432,690],[1432,795],[1569,795],
    [1569,694],[1625,694],[1695,811],[1815,815],[1815,1156],[900,1156],[50,1156]],
};
const contours=Object.fromEntries(Object.keys(readings).map(name=>[name,extrudedPlateContours(parts[name].geometry)
  .filter(ring=>name!=='hammerBody'||ring.area>.03).map(ring=>ring.points.map(q=>{
    const e=parts[name].matrixWorld.elements,x=e[0]*q[0]+e[4]*q[1]+e[12],y=e[1]*q[0]+e[5]*q[1]+e[13];
    return[source.camCenter[0]+p.scale*x,source.camCenter[1]-p.scale*y];
  }))]));
const distance=(point,rings)=>Math.min(...rings.map(ring=>Math.min(...ring.map((a,i)=>{
  const b=ring[(i+1)%ring.length],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/(dx*dx+dy*dy)));
  return Math.hypot(point[0]-a[0]-t*dx,point[1]-a[1]-t*dy);
}))));
const groups=Object.entries(readings).map(([part,points])=>{
  const rows=points.map(point=>({point,distance:distance(point,contours[part])}));
  return{part,points:rows.length,maximumPixels:Math.max(...rows.map(r=>r.distance)),rmsPixels:Math.sqrt(rows.reduce((sum,r)=>sum+r.distance**2,0)/rows.length),rows};
});
const report={movement:72,status:'isolated-actual-mesh-source-fit',productionChanged:false,
  method:'Common source projection with scale 350 px/unit, origin at the measured cam shaft, and no per-part alignment. Actual Float32 side-wall contours are transformed at input angle zero. The upper-right cam readings are measured radial-stroke midpoints; all other readings are explicitly approximate manual boundary readings. The anvil top is adjusted eight source pixels to meet the workpiece. Hidden supports and the blind bore are omitted from this elevation fit.',
  scale:p.scale,sourceTime:p.inputStart/p.omega,points:groups.reduce((sum,r)=>sum+r.points,0),groups};
await writeFile('artifacts/review/072-candidate-source-fit.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
const paths=Object.entries(contours).flatMap(([name,rings])=>rings.map(points=>`<path d="M ${points.map(p=>p.join(' ')).join(' L ')} Z" fill="none" stroke="${name==='camBody'?'#ff3344':'#007dff'}" stroke-width="2.3"/>`)).join('');
const marks=groups.flatMap(group=>group.rows.map(row=>`<circle cx="${row.point[0]}" cy="${row.point[1]}" r="3.5" fill="#00b85a"/>`)).join('');
const png=await readFile(reference.source.file);
await writeFile('artifacts/review/072-candidate-source-overlay.svg',`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1910" height="1260"><image xlink:href="data:image/png;base64,${png.toString('base64')}" width="1910" height="1260"/>${paths}${marks}</svg>`,{flag:'wx'});
console.log({points:report.points,groups:groups.map(({rows,...r})=>r)});
