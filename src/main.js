import catalog from './data/movements.json';
import { MovementEngine } from './simulation/async-engine.js';
import './styles.css';

const PAGE_SIZE = 12;
const app = document.querySelector('#app');
const movements = catalog.movements;
const movementById = new Map(movements.map((movement) => [movement.id, movement]));
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let activeCleanup = () => {};

// Soft ambient occlusion in the 3D view: 'auto' (default; on unless the device
// looks low-end or frames turn slow), 'on' or 'off'. Override per visit with
// #/movement/7?ao=off or persistently with localStorage['507.ambientOcclusion'].
function ambientOcclusionPreference() {
  const valid = new Set(['auto', 'on', 'off']);
  const fromHash = new URLSearchParams(location.hash.split('?')[1] ?? '').get('ao');
  if (valid.has(fromHash)) return fromHash;
  try {
    const stored = localStorage.getItem('507.ambientOcclusion');
    if (valid.has(stored)) return stored;
  } catch { /* storage unavailable */ }
  return 'auto';
}

const categoryCounts = movements.reduce((counts, movement) => {
  counts.set(movement.category, (counts.get(movement.category) ?? 0) + 1);
  return counts;
}, new Map());
const categories = [...categoryCounts.entries()].sort(([categoryA], [categoryB]) => categoryA.localeCompare(categoryB));

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function cleanDescription(movement) {
  return movement.description.replace(/^\s*\d+(?:\s*(?:,|and|&|-)\s*\d+)*\.\s*/i, '');
}

function compact(value, length = 150) {
  if (value.length <= length) return value;
  return `${value.slice(0, length).replace(/\s+\S*$/, '')}…`;
}

function sourceImagePath(movement) {
  return `./engravings/mm_${movement.number}.png`;
}

function appShell(content, active = 'catalog') {
  return `
    <header class="site-header">
      <div class="header-inner">
        <a class="brand" href="#/catalog?page=1" aria-label="507 Movements home">
          <span class="brand-mark">507</span>
          <span class="brand-copy">Mechanical Movements</span>
        </a>
        <nav class="site-nav" aria-label="Primary navigation">
          <a href="#/catalog?page=1" ${active === 'catalog' ? 'aria-current="page"' : ''}>Catalog</a>
          <a href="#/about" ${active === 'about' ? 'aria-current="page"' : ''}>About</a>
        </nav>
      </div>
    </header>
    <main id="main">${content}</main>
  `;
}

function catalogHref(page, query, category) {
  const parameters = new URLSearchParams();
  parameters.set('page', String(page));
  if (query) parameters.set('q', query);
  if (category) parameters.set('category', category);
  return `#/catalog?${parameters.toString()}`;
}

function pagination(currentPage, totalPages, query, category) {
  if (totalPages <= 1) return '';
  const windowStart = Math.max(1, Math.min(currentPage - 3, totalPages - 6));
  const windowEnd = Math.min(totalPages, windowStart + 6);
  const candidates = new Set([1, totalPages]);
  for (let page = windowStart; page <= windowEnd; page += 1) candidates.add(page);
  const pages = [...candidates].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
  const items = [];
  let previous;
  for (const page of pages) {
    if (previous && page - previous > 1) items.push('<span class="page-gap" aria-hidden="true">…</span>');
    items.push(page === currentPage
      ? `<span class="page-link is-current" aria-current="page">${page}</span>`
      : `<a class="page-link" href="${catalogHref(page, query, category)}" aria-label="Page ${page}">${page}</a>`);
    previous = page;
  }
  return `
    <nav class="pagination" aria-label="Catalog pages">
      ${currentPage > 1 ? `<a class="page-arrow" href="${catalogHref(currentPage - 1, query, category)}" aria-label="Previous page">← <span>Previous</span></a>` : '<span class="page-arrow is-disabled">← <span>Previous</span></span>'}
      <div class="page-numbers">${items.join('')}</div>
      ${currentPage < totalPages ? `<a class="page-arrow" href="${catalogHref(currentPage + 1, query, category)}" aria-label="Next page"><span>Next</span> →</a>` : '<span class="page-arrow is-disabled"><span>Next</span> →</span>'}
    </nav>`;
}

