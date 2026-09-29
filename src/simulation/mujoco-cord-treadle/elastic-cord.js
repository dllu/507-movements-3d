// Pass 103: the treadle cord as a real cord: elastic, heavy and tension-only.
//
// With an ideal inextensible cord the resting treadle is jerked to the pin's
// speed within one soft-constraint step (about 1 ms) when the slack is taken
// up, and the visible cord is forced dead straight at the same instant. Here
// the cord has two compliances in series, both physical:
//  - elastic stretch, strain-stiffening like laid fibre rope:
//      e(T) = (T / stiffness)^(1 / exponent);
//  - the sag of its own weight in the free diagonal run of length s (the
//    classical parabolic "equivalent modulus" of a sagging cable): the chord is
//    shorter than the cord by d(T) = w^2 s^3 / (24 T^2).
// The chord (tendon path) extension beyond the tied length is x = e(T) - d(T),
// which is monotone in T, so T is solved from x. A slack cord still pulls with
// the small tension its hanging weight produces; as the chord approaches the
// tied length the tension rises continuously and the sag clears progressively,
// instead of both happening at one instant. A damping term on the chord rate,
// faded in with the elastic stretch, dissipates the take-up oscillation.
//
// Units: kg, display units (0.1 m) and seconds, with gravity 98.1 units/s².
// The stiffness is assumed (the plate names no material): about 1% working
// strain under the 1.9 kg treadle, softer than new hemp, as a leather or gut
// band. The weight is a 0.045-radius cord of density 1100 kg/m³.
const CORD_RADIUS=.045,METRES_PER_UNIT=.1,DENSITY=1100,GRAVITY=98.1;
export const TREADLE_CORD=Object.freeze({stiffness:20000,exponent:2,damping:120,engage:.03,backstopStrain:.05,
 weightPerLength:Math.PI*CORD_RADIUS**2*METRES_PER_UNIT**3*DENSITY*GRAVITY});
export const cordStretch=(tension,o=TREADLE_CORD)=>tension>0?(tension/o.stiffness)**(1/o.exponent):0;
export const cordSagDeficit=(tension,span,o=TREADLE_CORD)=>o.weightPerLength>0?o.weightPerLength**2*span**3/(24*tension*tension):0;
/** Static tension for a chord extension x (chord length minus tied length). */
export function cordTension(x,span,o=TREADLE_CORD){
 if(!(o.weightPerLength>0))return x>0?o.stiffness*x**o.exponent:0;
 let lo=Math.log(1e-9),hi=Math.log(1e8);
 for(let i=0;i<80;i++){const mid=(lo+hi)/2,t=Math.exp(mid);if(cordStretch(t,o)-cordSagDeficit(t,Math.max(span,1e-6),o)<x)lo=mid;else hi=mid;}
 return Math.exp((lo+hi)/2);
}
/** Tension including the faded-in damping on the chord rate (never negative). */
export function cordTensionWithDamping(x,rate,span,o=TREADLE_CORD){
 const t=cordTension(x,span,o);return Math.max(0,t+o.damping*rate*Math.min(1,cordStretch(t,o)/o.engage));
}
