import * as THREE from 'three';

// Bold italic serif numerals for engraved scales, in the style of Brown's
// plate lettering. Outlines are the digit glyphs of Liberation Serif Bold
// Italic 2.1.5 (TrueType units, 2048 per em; M/L/Q/Z path commands).
// Digitized data copyright (c) 2010 Google Corporation; copyright (c) 2012
// Red Hat, Inc. Licensed under the SIL Open Font License, Version 1.1
// (http://scripts.sil.org/OFL); the licence text is in LICENSES/OFL-1.1.txt.
const DIGIT_PATHS = Object.freeze({
  '0': 'M988,951 Q988,724,916,474 Q843,223,717,102 Q591,-20,410,-20 Q71,-20,71,399 Q71,635,144,879 Q216,1123,341,1242 Q466,1362,643,1362 Q988,1362,988,951 Z M741,970 Q741,1108,714,1180 Q686,1251,617,1251 Q531,1251,470,1138 Q410,1024,363,770 Q316,515,316,367 Q316,90,435,90 Q504,90,556,158 Q608,226,646,362 Q684,499,710,679 Q737,859,741,970 Z',
  '1': 'M578,110 L817,86 L802,0 L48,0 L63,86 L309,110 L486,1116 L233,1045 L248,1130 L665,1352 L797,1352 Z',
  '2': 'M825,0 L-25,0 L8,189 Q395,488,548,684 Q701,880,701,1049 Q701,1157,651,1206 Q601,1254,520,1254 Q431,1254,361,1202 L284,1008 L197,1008 L251,1313 Q335,1331,414,1344 Q492,1356,582,1356 Q769,1356,873,1279 Q977,1202,977,1067 Q977,969,938,876 Q899,783,824,694 Q748,605,620,502 Q491,400,192,206 L864,206 Z',
  '3': 'M347,-20 Q116,-20,-16,20 L29,345 L121,345 L135,130 Q154,114,217,98 Q280,81,336,81 Q474,81,551,160 Q628,239,628,394 Q628,509,578,566 Q529,622,432,633 L317,640 L339,761 L452,769 Q691,784,691,1051 Q691,1152,643,1203 Q595,1254,510,1254 Q420,1254,354,1202 L277,1008 L190,1008 L244,1313 Q346,1339,416,1348 Q486,1356,574,1356 Q760,1356,864,1278 Q969,1201,969,1065 Q969,911,883,819 Q797,727,631,702 Q762,681,834,598 Q906,516,906,397 Q906,200,755,90 Q604,-20,347,-20 Z',
  '4': 'M772,275 L725,0 L476,0 L523,275 L-32,275 L-4,428 L759,1348 L962,1348 L805,460 L962,460 L929,275 Z M681,1077 L171,460 L556,460 L625,846 Q638,915,681,1077 Z',
  '5': 'M516,798 Q709,798,811,708 Q913,618,913,450 Q913,226,764,103 Q615,-20,340,-20 Q265,-20,204,-14 Q143,-8,23,20 L68,345 L160,345 L174,130 Q202,107,252,94 Q302,81,354,81 Q490,81,564,176 Q639,270,639,445 Q639,687,442,687 Q402,687,348,676 Q294,666,250,648 L157,648 L279,1341 L971,1341 L935,1138 L369,1138 L306,773 Q396,798,516,798 Z',
  '6': 'M459,-20 Q271,-20,170,102 Q70,224,70,446 Q70,687,160,898 Q250,1108,406,1232 Q561,1356,742,1356 Q887,1356,1024,1313 L970,1008 L883,1008 L874,1202 Q810,1254,733,1254 Q605,1254,506,1116 Q407,979,360,742 Q498,815,624,815 Q777,815,860,728 Q944,641,944,483 Q944,339,884,224 Q825,108,714,44 Q604,-20,459,-20 Z M329,415 Q329,249,368,165 Q407,81,482,81 Q570,81,624,185 Q677,289,677,459 Q677,579,631,634 Q585,690,513,690 Q442,690,344,649 Q329,535,329,415 Z',
  '7': 'M254,958 L167,958 L235,1341 L1092,1341 L1078,1262 L345,0 L86,0 L860,1138 L331,1138 Z',
  '8': 'M993,1085 Q993,944,926,845 Q858,746,741,711 Q824,681,872,612 Q919,542,919,440 Q919,-20,419,-20 Q234,-20,136,70 Q37,161,37,321 Q37,477,118,578 Q198,679,337,711 Q273,745,234,818 Q195,891,195,980 Q195,1167,311,1264 Q427,1362,649,1362 Q818,1362,906,1290 Q993,1219,993,1085 Z M447,914 Q447,766,553,766 Q638,766,689,860 Q740,955,740,1109 Q740,1261,625,1261 Q540,1261,494,1171 Q447,1081,447,914 Z M289,272 Q289,83,443,83 Q553,83,610,183 Q666,283,666,471 Q666,654,513,654 Q404,654,346,552 Q289,449,289,272 Z',
  '9': 'M588,1355 Q769,1355,878,1226 Q988,1098,988,880 Q988,634,901,427 Q814,220,660,100 Q506,-20,326,-20 Q165,-20,30,23 L84,328 L171,328 L180,134 Q245,82,339,82 Q464,82,560,213 Q657,344,703,584 Q572,521,443,521 Q287,521,200,614 Q114,707,114,872 Q114,1008,174,1119 Q233,1230,342,1292 Q450,1355,588,1355 Z M730,883 Q730,1056,688,1156 Q647,1255,576,1255 Q488,1255,434,1150 Q379,1044,379,872 Q379,758,420,702 Q461,646,535,646 Q612,646,718,685 Q730,782,730,883 Z',
});

function digitShapes(digit) {
  const path = new THREE.ShapePath();
  for (const token of DIGIT_PATHS[digit].split(' ')) {
    const op = token[0];
    const values = token.slice(1).split(',').filter(Boolean).map(Number);
    if (op === 'M') path.moveTo(values[0], values[1]);
    else if (op === 'L') path.lineTo(values[0], values[1]);
    else if (op === 'Q') path.quadraticCurveTo(values[0], values[1], values[2], values[3]);
  }
  // TrueType outer contours run clockwise.
  return path.toShapes(true);
}

// A solid numeral `height` tall (digit ink height), `depth` thick, centred on
// the origin (x, y and z).
export function serifNumeralGeometry(value, height, depth) {
  const shapes = String(value).split('').flatMap((digit, index) => (
    digitShapes(digit).map((shape) => {
      const points = shape.extractPoints(6);
      const offset = index * 1024;
      const moved = new THREE.Shape(points.shape.map((p) => new THREE.Vector2(p.x + offset, p.y)));
      moved.holes = points.holes.map((hole) => new THREE.Path(hole.map((p) => new THREE.Vector2(p.x + offset, p.y))));
      return moved;
    })
  ));
  const geometry = new THREE.ExtrudeGeometry(shapes, { depth: 1, bevelEnabled: false, curveSegments: 1 });
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const scale = height / (box.max.y - box.min.y);
  geometry.translate(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, -0.5);
  geometry.scale(scale, scale, depth);
  geometry.computeVertexNormals();
  return geometry;
}
