import fs from 'node:fs';
import {makeSpringRackCandidate} from './lib/spring-rack-candidate.mjs';
import {makeSpringRackCoil} from './lib/spring-rack-coil.mjs';
const data=JSON.parse(fs.readFileSync('artifacts/review/081-seamed-playback-data.json')),
 model=makeSpringRackCandidate(data.geometry),p=model.root.userData.geometry,spring=p.spring,
 referenceSpan=spring.top-spring.bottom-2*spring.wireRadius,coil=makeSpringRackCoil({...spring,referenceSpan}),
 spanMax=referenceSpan-data.range[0],radiusMin=coil.radiusAt(spanMax),W=2*Math.PI*spring.turns,hmax=1/(1-.5/spring.turns),
 radiusDerivative=spanMax*hmax*hmax/(W*W*radiusMin),
 frameDerivative=hmax/(W*radiusMin)*(1+spanMax*radiusDerivative/radiusMin),
 vertexLipschitz=Math.hypot(1,radiusDerivative)+spring.wireRadius*frameDerivative,
 refinement=JSON.parse(fs.readFileSync('artifacts/review/081-first-dynamics-assessment.json')).comparisons.at(-1).maximum.pixels,
 projection=JSON.parse(fs.readFileSync('artifacts/review/081-continuous-playback-bound.json')).projectionPixels,
 compression=data.sourcePixelCompressionTolerance,
 meshRoundoff=2*Math.sqrt(3)*2**-22*p.source.scale,
 combinedScalar=refinement+projection+compression,combinedVertex=combinedScalar*vertexLipschitz+meshRoundoff,
 report={movement:81,passed:combinedVertex<.25,refinementPixels:refinement,compressionPixels:compression,projectionPixels:projection,
 radiusDerivativeBound:radiusDerivative,binormalDerivativeBound:frameDerivative,vertexLipschitz,meshRoundoffPixels:meshRoundoff,
 combinedScalarPixels:combinedScalar,combinedSpringVertexPixels:combinedVertex,
 method:'Implicit differentiation of the positive-weight constant-length quadrature bounds radius change. The normalized helix section frame supplies a derivative bound for every spring vertex. Sum scalar refinement, compression and continuous projection bounds, multiply by this vertex Lipschitz constant, and add Float32 rounding.',
 qualification:'The time-step term is observed agreement between two integrations. Compression and contact-projection terms are bounds for the piecewise linear data. This is not a certified error estimate against the unknown exact physical trajectory.'};
fs.writeFileSync('artifacts/review/081-combined-vertex-error.json',JSON.stringify(report,null,2)+'\n');console.log(report);if(!report.passed)process.exitCode=1;
