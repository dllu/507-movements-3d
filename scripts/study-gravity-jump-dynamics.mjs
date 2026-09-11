// Isolated screening of physical gravity and both finite lost-motion stops.
// This intentionally remains separate from production 066 pending geometry.
import{writeFile}from'node:fs/promises';
const p={mass:1,armMass:.08,armLength:Math.hypot(141,565)/218,bobRadius:180/218,gravity:9.81,driverSpeed:.4,availableLead:2.711};
p.inertia=p.mass*(p.armLength**2+p.bobRadius**2/2)+p.armMass*p.armLength**2/3;
p.gravityMoment=p.gravity*p.armLength*(p.mass+p.armMass/2);
function run(damping,dt){
 const release=Math.asin(damping*p.driverSpeed/p.gravityMoment),duration=2*Math.PI/p.driverSpeed;
 let time=0,q=release,w=p.driverSpeed,mode='free',dragLoss=0,impactLoss=0,driverWork=0,maxLead=0,peakSpeed=0;
 const energy=(q,w)=>.5*p.inertia*w*w+p.gravityMoment*(1+Math.cos(q)),initialEnergy=energy(q,w),events=[],frames=[];
 const derivative=(q,w)=>[w,(p.gravityMoment*Math.sin(q)-damping*w)/p.inertia,damping*w*w];
 const integrate=(q,w,h)=>{const a=derivative(q,w),b=derivative(q+a[0]*h/2,w+a[1]*h/2),c=derivative(q+b[0]*h/2,w+b[1]*h/2),d=derivative(q+c[0]*h,w+c[1]*h);return[q+h*(a[0]+2*b[0]+2*c[0]+d[0])/6,w+h*(a[1]+2*b[1]+2*c[1]+d[1])/6,h*(a[2]+2*b[2]+2*c[2]+d[2])/6];};
 let step=0;
 while(time<duration-1e-12){const h=Math.min(dt,duration-time),nextTime=time+h,driver=release+p.driverSpeed*nextTime;
  if(mode==='free'){
   const next=integrate(q,w,h);q=next[0];w=next[1];dragLoss+=next[2];const lead=q-driver;
   if(lead>p.availableLead||(lead<0&&time>.001)){
    const side=lead>p.availableLead?'upper':'lower',incoming=w,impulse=p.inertia*(p.driverSpeed-incoming);
    impactLoss+=.5*p.inertia*(incoming-p.driverSpeed)**2;driverWork+=impulse*p.driverSpeed;
    q=driver+(side==='upper'?p.availableLead:0);w=p.driverSpeed;mode=side;
    events.push({time:nextTime,kind:side+'-impact',incomingSpeed:incoming,impulse});
   }
  }else{
   const nextQ=driver+(mode==='upper'?p.availableLead:0),work=energy(nextQ,p.driverSpeed)-energy(q,w)+damping*p.driverSpeed**2*h;
   q=nextQ;w=p.driverSpeed;dragLoss+=damping*w*w*h;driverWork+=work;
   const required=damping*w-p.gravityMoment*Math.sin(q);
   if((mode==='lower'&&required<0)||(mode==='upper'&&required>0)){events.push({time:nextTime,kind:mode+'-release'});mode='free';}
  }
  time=nextTime;maxLead=Math.max(maxLead,q-driver);peakSpeed=Math.max(peakSpeed,Math.abs(w));
  if(step++%400===0)frames.push({time,q,w,lead:q-driver,mode});
 }
 return{damping,dt,release,peakSpeed,maxLead,events,finalMode:mode,energyResidual:energy(q,w)-initialEnergy-driverWork+dragLoss+impactLoss,driverWork,dragLoss,impactLoss,frames};
}
const cases=[0,1,4,8,12].map(c=>run(c,.0001));
await writeFile('artifacts/review/066-gravity-dynamics-screen.json',JSON.stringify({movement:66,status:'isolated-dynamics-screen',productionChanged:false,parameters:p,
 qualification:'Source-proportioned trial inertia; no candidate geometry is integrated. RK4 handles free gravity and viscous drag. Finite upper and lower contacts use inelastic step-end projection in this screen, so event times and energy error require refinement before acceptance. Damping is a varied explicit hypothesis, not an inferred source specification.',cases},null,2)+'\n');
console.log(cases.map(({frames,...s})=>s));
