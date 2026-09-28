// White-part screen. On the cream page (PALETTE.paper, #f3f0e9) a white or
// near-white solid reads as a hole rather than a part (e.g. lantern-wheel
// pegs). This loads every production model (model-loader.js, as the browser
// does) and lists the visible meshes whose material colour, or emissive
// colour, is near-white or near the paper colour: display-space (sRGB)
// luminance above --lum (default 0.8) and chroma (max - min channel) below
// --chroma (default 0.16). Textured materials are listed too (the colour
// multiplies the map); vertex-coloured materials are sampled per vertex.
// Invisible meshes, colour-write-off and near-zero-opacity materials are
// skipped. Each hit records the mesh role, material colour, opacity and a
// coarse class (fluid / glass / see-through / solid) for triage.
//
//   node scripts/screen-white-parts.mjs [--ids=1-507] [--out=/dev/shm/p91/white.json] [--jobs=12]
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as THREE from 'three';
import { expandIds, isFluidRole, loadProductionModel } from './screen-disconnected-parts.mjs';

const args = process.argv.slice(2);
const value = (name) => args.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);
const LUM = Number(value('--lum') ?? 0.8);
const CHROMA = Number(value('--chroma') ?? 0.16);

const srgb = (color) => {
  const c = color.clone().convertLinearToSRGB();
  return [c.r, c.g, c.b];
};
const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const chroma = (rgb) => Math.max(...rgb) - Math.min(...rgb);
const hex = (rgb) => `#${rgb.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('')}`;
const whiteish = (rgb) => lum(rgb) > LUM && chroma(rgb) < CHROMA;

function vertexWhiteFraction(geometry, base) {
  const colors = geometry.attributes.color;
  if (!colors) return 0;
  const c = new THREE.Color();
  let hits = 0;
  const stride = Math.max(1, Math.floor(colors.count / 2000));
  let n = 0;
  for (let i = 0; i < colors.count; i += stride, n += 1) {
    c.setRGB(colors.getX(i), colors.getY(i), colors.getZ(i)).multiply(base);
    if (whiteish(srgb(c))) hits += 1;
  }
  return n ? hits / n : 0;
}

