// A canvas can be visible while its mechanism is cropped. Measure foreground
// pixels in a rendered screenshot; this also works without preserveDrawingBuffer.
export async function visibleForegroundBounds(canvas) {
  const png = (await canvas.screenshot()).toString('base64');
  return canvas.evaluate(async (_, data) => {
    const image = new Image();
    image.src = 'data:image/png;base64,' + data;
    await image.decode();
    const surface = document.createElement('canvas');
    surface.width = image.width;
    surface.height = image.height;
    const context = surface.getContext('2d');
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, surface.width, surface.height).data;
    // Fractional CSS bounds can include a one-pixel stage border. Use the
    // dominant interior color for the paper, and skip that border itself.
    const colors = new Map();
    for (let i = 0; i < pixels.length; i += 64) {
      const color = (pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2];
      colors.set(color, (colors.get(color) ?? 0) + 1);
    }
    const paper = [...colors].sort((a, b) => b[1] - a[1])[0][0];
    const background = [paper >> 16, (paper >> 8) & 255, paper & 255];
    let minX = surface.width, minY = surface.height, maxX = -1, maxY = -1, count = 0;
    for (let y = 2; y < surface.height - 2; y++) {
      for (let x = 2; x < surface.width - 2; x++) {
        const i = 4 * (y * surface.width + x);
        if (Math.max(...background.map((color, channel) => Math.abs(pixels[i + channel] - color))) < 40) continue;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y); count++;
      }
    }
    return { minX: minX / surface.width, minY: minY / surface.height,
      maxX: maxX / surface.width, maxY: maxY / surface.height, count };
  }, png);
}

export function hasFrameMargin(bounds) {
  return bounds.count > 2000 && bounds.minX > 0.015 && bounds.minY > 0.015
    && bounds.maxX < 0.985 && bounds.maxY < 0.985;
}
