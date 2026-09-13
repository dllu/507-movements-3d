// Pixel readings from public/engravings/mm_089.png, checked against the ink
// traces in scripts/trace-eccentric-strap-source.mjs. Three visible circles
// share a reconstructed center; the split lugs hide the outer top/bottom arc.
export default {
  width: 525, height: 525, scale: 100, center: [221.5, 288], shaft: [159, 288],
  outerRadius: 128.56557585790387, flangeRadius: 109.36347874983694,
  faceRadius: 92.35847656491967, collarRadius: 40.34872788817052,
  shaftRadius: 20.783991961265176,
  clamp: {left:166, right:270, seam:217, upperTop:131, lowerBottom:453, upperBoltY:156, lowerBoltY:424},
  flange: {left:388, right:419, top:229, bottom:357, upperBoltY:247, lowerBoltY:340},
  neckTop: [[348,270],[356,271],[364,272],[375,271],[388,269]],
  neckBottom: [[348,316],[357,314],[366,312],[377,312],[388,314]],
  rodTop: [[419,273],[430,277],[438,279],[451,281],[464,282],[488,280]],
  rodBottom: [[419,314],[430,309],[438,306],[451,305],[464,305],[488,305]],
  uncertaintyPixels: 3,
  qualification: 'Shared sheave/strap center and horizontal shaft alignment normalize small drawing discrepancies. Plate depths, running clearances, press fits, split construction, and completed rod/crosshead/supports are reconstructed.',
};
