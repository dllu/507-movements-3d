/**
 * Build the local movement catalog from the public-domain text published by
 * 507movements.com. Existing site animations are deliberately not downloaded.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = 'https://507movements.com';
const MOVEMENT_COUNT = 507;
const CONCURRENCY = 6;
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(scriptDirectory, '../src/data/movements.json');

const categoryRules = [
  ['Epicyclic trains', 'epicyclic', /epicyclic|planet(?:ary)?\s+(?:gear|train)|sun[- ]and[- ]planet/i],
  ['Universal joints', 'universal-joint', /universal joint|ball and socket|joint/i],
  ['Bevel gearing', 'bevel-gears', /bevel|crown[- ](?:gear|wheel)|angle gear/i],
  ['Worm gearing', 'worm-gear', /worm|endless screw/i],
  ['Rack & pinion', 'rack-pinion', /rack|pinion/i],
  ['Ratchets & intermittent motion', 'ratchet', /ratchet|pawl|intermittent|mutilated|geneva/i],
  ['Escapements & horology', 'escapement', /escapement|escape[- ]wheel|horolog|watch|clock|fusee/i],
  ['Cams & followers', 'cam-follower', /\bcam\b|wiper|eccentric|tappet|waved wheel/i],
  ['Screws & threads', 'screw', /screw|thread|helic|micrometer/i],
  ['Governors & flywheels', 'governor', /governor|fly[- ]?ball|centrifugal|flywheel|gyroscope/i],
  ['Steam engines', 'steam-engine', /steam[- ]engine|steam engine|piston|cylinder|valve gear|indicator/i],
  ['Pumps & pneumatics', 'pump', /pump|bellows|ejector|siphon|compress(?:ed|or)|air[- ]pump/i],
  ['Hydraulics', 'hydraulic', /hydraulic|hydrostatic|water[- ]ram|pressure gauge|barometer|gasometer/i],
  ['Water wheels & turbines', 'waterwheel', /water[- ]wheel|water wheel|turbine|paddle[- ]wheel|barker|wind[- ]mill/i],
  ['Ropes, belts & pulleys', 'belt', /belt|band|pulley|pulleys|rope|windlass|capstan|hoist/i],
  ['Toothed gearing', 'gear-pair', /gear|toothed|wheel and pinion|cog/i],
  ['Friction drives', 'friction-drive', /friction|roller|cone[- ]pulley/i],
  ['Cranks & reciprocation', 'crank-slider', /crank|connecting[- ]rod|reciprocat|cross[- ]head|slider|piston[- ]rod/i],
  ['Levers & linkages', 'linkage', /lever|linkage|parallel motion|lazy[- ]tongs|toggle|treadle|pantograph|rod/i],
  ['Presses & clamps', 'press', /press|clamp|shear|punch|stamp|hammer|pile[- ]driver/i],
  ['Springs & balances', 'spring', /spring|balance|pendulum/i],
  ['Rotary machines', 'rotary-engine', /rotary engine|rotary motion|fan|propeller|drill|mill/i],
];

const authoredOverrides = new Map([
  [1, ['Ropes, belts & pulleys', 'belt-open']],
  [2, ['Ropes, belts & pulleys', 'belt-crossed']],
  [3, ['Ropes, belts & pulleys', 'belt-right-angle-guides']],
  [4, ['Ropes, belts & pulleys', 'belt-right-angle-crossed']],
  [5, ['Ropes, belts & pulleys', 'belt-tensioner']],
  [6, ['Ropes, belts & pulleys', 'belt-oscillating-sector']],
  [7, ['Ropes, belts & pulleys', 'belt-reversing-bevel']],
  [8, ['Ropes, belts & pulleys', 'belt-stepped-speed']],
  [9, ['Ropes, belts & pulleys', 'belt-cone-speed']],
  [10, ['Ropes, belts & pulleys', 'belt-nonlinear-cone']],
  [11, ['Ropes, belts & pulleys', 'belt-right-angle-twist']],
  [12, ['Ropes, belts & pulleys', 'pulley-fixed-hoist']],
  [13, ['Ropes, belts & pulleys', 'pulley-movable-hoist']],
  [14, ['Ropes, belts & pulleys', 'pulley-block-tackle']],
  [15, ['Ropes, belts & pulleys', 'pulley-white-compound']],
  [16, ['Ropes, belts & pulleys', 'pulley-spanish-barton-a']],
  [17, ['Ropes, belts & pulleys', 'pulley-spanish-barton-b']],
  [18, ['Ropes, belts & pulleys', 'pulley-two-fixed-one-moving']],
  [19, ['Ropes, belts & pulleys', 'pulley-cascade-a']],
  [20, ['Ropes, belts & pulleys', 'pulley-cascade-b']],
  [21, ['Ropes, belts & pulleys', 'pulley-cascade-c']],
  [22, ['Ropes, belts & pulleys', 'pulley-cascade-d']],
  [23, ['Ropes, belts & pulleys', 'pulley-tension-compensator']],
  [24, ['Toothed gearing', 'gear-spur-pair']],
  [25, ['Bevel gearing', 'gear-bevel-miter']],
  [26, ['Bevel gearing', 'gear-crown-spur']],
  [27, ['Toothed gearing', 'gear-multiple-radial-groove']],
  [28, ['Friction drives', 'friction-brush-wheels']],
  [29, ['Worm gearing', 'gear-disk-spiral']],
  [30, ['Toothed gearing', 'gear-rectangular-pair']],
  [31, ['Worm gearing', 'gear-worm-wheel']],
  [32, ['Friction drives', 'friction-wheel-pair']],
  [33, ['Toothed gearing', 'gear-elliptical-pair']],
  [34, ['Toothed gearing', 'gear-internal-pinion']],
  [35, ['Toothed gearing', 'gear-elliptical-sliding-pinion']],
  [36, ['Ratchets & intermittent motion', 'gear-mangle-reverser']],
  [37, ['Bevel gearing', 'gear-conical-stud']],
  [38, ['Toothed gearing', 'gear-variable-sector']],
  [39, ['Epicyclic trains', 'gear-sun-and-planet']],
  [40, ['Toothed gearing', 'gear-helical-a']],
  [41, ['Toothed gearing', 'gear-helical-b']],
  [42, ['Bevel gearing', 'gear-oblique-a']],
  [43, ['Bevel gearing', 'gear-oblique-b']],
  [44, ['Toothed gearing', 'gear-stepped-compound']],
  [45, ['Friction drives', 'friction-grooved-pair']],
  [46, ['Escapements & horology', 'horology-fusee']],
  [47, ['Clutches & couplings', 'clutch-friction']],
  [48, ['Clutches & couplings', 'clutch-geared-dog']],
  [49, ['Ratchets & intermittent motion', 'ratchet-bevel-continuous']],
  [50, ['Universal joints', 'universal-joint-a']],
  [51, ['Universal joints', 'universal-joint-b']],
  [52, ['Clutches & couplings', 'clutch-pin']],
  [53, ['Clutches & couplings', 'clutch-double-reversing']],
  [54, ['Ratchets & intermittent motion', 'gear-star-mangle']],
  [55, ['Differential & variable drives', 'gear-coaxial-differential']],
  [56, ['Clutches & couplings', 'gear-lever-engagement']],
  [57, ['Differential & variable drives', 'differential-belt-planetary']],
  [58, ['Differential & variable drives', 'speed-selector-geared-three']],
  [59, ['Differential & variable drives', 'speed-selector-geared-two']],
  [60, ['Differential & variable drives', 'speed-selector-dual-belt']],
  [61, ['Differential & variable drives', 'differential-bevel-braked']],
  [62, ['Differential & variable drives', 'differential-bevel-variable']],
]);

const combinedPageSlugs = new Map([
  [262, '262-263'],
  [263, '262-263'],
]);

function movementUrl(id) {
  const slug = combinedPageSlugs.get(id) ?? String(id).padStart(3, '0');
  return `${ROOT}/mm_${slug}.html`;
}

function decodeEntities(value) {
  const named = {
    amp: '&', apos: "'", gt: '>', hellip: '…', laquo: '«', ldquo: '“',
    lsquo: '‘', lt: '<', mdash: '—', nbsp: ' ', ndash: '–', quot: '"',
    raquo: '»', rdquo: '”', rsquo: '’', shy: '',
  };

  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, key) => {
    if (key[0] === '#') {
      const hexadecimal = key[1]?.toLowerCase() === 'x';
      const codePoint = Number.parseInt(key.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
    }
    return named[key.toLowerCase()] ?? entity;
  });
}

function plainText(html) {
  return decodeEntities(
    html
      .replace(/<br\s*\/?\s*>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

function stripNumberPrefix(value) {
  return value
    .replace(/^\s*\d+(?:\s*(?:,|and|&|-)\s*\d+)*\s*[.,:]?\s*/i, '')
    .trim();
}