export function screenWhite(model, id) {
  const root = model.root;
  const period = root.userData.animationTiming?.authoredCyclePeriod ?? 10;
  const visibleChain = (object) => {
    for (let node = object; node; node = node.parent) if (!node.visible) return false;
    return true;
  };
  const hits = [];
  const seen = new Set();
  // A mesh counts when it is visible in any of three sampled phases (markers
  // and fluid bodies toggle during the cycle).
  for (const time of [0.37, period * 0.41, period * 0.83]) {
    model.update?.(time, 0.016);
    root.updateMatrixWorld(true);
    root.traverse((object) => visit(object));
  }
  function visit(object) {
    if (!object.isMesh || seen.has(object) || !visibleChain(object) || object.userData.cameraFitGuide) return;
    seen.add(object);
    let named = object;
    while (named && !(named.userData.role || named.name)) named = named.parent;
    const role = named ? String(named.userData.role || named.name) : 'root';
    for (const material of [].concat(object.material ?? [])) {
      if (!material || material.visible === false || material.colorWrite === false || (material.opacity ?? 1) < 0.05) continue;
      const found = [];
      if (material.color) {
        const rgb = srgb(material.color);
        if (material.vertexColors) {
          const f = vertexWhiteFraction(object.geometry, material.color);
          if (f > 0.02) found.push({ channel: 'vertexColor', colour: hex(rgb), fraction: Number(f.toFixed(3)) });
        } else if (whiteish(rgb)) found.push({ channel: material.map ? 'color+map' : 'color', colour: hex(rgb), luminance: Number(lum(rgb).toFixed(3)) });
      }
      if (material.emissive && (material.emissiveIntensity ?? 1) > 0) {
        const e = srgb(material.emissive.clone().multiplyScalar(material.emissiveIntensity ?? 1));
        if (whiteish(e)) found.push({ channel: 'emissive', colour: hex(e), luminance: Number(lum(e).toFixed(3)) });
      }
      if (!found.length) continue;
      const seeThrough = Boolean(object.userData.seeThrough || material.userData?.seeThrough);
      const transparent = material.transparent && (material.opacity ?? 1) < 0.95;
      const kind = isFluidRole(role) || /water|steam|mercury|fluid|liquid|jet|spray|foam|froth|smoke/i.test(role) ? 'fluid'
        : /glass|lamp-chimney|bulb|lens/i.test(role) || (material.transmission ?? 0) > 0 ? 'glass'
          : seeThrough ? 'see-through' : transparent ? 'translucent' : 'solid';
      hits.push({ role, name: object.name || undefined, material: material.name || material.type, kind,
        opacity: Number((material.opacity ?? 1).toFixed(2)), rotationCue: Boolean(material.userData?.rotationIndicator || object.userData.rotationIndicator), found });
    }
  }
  const meshes = seen.size;
  // Merge identical role/colour rows (numbered pegs: 'wheelPinCap#').
  const merged = new Map();
  for (const hit of hits) {
    const key = `${hit.role.replace(/\d+$/, '#')}|${hit.kind}|${hit.found.map((f) => `${f.channel}${f.colour}`).join(',')}`;
    if (merged.has(key)) merged.get(key).count += 1;
    else merged.set(key, { ...hit, role: hit.role.replace(/\d+$/, '#'), count: 1 });
  }
  return { id, meshes, hits: [...merged.values()] };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain && value('--worker')) {
  const out = [];
  for (const id of expandIds(value('--worker'))) {
    try { out.push(screenWhite(await loadProductionModel(id), id)); } catch (error) { out.push({ id, status: 'error', error: String(error.stack ?? error).slice(0, 600) }); }
  }
  console.log(JSON.stringify(out));
  process.exit(0);
} else if (isMain) {
  for (const arg of args) if (!/^--(ids|out|jobs|chunk|lum|chroma)=/.test(arg)) throw new Error(`Unknown argument: ${arg}`);
  const ids = expandIds(value('--ids') ?? '1-507');
  const jobs = Number(value('--jobs') ?? 12);
  const chunk = Number(value('--chunk') ?? 12);
  const out = resolve(value('--out') ?? '/dev/shm/p91/white.json');
  const extra = args.filter((arg) => /^--(lum|chroma)=/.test(arg));
  const queue = [];
  for (let i = 0; i < ids.length; i += chunk) queue.push(ids.slice(i, i + chunk));
  const movements = [];
  const run = async () => {
    for (let batch = queue.shift(); batch; batch = queue.shift()) {
      try {
        const { stdout } = await promisify(execFile)(process.execPath, ['--max-old-space-size=8192', fileURLToPath(import.meta.url), `--worker=${batch.join(',')}`, ...extra], { timeout: 900000, maxBuffer: 256 * 1024 * 1024 });
        movements.push(...JSON.parse(stdout.trim().split('\n').at(-1)));
      } catch (error) {
        for (const id of batch) movements.push({ id, status: 'error', error: String(error.stderr || error.message).slice(0, 600) });
      }
      console.error(`done ${batch[0]}-${batch.at(-1)}`);
    }
  };
  await Promise.all(Array.from({ length: jobs }, run));
  movements.sort((a, b) => a.id - b.id);
  const withHits = movements.filter((m) => m.hits?.length);
  const report = { generatedAt: new Date().toISOString(), thresholds: { luminance: LUM, chroma: CHROMA, paper: '#f3f0e9' },
    scope: 'Visible meshes whose material colour or emissive colour is near-white/near-paper (sRGB luminance and chroma thresholds); includes textured and vertex-coloured materials; triage for recolouring.',
    summary: { movements: movements.length, errors: movements.filter((m) => m.status === 'error').map((m) => m.id), movementsWithHits: withHits.length,
      hitRows: withHits.reduce((n, m) => n + m.hits.length, 0),
      byKind: withHits.flatMap((m) => m.hits).reduce((acc, h) => ({ ...acc, [h.kind]: (acc[h.kind] ?? 0) + 1 }), {}) },
    movements: withHits.concat(movements.filter((m) => m.status === 'error')) };
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report.summary));
}
