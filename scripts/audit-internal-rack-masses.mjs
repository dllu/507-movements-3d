import fs from 'node:fs';
const f=JSON.parse(fs.readFileSync('/dev/shm/139-generated-profile.json'));
const area=polygons=>polygons.reduce((sum,p)=>sum+p.reduce((sum,r,k)=>{let a=0;for(let i=0;i<r.length;i++){const b=r[(i+1)%r.length];a+=r[i][0]*b[1]-b[0]*r[i][1];}return sum+(k===0?1:-1)*Math.abs(a)/2;},0),0);
// One world unit = 100 mm. This is a realizability example, not a claim
// about the historical machine's unspecified material or plate thickness.
const rimArea=area(f.body)*.01,openingArea=area(f.opening)*.01;
const backingArea=.285*.143-openingArea;
const rimMass=rimArea*.0006*7850,backingMass=backingArea*.00025*2700,rackMass=rimMass+backingMass;
const couplerArea=.254*.008+Math.PI*.004**2-2*Math.PI*.0026**2;
const couplerMass=8*rackMass,couplerDepth=couplerMass/(8500*couplerArea);
const frameArea=.370*.271-.285*.179,frameMass=frameArea*.005*450;
const rodArea=2*(Math.hypot(.001,.0575)*.008+Math.PI*.004**2-2*Math.PI*.0026**2);
const rodDepth=.2*rackMass/(2700*rodArea);
const pinionArea=(area([[f.pinion]])-Math.PI*.08**2)*.01,pinionDepth=rackMass/(2700*pinionArea);
const report={purpose:'Illustrative mass-ratio realizability; not yet the visible model or a strength/inertia validation.',rack:{steelRim:{areaM2:rimArea,thicknessM:.0006,density:7850,massKg:rimMass},aluminiumBacking:{areaM2:backingArea,thicknessM:.00025,density:2700,massKg:backingMass},massKg:rackMass},coupler:{material:'brass',density:8500,frontWidthM:.008,pinSpanM:.254,massKg:couplerMass,depthM:couplerDepth,massRatio:8},frame:{material:'light wood',thicknessM:.005,density:450,massKg:frameMass,massRatio:frameMass/rackMass},pairedRods:{material:'aluminium',depthM:rodDepth,massRatio:.2},pinion:{material:'aluminium',depthM:pinionDepth,massRatio:1},limitations:['The engraving specifies neither masses nor hidden depths.','This example justifies feasibility of the tested mass ratio; it does not derive the probe inertias.','Full hardware clearance, actual mesh mass properties and native convergence still require verification.']};
fs.writeFileSync('docs/validation/139-mass-realizability.json',JSON.stringify(report,null,2)+'\n');console.log(report);