function compactTitle(description) {
  const cleaned = stripNumberPrefix(description)
    .replace(/^(?:illustrates?|shows?|represents?)\s+/i, '')
    .replace(/^is\s+(?:a|an|the)\s+/i, '')
    .replace(/^(?:a|an|the)\s+/i, '');
  let sentence = cleaned;
  for (const match of cleaned.matchAll(/[.!?](?=\s|$)/g)) {
    // Ignore periods in initials such as “C. R. Otis”.
    if (match.index >= 24) {
      sentence = cleaned.slice(0, match.index);
      break;
    }
  }
  sentence = sentence.replace(/[.!?]+$/, '');
  if (sentence.length <= 76) return sentence;
  const breakAt = Math.max(sentence.lastIndexOf(',', 72), sentence.lastIndexOf(';', 72));
  const clipped = breakAt > 28 ? sentence.slice(0, breakAt) : sentence.slice(0, 72).replace(/\s+\S*$/, '');
  return `${clipped}…`;
}

function classify(id, title, description) {
  const authored = authoredOverrides.get(id);
  if (authored) {
    return { category: authored[0], archetype: authored[1], fidelity: 'authored' };
  }

  const corpus = `${title} ${description}`;
  for (const [category, archetype, pattern] of categoryRules) {
    if (pattern.test(corpus)) return { category, archetype, fidelity: 'procedural' };
  }
  return { category: 'Miscellaneous mechanisms', archetype: 'generic-kinematic', fidelity: 'procedural' };
}

