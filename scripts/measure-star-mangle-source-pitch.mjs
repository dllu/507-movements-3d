import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

// Read-only image measurement. The engraving is not resampled or edited.
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage(); await page.goto('http://127.0.0.1:5174/#/about');
  const result = await page.evaluate(async () => {
    const image = new Image(); image.src = '/artifacts/reference/brown-054-detail.png'; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    const samples = Array.from({ length: 4096 }, (_, i) => {
      const angle = 2 * Math.PI * i / 4096; let count = 0;
      for (let r = 382; r < 484; r += 1) {
        const x = Math.round(652 + r * Math.cos(angle)), y = Math.round(632 - r * Math.sin(angle));
        if (pixels[4 * (y * image.width + x)] < 85) count += 1;
      }
      return count / 102;
    });
    const scores = [];
    for (let count = 24; count <= 56; count += 1) {
      let x = 0, y = 0, total = 0;
      for (let i = 0; i < samples.length; i += 1) {
        const angle = 2 * Math.PI * i / samples.length, degrees = angle * 180 / Math.PI;
        if ((degrees > 140 && degrees < 174) || (degrees > 252 && degrees < 292)) continue;
        x += samples[i] * Math.cos(count * angle); y += samples[i] * Math.sin(count * angle); total += samples[i];
      }
      scores.push({ fullWheelPositions: count, normalizedAmplitude: Math.hypot(x, y) / total });
    }
    scores.sort((a, b) => b.normalizedAmplitude - a.normalizedAmplitude);
    return { source: 'brown-054-detail.png', centerPixels: [652, 632], sampledRadiiPixels: [382, 483],
      angleSamples: 4096, darknessRedThreshold: 85, excludedDegrees: [[140, 174], [252, 292]], scores,
      radialDarkness: samples };
  });
  result.interpretation = 'Pitch evidence from the repeated radial strokes. This estimates full-circle positions, not the hidden pinion tooth count or the number omitted beneath the crab. Brown does not dimension the construction.';
  await writeFile('artifacts/review/054-source-pitch-measurement.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result.scores.slice(0, 8)));
} finally { await browser.close(); }