function catalogView(parameters) {
  const query = (parameters.get('q') ?? '').trim();
  const category = parameters.get('category') ?? '';
  const requestedPage = Number.parseInt(parameters.get('page') ?? '1', 10);
  const normalizedQuery = query.toLocaleLowerCase();
  const filtered = movements.filter((movement) => {
    if (category && movement.category !== category) return false;
    if (!normalizedQuery) return true;
    return `${movement.id} ${movement.title} ${movement.description} ${movement.category}`.toLocaleLowerCase().includes(normalizedQuery);
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(Math.max(Number.isFinite(requestedPage) ? requestedPage : 1, 1), totalPages);
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const start = filtered.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const end = Math.min(page * PAGE_SIZE, filtered.length);

  const cards = visible.map((movement) => {
    return `
    <article class="movement-card">
      <a class="card-visual" href="#/movement/${movement.number}" aria-label="Open movement ${movement.id}: ${escapeHtml(movement.title)}">
        <span class="card-number">${movement.number}</span>
        <img src="${sourceImagePath(movement)}" alt="" loading="lazy" decoding="async" />
      </a>
      <div class="card-body">
        <p class="card-category">${escapeHtml(movement.category)}</p>
        <h2><a href="#/movement/${movement.number}">${escapeHtml(movement.title)}</a></h2>
        <p>${escapeHtml(compact(cleanDescription(movement), 145))}</p>
      </div>
    </article>`;
  }).join('');

  const content = `
    <section class="catalog-section" aria-labelledby="catalog-title">
      <div class="section-inner">
        <div class="catalog-heading">
          <h1 id="catalog-title">Mechanical Movements</h1>
          <p class="result-count" aria-live="polite">${start}–${end} of ${filtered.length}</p>
        </div>
        <form class="catalog-filters" id="catalog-filters" role="search">
          <label class="search-field">
            <span class="visually-hidden">Search movements</span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 5 5" /></svg>
            <input type="search" name="q" value="${escapeHtml(query)}" placeholder="Search movements" autocomplete="off" />
          </label>
          <label class="category-field">
            <span class="visually-hidden">Filter by family</span>
            <select name="category">
              <option value="">All families</option>
              ${categories.map(([name, count]) => `<option value="${escapeHtml(name)}" ${category === name ? 'selected' : ''}>${escapeHtml(name)} (${count})</option>`).join('')}
            </select>
          </label>
          <button type="submit">Apply</button>
          ${(query || category) ? '<button class="clear-filters" type="button">Clear</button>' : ''}
        </form>
        ${visible.length ? `<div class="movement-grid">${cards}</div>` : `
          <div class="empty-state">
            <span>0</span>
            <h2>No movements found</h2>
            <p>Try a broader term or clear the mechanism family.</p>
            <a href="#/catalog?page=1">Reset the catalog</a>
          </div>`}
        ${pagination(page, totalPages, query, category)}
      </div>
    </section>`;

  document.title = `${query || category ? 'Filtered catalog' : '507 Movements'} — in 3D`;
  app.innerHTML = appShell(content, 'catalog');
  const form = document.querySelector('#catalog-filters');
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    location.hash = catalogHref(1, String(data.get('q') ?? '').trim(), String(data.get('category') ?? '')).slice(1);
  });
  form?.querySelector('select')?.addEventListener('change', () => form.requestSubmit());
  form?.querySelector('.clear-filters')?.addEventListener('click', () => {
    location.hash = '/catalog?page=1';
  });
}

