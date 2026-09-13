import {familyMass} from '../../src/simulation/finite-plate-geometry.js';
import {makeEccentricTwoStopFeatureContact} from './eccentric-two-stop-feature-contact.mjs';

export function makeEccentricTwoStopDynamics(model, {omega = -.5, brakeAcceleration = 2, gravity = 9.81} = {}) {
  const contact = makeEccentricTwoStopFeatureContact(model), mass = familyMass(model.root.userData.parts, model.root.userData.families, 'wheel');
  const inertia = mass.polar, [cx, cy] = mass.centroid;
  const potential = q => gravity * mass.volume * (cx*Math.sin(q)+cy*Math.cos(q));
  const gravityTorque = q => -gravity * mass.volume * (cx*Math.cos(q)-cy*Math.sin(q));
  const energy = (q,v) => potential(q)+.5*inertia*v*v;
  function initial() {return {time:0,input:0,output:0,speed:0,energy:energy(0,0),active:'',normalImpulse:0};}
  function step(before,time) {
    const h=time-before.time,input=omega*time,gravityImpulse=h*gravityTorque(before.output),
      predicted=before.speed+gravityImpulse/inertia,
      free=Math.sign(predicted)*Math.max(0,Math.abs(predicted)-brakeAcceleration*h),
      brakeImpulse=inertia*(free-predicted);
    let q=before.output+h*free,iterations=0;
    const penetration=contact.query(input,q)[0];
    if(penetration?.gap<0) {
      let high=q,low=q;
      if(penetration.outputGradient>=0)throw Error('Unexpected reverse push at '+time);
      for(;iterations<40;iterations++) {low-=.002;const c=contact.query(input,low)[0];if(!c||c.gap>=0)break;}
      if(iterations===40)throw Error('Position contact could not be bracketed at '+time);
      for(let i=0;i<36;i++) {const mid=(low+high)/2,c=contact.query(input,mid)[0];if(c&&c.gap<0)high=mid;else low=mid;}
      q=low;
    }
    const contacts=contact.query(input,q),near=contacts.filter(c=>c.gap<=2e-9);
    let low=-Infinity,high=Infinity,lower,upper;
    for(const c of near) {
      if(Math.abs(c.outputGradient)<1e-12)continue;
      const target=-c.inputGradient*omega/c.outputGradient;
      if(c.outputGradient>0&&target>low){low=target;lower=c;}
      if(c.outputGradient<0&&target<high){high=target;upper=c;}
    }
    if(low>high+1e-6)throw Error('Conflicting contact rates at '+time);
    const speed=Math.max(low,Math.min(high,free)),loaded=speed>free?lower:speed<free?upper:null,
      normalImpulse=loaded?inertia*(speed-free)/loaded.outputGradient:0,
      contactWork=loaded?normalImpulse*(-loaded.inputGradient*omega):0,
      impactLoss=.5*inertia*(speed-free)**2,
      impulseEnergyResidual=.5*inertia*(speed*speed-free*free)-contactWork+impactLoss;
    if(normalImpulse< -1e-10||Math.abs(impulseEnergyResidual)>1e-9)throw Error('Invalid contact impulse at '+time);
    return {time,input,output:q,speed,energy:energy(q,speed),free,gravityImpulse,brakeImpulse,normalImpulse,
      active:normalImpulse>1e-12?loaded.label:'',gap:contacts[0]?.gap??null,iterations,
      contact:loaded?{label:loaded.label,gap:loaded.gap,outputGradient:loaded.outputGradient,inputGradient:loaded.inputGradient,
        axisOwner:loaded.axisOwner,point:loaded.footPoint}:null,contactWork,impactLoss,impulseEnergyResidual};
  }
  return {initial,step,energy,gravityTorque,potential,contact,parameters:{omega,brakeAcceleration,gravity,mass,inertia}};
}
