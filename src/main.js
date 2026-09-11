import catalog from './data/movements.json';
import { MovementEngine } from './simulation/engine.js';
import './styles.css';

const PAGE_SIZE = 12;
const app = document.querySelector('#app');
const movements = catalog.movements;
const movementById = new Map(movements.map((movement) => [movement.id, movement]));
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let activeCleanup = () => {};

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

function movementStatus() {
  return {
    className: 'is-authored',
    copy: 'An interactive reconstruction of the mechanism in the original engraving.',
    label: '3D reconstruction',
    title: 'Interactive 3D model',
  };
}

function appShell(content, active = 'catalog') {
  return `
    <header class="site-header">
      <div class="header-inner">
        <a class="brand" href="#/catalog?page=1" aria-label="507 Movements home">
          <span class="brand-mark">507</span>
          <span class="brand-copy">Mechanical<br />movements in 3D</span>
        </a>
        <nav class="site-nav" aria-label="Primary navigation">
          <a href="#/catalog?page=1" ${active === 'catalog' ? 'aria-current="page"' : ''}>Catalog</a>
          <a href="#/about" ${active === 'about' ? 'aria-current="page"' : ''}>About</a>
        </nav>
      </div>
    </header>
    <main id="main">${content}</main>
    <footer class="site-footer">
      <div class="footer-inner">
        <p>An original 3D study of Henry T. Brown’s public-domain 1868 collection.</p>
        <p><a href="#/about">Method &amp; credits</a> · No tracking · Runs entirely in your browser</p>
      </div>
    </footer>
  `;
}