async function detailView(movement) {
  const previous = movementById.get(movement.id - 1);
  const next = movementById.get(movement.id + 1);
  const content = `
    <section class="detail-page">
      <div class="detail-inner">
        <div class="detail-heading">
          <div>
            <p class="eyebrow">Movement ${movement.number} · ${escapeHtml(movement.category)}</p>
            <h1>${escapeHtml(movement.title)}</h1>
          </div>
          <div class="detail-sequence" aria-label="Movement navigation">
            ${previous ? `<a href="#/movement/${previous.number}" aria-label="Previous movement, ${escapeHtml(previous.title)}">← <span>${previous.number}</span></a>` : '<span class="is-disabled">←</span>'}
            ${next ? `<a href="#/movement/${next.number}" aria-label="Next movement, ${escapeHtml(next.title)}"><span>${next.number}</span> →</a>` : '<span class="is-disabled">→</span>'}
          </div>
        </div>
        <div class="detail-workspace">
          <div class="detail-layout">
            <div class="simulation-panel">
              <div class="simulation-stage" id="simulation-stage">
                <div class="simulation-loading" aria-live="polite">
                  <span></span><p>Loading…</p>
                </div>
              </div>
            </div>
            <a class="source-engraving" href="${escapeHtml(movement.sourceUrl)}" target="_blank" rel="noreferrer">
              <img src="${sourceImagePath(movement)}" alt="Original engraving for Movement ${movement.number}" />
              <span>Original engraving <i aria-hidden="true">↗</i></span>
            </a>
            <aside class="movement-notes" aria-label="Source description and reconstruction notes" tabindex="0">
              <p class="movement-description">${escapeHtml(cleanDescription(movement))}</p>
              ${movement.mechanicalNote ? `<p class="mechanical-correction">${escapeHtml(movement.mechanicalNote)}</p>` : ''}
              <details class="reconstruction-notes" hidden>
                <summary>Reconstruction notes</summary>
              </details>
            </aside>
          </div>
        </div>
        <div class="simulation-toolbar" aria-label="Simulation controls">
          <button class="play-control" type="button" aria-pressed="${!prefersReducedMotion.matches}">
            <span class="control-icon" aria-hidden="true">${prefersReducedMotion.matches ? '▶' : 'Ⅱ'}</span>
            <span class="control-label">${prefersReducedMotion.matches ? 'Play' : 'Pause'}</span>
          </button>
          <label class="speed-control">Speed
            <select aria-label="Animation speed">
              <option value="0.5">0.5×</option>
              <option value="1" selected>1×</option>
              <option value="1.5">1.5×</option>
              <option value="2">2×</option>
            </select>
          </label>
          <button class="reset-control" type="button"><span aria-hidden="true">↺</span> Reset view</button>
          <button class="fullscreen-control" type="button"><span aria-hidden="true">⛶</span> Full screen</button>
        </div>
      </div>
    </section>`;

  document.title = `${movement.number} · ${movement.title} — 507 Movements`;
  app.innerHTML = appShell(content, 'catalog');
  const stage = document.querySelector('#simulation-stage');
  const toolbar = document.querySelector('.simulation-toolbar');
  const abortController = new AbortController();
  let engine;
  const onCanvasKeyDown = (event) => {
    if (event.code === 'Space') {
      event.preventDefault();
      engine?.togglePlaying();
    }
    if (event.key.toLowerCase() === 'r') engine?.resetView();
  };
  activeCleanup = () => {
    abortController.abort();
    engine?.renderer.domElement.removeEventListener('keydown', onCanvasKeyDown);
    engine?.dispose();
  };
  toolbar.querySelectorAll('button, select').forEach(control => { control.disabled = true; });
  stage.setAttribute('aria-busy', 'true');
  try {
    engine = await MovementEngine.create(stage, movement, {
      playing: !prefersReducedMotion.matches, signal: abortController.signal,
      ambientOcclusion: ambientOcclusionPreference(),
    });
  } catch (error) {
    if (abortController.signal.aborted) return;
    console.error(error);
    stage.innerHTML = `
      <div class="simulation-error" role="alert">
        <strong>The 3D view could not start.</strong>
        <p>Reload to try again. If the problem continues, check that your browser supports WebGL and WebAssembly.</p>
      </div>`;
    stage.setAttribute('aria-busy', 'false');
    return;
  }
  stage.setAttribute('aria-busy', 'false');
  toolbar.querySelectorAll('button, select').forEach(control => { control.disabled = false; });

  const playButton = document.querySelector('.play-control');
  const updatePlayButton = (playing) => {
    if (!playButton) return;
    playButton.setAttribute('aria-pressed', String(playing));
    playButton.querySelector('.control-icon').textContent = playing ? 'Ⅱ' : engine?.playbackEnded ? '↻' : '▶';
    playButton.querySelector('.control-label').textContent = playing ? 'Pause' : engine?.playbackEnded ? 'Replay' : 'Play';
  };
  if (engine) engine.onPlaybackChange = ({ playing }) => updatePlayButton(playing);
  playButton?.addEventListener('click', () => updatePlayButton(engine?.togglePlaying() ?? false));
  document.querySelector('.speed-control select')?.addEventListener('change', (event) => engine?.setSpeed(event.target.value));
  document.querySelector('.reset-control')?.addEventListener('click', () => engine?.resetView());
  if (engine.model.root.userData.supportsRestart) {
    const restart = document.createElement('button');
    restart.className = 'restart-control';
    restart.type = 'button';
    restart.textContent = 'Restart';
    restart.addEventListener('click', () => engine.restart());
    document.querySelector('.reset-control').before(restart);
    toolbar.classList.add('has-configuration');
  }
  const reconstructionNote = engine.model.root.userData.reconstructionNote;
  if (reconstructionNote) {
    const note = document.createElement('p');
    note.textContent = reconstructionNote;
    const notes = document.querySelector('.reconstruction-notes');
    notes.hidden = false;
    notes.append(note);
  }
  if (engine?.model.root.userData.setConfiguration && engine.model.root.userData.configurations?.length) {
    const data = engine.model.root.userData;
    const label = document.createElement('label');
    label.className = 'configuration-control';
    label.append(document.createTextNode(data.configurationLabel ?? 'Configuration'));
    const select = document.createElement('select');
    for (const { id, label: optionLabel } of data.configurations) {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = optionLabel;
      select.append(option);
    }
    select.value = data.configuration;
    select.addEventListener('change', () => engine.setConfiguration(select.value));
    label.append(select);
    document.querySelector('.reset-control')?.before(label);
    document.querySelector('.simulation-toolbar')?.classList.add('has-configuration');
  }
  if (engine?.model.root.userData.setSectionView) {
    const sectionButton = document.createElement('button');
    sectionButton.className = 'section-control';
    sectionButton.type = 'button';
    sectionButton.textContent = 'Section view';
    sectionButton.setAttribute('aria-pressed', String(engine.model.root.userData.sectionView));
    sectionButton.addEventListener('click', () => {
      const enabled = !engine.model.root.userData.sectionView;
      engine.model.root.userData.setSectionView(enabled);
      engine.fitCamera(enabled ? engine.model.cameraDirection
        : engine.model.root.userData.fullCameraDirection ?? engine.model.cameraDirection);
      engine.updateGroundClearance();
      sectionButton.setAttribute('aria-pressed', String(enabled));
    });
    document.querySelector('.fullscreen-control')?.before(sectionButton);
  }
  document.querySelector('.fullscreen-control')?.addEventListener('click', async () => {
    if (!document.fullscreenElement) await stage.requestFullscreen?.();
    else await document.exitFullscreen?.();
  });
  engine?.renderer.domElement.addEventListener('keydown', onCanvasKeyDown);
}

