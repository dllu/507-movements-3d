import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage(); await page.goto('http://127.0.0.1:5174/#/about');
  const report = await page.evaluate(async () => {
    const image = new Image(); image.src = '/artifacts/reference/brown-055-detail.png'; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    const gears = [
      { name: 'A', center: [614, 681], radii: [128, 169], candidates: [12, 26], excluded: [[150, 225]] },
      { name: 'B', center: [385, 699], radii: [74, 109], candidates: [6, 16], excluded: [[0, 35], [160, 200], [325, 360]] },
      { name: 'C', center: [611, 684], radii: [301, 338], candidates: [26, 46], excluded: [[165, 195]] },
    ];
    return gears.map(gear => {
      const boundary = [];
      const samples = Array.from({ length: 4096 }, (_, i) => {
        const angle = 2 * Math.PI * i / 4096; let count = 0, maximum = gear.radii[0];
        for (let r = gear.radii[0]; r <= gear.radii[1]; r += 1) {
          const x = Math.round(gear.center[0] + r * Math.cos(angle)), y = Math.round(gear.center[1] - r * Math.sin(angle));
          if (pixels[4 * (y * image.width + x)] < 85) { count += 1; maximum = r; }
        }
        boundary.push(maximum);
        return count / (gear.radii[1] - gear.radii[0] + 1);
      });
      const score = values => {
        const included = values.map((value, i) => ({ value, angle: 2 * Math.PI * i / values.length }))
          .filter(v => !gear.excluded.some(([a, b]) => v.angle * 180 / Math.PI >= a && v.angle * 180 / Math.PI <= b));
        const mean = included.reduce((sum, v) => sum + v.value, 0) / included.length, scores = [];
        for (let teeth = gear.candidates[0]; teeth <= gear.candidates[1]; teeth += 1) {
        let x = 0, y = 0, total = 0;
        included.forEach(({ value, angle }) => {
          const centered = value - mean;
          x += centered * Math.cos(teeth * angle); y += centered * Math.sin(teeth * angle); total += Math.abs(centered);
        });
        scores.push({ teeth, amplitude: Math.hypot(x, y) / total });
        }
        return scores.sort((a, b) => b.amplitude - a.amplitude);
      };
      return { ...gear, angleSamples: samples.length, redThreshold: 85, scores: score(samples), boundaryScores: score(boundary), radialDarkness: samples, boundary };
    });
  });
  await writeFile('artifacts/review/055-source-pitch-measurement.json', JSON.stringify({ source: '../reference/brown-055-detail.png',
    method: 'Read-only radial darkness and angular Fourier amplitudes, with meshing occlusions excluded. The original engraving pixels are unchanged.', gears: report }, null, 2) + '\n');
  console.log(JSON.stringify(report.map(g => ({ gear: g.name, candidates: g.scores.slice(0, 4), boundary: g.boundaryScores.slice(0, 4) }))));
} finally { await browser.close(); }
