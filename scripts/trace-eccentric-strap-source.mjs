import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {circleFit} from './lib/source-circle-fit.mjs';
import {freezeStudySources} from './lib/study-report-io.mjs';
const file = 'public/engravings/mm_089.png', width = 525, height = 525;
const bytes = execFileSync('convert', [file, '-colorspace', 'Gray', '-depth', '8', 'gray:-']);
const pixel = (x, y) => bytes[Math.round(y) * width + Math.round(x)] ?? 255;
const specifications = [
  ['strapOuter', [220,289], [121,136], 129, a => (a > 66 && a < 118) || (a > 244 && a < 298) || a < 15 || a > 345],
  ['sheaveFlange', [220,289], [102,119], 110, () => false],
  ['sheaveFace', [220,289], [84,102], 94, a => a > 125 && a < 225],
  ['shaftCollar', [159,289], [35,46], 40.5, () => false],
  ['shaft', [159,289], [18,26], 21, () => false],
];
const circles = {};
for (const [name, center, range, nominal, exclude] of specifications) {
  const readings = [], missing = [];
  for (let degrees = 0; degrees < 360; degrees += 5) {
    if (exclude(degrees)) continue;
    const a = degrees * Math.PI / 180, runs = []; let run = [];
    for (let r = range[0]; r <= range[1]; r += .25) {
      if (pixel(center[0] + r * Math.cos(a), center[1] - r * Math.sin(a)) < 80) run.push(r);
      else if (run.length) {runs.push(run); run = [];}
    }
    if (run.length) runs.push(run);
    const choices = runs.filter(r => r[0] > range[0] && r.at(-1) < range[1])
      .sort((a,b) => Math.abs((a[0]+a.at(-1))/2-nominal) - Math.abs((b[0]+b.at(-1))/2-nominal));
    if (!choices.length) {missing.push(degrees); continue;}
    const chosen = choices[0], radius = (chosen[0] + chosen.at(-1)) / 2;
    readings.push({degrees, stroke: [chosen[0], chosen.at(-1)], point: [center[0] + radius * Math.cos(a), center[1] - radius * Math.sin(a)]});
  }
  circles[name] = {...circleFit(readings.map(r => r.point)), readings, missing};
}
const landmarks = {
  upperLugs: {left:166, right:270, top:131, join:180, boltY:156, boltLeft:150, boltRight:291},
  lowerLugs: {left:167, right:270, bottom:453, join:397, boltY:424, boltLeft:151, boltRight:290},
  flange: {left:388, seam:403, right:419, top:229, bottom:357, upperBoltY:247, lowerBoltY:340},
  neck: {top:[[349,270],[364,272],[386,269]], bottom:[[349,316],[366,312],[386,314]]},
  rod: {top:[[419,273],[438,279],[464,282],[488,280]], bottom:[[419,314],[438,306],[464,305],[488,305]]},
};
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="525" height="525" viewBox="0 0 525 525">`;
const colors = ['#e600b8','#00a1a1','#0078ef','#d65e00','#00a62c'];
Object.entries(circles).forEach(([name,c],i) => {
  svg += `<circle cx="${c.center[0]}" cy="${c.center[1]}" r="${c.radius}" fill="none" stroke="${colors[i]}" stroke-width="1"/>`;
  for (const p of c.points) svg += `<circle cx="${p[0]}" cy="${p[1]}" r="1.2" fill="${colors[i]}"/>`;
});
for (const l of [landmarks.upperLugs,landmarks.lowerLugs]) svg += `<rect x="${l.left}" y="${l.top ?? l.join}" width="${l.right-l.left}" height="${(l.bottom ?? l.join)-(l.top ?? l.join)}" fill="none" stroke="#d65e00" stroke-width="1"/>`;
svg += '</svg>';
const prefix = 'artifacts/review/089-traced-source';
fs.writeFileSync(prefix+'.svg', svg, {flag:'wx'});
execFileSync('convert', ['-background','none',prefix+'.svg',prefix+'-overlay.png']);
execFileSync('convert', [file,prefix+'-overlay.png','-composite',prefix+'.png']);
const sources = freezeStudySources([file,'scripts/trace-eccentric-strap-source.mjs','scripts/lib/source-circle-fit.mjs'],prefix);
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:89,sources,circles,landmarks,uncertaintyPixels:3,
  interpretation:'Three circular outlines. The lugs obscure the outer strap arc near top and bottom. Prior measurement of those inner-arc heights as the outer ring height is superseded.'},null,2)+'\n',{flag:'wx'});
console.log(Object.fromEntries(Object.entries(circles).map(([name,c]) => [name,{center:c.center,radius:c.radius,rms:c.rmsResidual,max:c.maximumResidual,points:c.points.length,missing:c.missing}])));