function aboutView() {
  const content = `
    <section class="about-content">
      <div class="about-inner">
        <h1>About</h1>
        <p>3D reconstructions of Henry T. Brown’s <cite>507 Mechanical Movements</cite>, with the original engravings and descriptions.</p>
        <p>Descriptions come from the public-domain 1908 edition. The engravings and motion references are from <a href="https://507movements.com/" target="_blank" rel="noreferrer">507movements.com</a>. Its animations are used for reference and are not included here.</p>
        <p>The models use analytical motion or MuJoCo simulation. Inferred geometry and known limitations are recorded in each model’s reconstruction notes where available.</p>
      </div>
    </section>`;
  document.title = 'About — 507 Movements in 3D';
  app.innerHTML = appShell(content, 'about');
}

function notFoundView() {
  const content = `
    <section class="not-found">
      <span>404</span><h1>Movement not found.</h1>
      <p>Choose a movement from 001 to 507.</p>
      <a href="#/catalog?page=1">Return to the catalog</a>
    </section>`;
  document.title = 'Not found — 507 Movements';
  app.innerHTML = appShell(content);
}

function route() {
  activeCleanup();
  activeCleanup = () => {};
  const hash = location.hash.slice(1) || '/catalog?page=1';
  const [path, queryString = ''] = hash.split('?');
  if (path === '/catalog' || path === '/') {
    catalogView(new URLSearchParams(queryString));
  } else if (path === '/about') {
    aboutView();
  } else {
    const movementMatch = path.match(/^\/movement\/(\d{1,3})$/);
    if (movementMatch) {
      const movement = movementById.get(Number.parseInt(movementMatch[1], 10));
      if (movement) detailView(movement);
      else notFoundView();
    } else {
      notFoundView();
    }
  }
  window.scrollTo({ top: 0, behavior: 'instant' });
}

window.addEventListener('hashchange', route);
window.addEventListener('beforeunload', () => activeCleanup());
route();