function movementIcon(movement) {
  const kind = movement.archetype;
  const number = movement.id;
  const offset = number % 7;
  let drawing;

  if (/gear|epicyclic|ratchet|escapement/.test(kind)) {
    drawing = `
      <g class="icon-rotor icon-rotor-a">
        <circle cx="38" cy="44" r="20" /><circle cx="38" cy="44" r="6" />
        <path d="M38 20v8M38 60v8M14 44h8M54 44h8M21 27l6 6M49 55l6 6M21 61l6-6M49 33l6-6" />
      </g>
      <g class="icon-rotor icon-rotor-b">
        <circle cx="75" cy="61" r="14" /><circle cx="75" cy="61" r="4" />
        <path d="M75 43v6M75 73v6M57 61h6M87 61h6" />
      </g>`;
  } else if (/belt/.test(kind)) {
    drawing = `
      <circle cx="33" cy="34" r="15" /><circle cx="75" cy="68" r="19" />
      <circle cx="33" cy="34" r="4" /><circle cx="75" cy="68" r="5" />
      <path class="icon-belt" d="M22 24C37 9 82 40 90 53M20 45C35 61 48 81 64 84" />`;
  } else if (/screw|worm/.test(kind)) {
    drawing = `
      <path class="icon-thread" d="M13 56c9-24 18 24 27 0s18 24 27 0 18 24 27 0" />
      <path d="M13 42h81M13 70h81" /><circle cx="20" cy="84" r="5" /><circle cx="87" cy="28" r="5" />`;
  } else if (/crank|steam|pump/.test(kind)) {
    drawing = `
      <circle cx="31" cy="60" r="22" /><circle cx="31" cy="60" r="5" />
      <path d="M31 60l14-13 31 5" /><rect x="75" y="40" width="18" height="24" rx="2" />
      <path d="M93 36h8v32h-8" />`;
  } else if (/water|rotary/.test(kind)) {
    drawing = `
      <circle cx="54" cy="54" r="30" /><circle cx="54" cy="54" r="6" />
      <path d="M54 24v24M54 60v24M24 54h24M60 54h24M33 33l17 17M58 58l17 17M33 75l17-17M58 50l17-17" />`;
  } else if (/cam/.test(kind)) {
    drawing = `
      <path d="M19 67c0-24 10-44 34-44 28 0 39 20 33 39-5 16-21 23-40 22-17-1-27-6-27-17Z" />
      <circle cx="50" cy="56" r="5" /><path d="M83 18v28" /><circle cx="83" cy="51" r="6" />`;
  } else if (/linkage|press|joint|generic/.test(kind)) {
    drawing = `
      <path class="icon-link" d="M16 78 34 33l28 35 30-43" />
      <circle cx="16" cy="78" r="5" /><circle cx="34" cy="33" r="5" /><circle cx="62" cy="68" r="5" /><circle cx="92" cy="25" r="5" />`;
  } else if (/spring|governor/.test(kind)) {
    drawing = `
      <path class="icon-thread" d="M53 15c-29 5 29 11 0 16s29 11 0 16 29 11 0 16 29 11 0 16" />
      <circle cx="53" cy="88" r="10" />`;
  } else {
    drawing = `<path class="icon-link" d="M15 72 36 ${30 + offset}l30 35 28-47" /><circle cx="36" cy="${30 + offset}" r="11" /><circle cx="66" cy="65" r="15" />`;
  }

  return `
    <svg class="movement-icon" viewBox="0 0 108 108" aria-hidden="true" focusable="false">
      ${drawing}
    </svg>`;
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
    const status = movementStatus(movement);
    return `
    <article class="movement-card">
      <a class="card-visual" href="#/movement/${movement.number}" aria-label="Open movement ${movement.id}: ${escapeHtml(movement.title)}">
        <span class="card-number">${movement.number}</span>
        <img src="${sourceImagePath(movement)}" alt="" loading="lazy" decoding="async" />
        <span class="card-open" aria-hidden="true">↗</span>
      </a>
      <div class="card-body">
        <p class="card-category">${escapeHtml(movement.category)}</p>
        <h2><a href="#/movement/${movement.number}">${escapeHtml(movement.title)}</a></h2>
        <p>${escapeHtml(compact(cleanDescription(movement), 145))}</p>
        <span class="fidelity-dot ${status.className}"></span>
        <span class="fidelity-label">${status.label}</span>
      </div>
    </article>`;
  }).join('');

  const content = `
    <section class="catalog-hero" aria-labelledby="catalog-hero-title">
      <div class="hero-inner">
        <div class="hero-copy">
          <p class="eyebrow">A living mechanical index</p>
          <h1 id="catalog-hero-title">507 movements, <em>made spatial.</em></h1>
          <p>Turn, zoom, pause, and inspect Brown’s classic mechanisms as lightweight interactive 3D studies.</p>
        </div>
        <div class="hero-stat">
          <span>${movements.length}</span>
          <p>numbered movements<br />in one portable catalog</p>
        </div>
      </div>
    </section>
    <section class="catalog-section" aria-labelledby="catalog-title">
      <div class="section-inner">
        <div class="catalog-heading">
          <div>
            <p class="eyebrow">Browse the collection</p>
            <h2 id="catalog-title">The movement catalog</h2>
          </div>
          <p class="result-count" aria-live="polite">Showing ${start}–${end} of ${filtered.length}</p>
        </div>
        <form class="catalog-filters" id="catalog-filters" role="search">
          <label class="search-field">
            <span class="visually-hidden">Search movements</span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 5 5" /></svg>
            <input type="search" name="q" value="${escapeHtml(query)}" placeholder="Search by number, name, or motion…" autocomplete="off" />
          </label>
          <label class="category-field">
            <span class="visually-hidden">Filter by family</span>
            <select name="category">
              <option value="">All mechanism families (${movements.length})</option>
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

function detailView(movement) {
  const previous = movementById.get(movement.id - 1);
  const next = movementById.get(movement.id + 1);
  const status = movementStatus(movement);
  const content = `
    <section class="detail-page">
      <div class="detail-inner">
        <nav class="breadcrumbs" aria-label="Breadcrumb">
          <a href="#/catalog?page=${Math.ceil(movement.id / PAGE_SIZE)}">Catalog</a><span>—</span><span>Movement ${movement.number}</span>
        </nav>
        <div class="detail-heading">
          <div>
            <p class="eyebrow">Movement ${movement.number} · ${escapeHtml(movement.category)}</p>
            <h1>${escapeHtml(movement.title)}</h1>
          </div>
          <div class="detail-sequence" aria-label="Movement navigation">
            ${previous ? `<a href="#/movement/${previous.number}" aria-label="Previous movement, ${escapeHtml(previous.title)}">← <span>${previous.number}</span></a>` : '<span class="is-disabled">←</span>'}
            <span class="sequence-rule"></span>
            ${next ? `<a href="#/movement/${next.number}" aria-label="Next movement, ${escapeHtml(next.title)}"><span>${next.number}</span> →</a>` : '<span class="is-disabled">→</span>'}
          </div>
        </div>
        <div class="detail-layout">
          <div class="simulation-panel">
            <div class="simulation-stage" id="simulation-stage">
              <div class="simulation-loading" aria-live="polite">
                <span></span><p>Assembling movement ${movement.number}…</p>
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
              <p class="interaction-hint"><span>Drag</span> to orbit · <span>Scroll</span> to zoom</p>
            </div>
          </div>
          <a class="source-engraving" href="${escapeHtml(movement.sourceUrl)}" target="_blank" rel="noreferrer">
            <img src="${sourceImagePath(movement)}" alt="Original engraving for Movement ${movement.number}" />
            <span>Original engraving <i aria-hidden="true">↗</i></span>
          </a>
          <aside class="movement-notes">
            <div class="notes-number" aria-hidden="true">${movement.number}</div>
            <p class="movement-description">${escapeHtml(cleanDescription(movement))}</p>
            ${movement.mechanicalNote ? `
              <div class="fidelity-note mechanical-correction">
                <span class="fidelity-dot"></span>
                <div><strong>Constraint correction</strong><p>${escapeHtml(movement.mechanicalNote)}</p></div>
              </div>` : ''}
            <div class="fidelity-note ${status.className}">
              <span class="fidelity-dot ${status.className}"></span>
              <div><strong>${status.title}</strong><p>${status.copy}</p></div>
            </div>
            <dl class="movement-meta">
              <div><dt>Motion family</dt><dd>${escapeHtml(movement.category)}</dd></div>
              <div><dt>Model type</dt><dd>${escapeHtml(movement.archetype.replaceAll('-', ' '))}</dd></div>
              <div><dt>Source text</dt><dd>H. T. Brown, 1908 ed.</dd></div>
            </dl>
            <a class="source-link" href="${escapeHtml(movement.sourceUrl)}" target="_blank" rel="noreferrer">Open the source page <span aria-hidden="true">↗</span></a>
            <div class="material-legend" aria-label="Simulation color legend">
              <span><i class="driver-swatch"></i>Driver</span>
              <span><i class="driven-swatch"></i>Driven</span>
              <span><i class="frame-swatch"></i>Frame</span>
            </div>
          </aside>
        </div>
      </div>
    </section>`;

  document.title = `${movement.number} · ${movement.title} — 507 Movements`;
  app.innerHTML = appShell(content, 'catalog');
  const stage = document.querySelector('#simulation-stage');
  let engine;
  try {
    engine = new MovementEngine(stage, movement, { playing: !prefersReducedMotion.matches });
  } catch (error) {
    console.error(error);
    stage.innerHTML = `
      <div class="simulation-error" role="alert">
        <strong>The 3D view could not start.</strong>
        <p>Your browser may have WebGL disabled. Try enabling hardware acceleration or opening this page in a current browser.</p>
      </div>`;
  }

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
  const onCanvasKeyDown = (event) => {
    if (event.code === 'Space') {
      event.preventDefault();
      updatePlayButton(engine?.togglePlaying() ?? false);
    }
    if (event.key.toLowerCase() === 'r') engine?.resetView();
  };
  engine?.renderer.domElement.addEventListener('keydown', onCanvasKeyDown);
  activeCleanup = () => {
    engine?.renderer.domElement.removeEventListener('keydown', onCanvasKeyDown);
    engine?.dispose();
  };
}

function aboutView() {
  const authoredCount = movements.filter((movement) => movement.fidelity === 'authored').length;
  const familyCount = new Set(movements.map((movement) => movement.archetype)).size;
  const content = `
    <section class="about-hero">
      <div class="about-inner">
        <p class="eyebrow">About this edition</p>
        <h1>A nineteenth-century<br />mechanical atlas,<br /><em>with one more dimension.</em></h1>
        <p class="about-lede">This project is building an inspectable 3D simulation for every numbered movement in Henry T. Brown’s enduring collection.</p>
      </div>
    </section>
    <section class="about-content">
      <div class="about-inner about-grid">
        <div class="about-main">
          <h2>Built as mechanisms, not videos</h2>
          <p>Every view is rendered live with Three.js. You can orbit around the shafts, look through linkages, slow the motion down, and inspect spatial arrangements that a flat engraving cannot fully reveal.</p>
          <p>All ${authoredCount} movements have individually authored geometry and motion. The original engravings appear alongside the models so you can compare their construction and follow the source descriptions.</p>
          <h2>Source and rights</h2>
          <p>Descriptions derive from Henry T. Brown’s 1908 edition, which is in the public domain. The excellent existing animations at 507movements.com are proprietary and are not copied, converted, or shipped here; they are used only as visual research where available.</p>
          <h2>Portable by design</h2>
          <p>The production output is a self-contained static directory: no server runtime, database, account, analytics, or network request is required. Hash routes keep every catalog and movement view working from a domain root or a nested folder.</p>
        </div>
        <aside class="about-aside">
          <div><strong>${movements.length}</strong><span>catalog entries</span></div>
          <div><strong>${familyCount}</strong><span>working 3D families</span></div>
          <div><strong>${authoredCount}</strong><span>individually authored so far</span></div>
          <a href="#/catalog?page=1">Explore the catalog <span>→</span></a>
        </aside>
      </div>
    </section>`;
  document.title = 'About — 507 Movements in 3D';
  app.innerHTML = appShell(content, 'about');
}

function notFoundView() {
  const content = `
    <section class="not-found">
      <span>404</span><h1>That movement slipped the gear.</h1>
      <p>The catalog runs from 001 through 507.</p>
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