async function fetchText(url, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': '507-movements-3d-catalog/0.1 (+local build)' },
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolveDelay) => setTimeout(resolveDelay, 300 * attempt));
    }
  }
  throw new Error(`Unable to fetch ${url}: ${lastError?.message ?? 'unknown error'}`);
}

async function loadIndexTitles() {
  const pages = [`${ROOT}/`];
  for (let page = 1; page <= 56; page += 1) {
    pages.push(`${ROOT}/index${String(page).padStart(2, '0')}.html`);
  }

  const titles = new Map();
  for (let offset = 0; offset < pages.length; offset += CONCURRENCY) {
    const batch = await Promise.all(
      pages.slice(offset, offset + CONCURRENCY).map((url) => fetchText(url)),
    );
    for (const html of batch) {
      const expression = /href="\/mm_(\d{3})\.html"[^>]*>\s*<img[^>]*\balt="([^"]*)"/gi;
      for (const match of html.matchAll(expression)) {
        titles.set(Number.parseInt(match[1], 10), plainText(match[2]));
      }
    }
  }
  return titles;
}

function parseMovementPage(id, html, indexTitle) {
  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
  const pageTitle = stripNumberPrefix(
    plainText(titleMatch?.[1] ?? '').replace(/^507 Mechanical Movements,?\s*/i, ''),
  );
  const descriptionMatch = html.match(/class="anitab"[\s\S]*?<\/div>\s*<\/div>\s*<p>([\s\S]*?)<\/p>/i);
  if (!descriptionMatch) throw new Error(`Movement ${id}: description paragraph not found`);
  const description = plainText(descriptionMatch[1]);
  const indexLabel = stripNumberPrefix(indexTitle ?? '');
  const explicitTitle = [indexLabel, pageTitle]
    .find((candidate) => candidate.replace(/[^a-z]/gi, '').length >= 2);
  const title = explicitTitle || compactTitle(description) || `Mechanical movement ${id}`;
  const classification = classify(id, title, description);

  return {
    id,
    number: String(id).padStart(3, '0'),
    title,
    description,
    ...classification,
    ...(id === 15 ? {
      mechanicalNote: "The pictured fixed rope anchor and three lower sheaves give six supporting rope parts: nominally 6:1. Brown's printed ‘1 to 7’ would require a different rope termination or an additional sheave. This model follows the engraving's downward hauling end; small fleet angles cause slight variation from 6:1.",
    } : {}),
    sourceUrl: movementUrl(id),
  };
}

async function buildCatalog() {
  console.log('Fetching thumbnail indexes…');
  const indexTitles = await loadIndexTitles();
  if (indexTitles.size < 500) {
    throw new Error(`Expected at least 500 indexed movements, found ${indexTitles.size}`);
  }
  if (indexTitles.size !== MOVEMENT_COUNT) {
    const missing = Array.from({ length: MOVEMENT_COUNT }, (_, index) => index + 1)
      .filter((id) => !indexTitles.has(id));
    console.warn(`Thumbnail index omits ${missing.join(', ')}; deriving their titles from the text.`);
  }

  const movements = [];
  for (let offset = 1; offset <= MOVEMENT_COUNT; offset += CONCURRENCY) {
    const ids = Array.from(
      { length: Math.min(CONCURRENCY, MOVEMENT_COUNT - offset + 1) },
      (_, index) => offset + index,
    );
    const pages = await Promise.all(
      ids.map((id) => fetchText(movementUrl(id))),
    );
    pages.forEach((html, index) => movements.push(parseMovementPage(ids[index], html, indexTitles.get(ids[index]))));
    if (movements.length % 60 < CONCURRENCY || movements.length === MOVEMENT_COUNT) {
      console.log(`Fetched ${movements.length}/${MOVEMENT_COUNT}`);
    }
  }

  const catalog = {
    generatedAt: new Date().toISOString(),
    source: ROOT,
    sourceNote: 'Descriptions derive from Henry T. Brown’s public-domain 1908 edition. Simulations are original and do not reproduce the source site animations.',
    movementCount: MOVEMENT_COUNT,
    movements,
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${outputPath}`);
}

await buildCatalog();
