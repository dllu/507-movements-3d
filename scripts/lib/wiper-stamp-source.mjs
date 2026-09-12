// Stroke-center reconstruction in brown-085-detail.png (native 1220 × 1350).
// Visible outlines are traced independently; hidden depths and the striking
// bed are assumptions, not measurements from the engraving.
export default {
  image: 'artifacts/reference/brown-085-detail.png', width: 1220, height: 1350,
  center: [438.72120905295014, 472.0322682236954], scale: 240,
  shaftRadius: 26.751441108424277, hubRadius: 51.014374975638376,
  rod: {left: 302, right: 361, top: 126, bottom: 1035, depth: .20, z: -.24},
  projection: {left: 302, right: 361, top: 306, bottom: 350},
  upperWiper: [
    ['moveTo', 438, 474], ['lineTo', 447, 422],
    ['bezierCurveTo', 420, 383, 385, 357, 347, 359],
    ['quadraticCurveTo', 334, 359, 326, 371],
    ['bezierCurveTo', 363, 387, 386, 414, 398, 442], ['lineTo', 438, 474],
  ],
  lowerWiper: [
    ['moveTo', 438, 474], ['lineTo', 481, 499],
    ['bezierCurveTo', 485, 544, 501, 582, 526, 606], ['lineTo', 526, 612],
    ['bezierCurveTo', 473, 612, 431, 576, 420, 524], ['lineTo', 438, 474],
  ],
  standard: [
    ['moveTo', 565, 126], ['lineTo', 657, 126],
    ['bezierCurveTo', 720, 166, 749, 240, 752, 322], ['lineTo', 749, 813],
    ['bezierCurveTo', 755, 1023, 821, 1193, 981, 1226],
    ['quadraticCurveTo', 1003, 1229, 1003, 1251], ['lineTo', 1003, 1275],
    ['lineTo', 565, 1275], ['lineTo', 565, 126],
  ],
  standardInset: [
    ['moveTo', 606, 127], ['lineTo', 657, 127],
    ['bezierCurveTo', 720, 166, 749, 240, 752, 322], ['lineTo', 749, 813],
    ['bezierCurveTo', 755, 1023, 821, 1193, 981, 1226],
    ['lineTo', 606, 1226], ['lineTo', 606, 127],
  ],
  guide: [
    ['moveTo', 274, 126], ['lineTo', 565, 126], ['lineTo', 565, 239], ['lineTo', 546, 239],
    ['bezierCurveTo', 525, 219, 512, 192, 491, 185], ['lineTo', 274, 185], ['lineTo', 274, 126],
  ],
  guideOffsets: [0, 620],
  lowerGuide: [
    ['moveTo', 274, 746], ['lineTo', 565, 746], ['lineTo', 565, 844], ['lineTo', 546, 844],
    ['lineTo', 491, 795], ['lineTo', 274, 795], ['lineTo', 274, 746],
  ],
  bearingArm: [
    ['moveTo', 438, 442], ['bezierCurveTo', 500, 446, 548, 436, 565, 397],
    ['lineTo', 565, 544], ['bezierCurveTo', 532, 509, 503, 495, 438, 499], ['lineTo', 438, 442],
  ],
  head: {centerX: 330, top: 1035, bottom: 1150,
    // Axial pixel position and radius; the two visible sides are averaged.
    profile: [[1035, 0], [1035, 58], [1045, 68], [1063, 77], [1094, 88], [1124, 97], [1150, 102], [1150, 0]]},
  floor: 1275,
  qualification: 'Manual stroke-center contours. The two wipers retain the visible asymmetry; their obscured roots are united with the common hub. Rod depth, cam thickness, bearing and guide bores, and all concealed construction require explicit 3D reconstruction.',
};
