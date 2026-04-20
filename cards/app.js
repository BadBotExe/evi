/* ════════════════════════════════════════════
   Evitania Card Viewer — app.js
   ════════════════════════════════════════════ */

let DATA = null, cardIndex = {};
let selectedId = null, currentMode = null, currentStars = 0, maxStars = 0;
let isInitialLoad = true;
let activeFilters = new Set();

/* ── MOBILE STATE ── */
function isMobile() {
  if (matchMedia('(pointer: coarse)').matches) return true;
  if (matchMedia('(hover: none)').matches) return true;
  if (/Mobile|Android|iPhone|iPad/i.test(navigator.userAgent)) return true;
  return window.innerWidth < 980;
}
let currentTab = 'card'; // 'card' | 'drops' | 'browse'
let mobileAdopted = false;

function adoptCardForMobile() {
  const card = document.getElementById('game-card');
  const slot = document.getElementById('m-card-slot');
  if (!card || !slot) return;
  if (isMobile() && card.parentElement?.id !== 'm-card-slot') {
    slot.appendChild(card);
    mobileAdopted = true;
  } else if (!isMobile() && mobileAdopted) {
    const panel = document.querySelector('.card-panel');
    if (panel) {
      const starSel = document.getElementById('star-sel');
      panel.insertBefore(card, starSel);
      mobileAdopted = false;
    }
  }
}

/* ════════════════════════════════════════════
   URL PARAMS
   ════════════════════════════════════════════ */
function getParams() {
  const p = new URLSearchParams(window.location.search);
  const filterParam = p.get('filter');
  return {
    card:   p.get('card'),
    mode:   p.get('mode'),
    stars:  parseInt(p.get('stars') ?? '0', 10) || 0,
    filter: filterParam ? filterParam.split(',').filter(Boolean) : [],
    tab:    p.get('tab') || 'card',
  };
}

function pushParams() {
  const p = new URLSearchParams();
  if (selectedId)          p.set('card',   selectedId);
  if (currentMode)         p.set('mode',   currentMode);
  if (currentStars)        p.set('stars',  currentStars);
  if (activeFilters.size)  p.set('filter', [...activeFilters].join(','));
  if (isMobile())          p.set('tab',    currentTab);
  history.replaceState(null, '', '?' + p.toString());
}

/* ════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════ */
function sc(n) {
  if (DATA.starColors?.[n]) return DATA.starColors[n];
  const m = {'0':'#c8a020','1':'#3aaa44','2':'#3a80dd','3':'#9c44dd'};
  return { border: m[n] || '#c8a020', glow: (m[n] || '#c8a020') + '44' };
}

function mc(id) {
  return DATA.modes?.find(m => m.id === id) || { id, label: id[0].toUpperCase() + id.slice(1), color: '#c8a020' };
}

function mkImg(src, alt) {
  const i = document.createElement('img');
  i.src = src; i.alt = alt || '';
  return i;
}

function resolve(field, md, card, cat) {
  return md[field]
      ?? card[field]
      ?? cat.modes?.[currentMode]?.[field]
      ?? cat[field]
      ?? null;
}

function resolveFooter(md, card, cat) {
  return md.footer
      ?? card.footer
      ?? cat.modes?.[currentMode]?.footer
      ?? cat.footer
      ?? [];
}

function resolveItem(ref) {
  const base = ref.item ? (DATA.items[ref.item] ?? {}) : {};
  return { ...base, ...ref };
}

function buildReportUrl() {
  const title = selectedId ? `[${selectedId}] Issue` : 'Issue';
  const body = `**Card:** ${selectedId ?? 'N/A'}\n**Mode:** ${currentMode}\n**Stars:** ${currentStars}\n\n**Description:**\n`;
  return `https://github.com/badbotexe/evi/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}

/* ════════════════════════════════════════════
   FILTER HELPERS
   ════════════════════════════════════════════ */
function cardPassesFilter(card) {
  if (!activeFilters.size) return true;
  return activeFilters.has(card.bonus_type);
}

function countForBonus(bonusId) {
  let n = 0;
  for (const cat of DATA.categories)
    for (const c of cat.cards)
      if (!c.placeholder && c.bonus_type === bonusId) n++;
  return n;
}

function firstPassingFilter() {
  for (const cat of DATA.categories)
    for (const c of cat.cards)
      if (!c.placeholder && cardPassesFilter(c)) return c;
  return null;
}

function firstForMode(m) {
  for (const cat of DATA.categories)
    for (const c of cat.cards)
      if (c.modes?.[m] && cardPassesFilter(c)) return c;
  return null;
}

/* ════════════════════════════════════════════
   FILTER UI — DESKTOP
   ════════════════════════════════════════════ */
function buildFilterOptions(container) {
  container.innerHTML = '';
  DATA.bonus_types.sort((a, b) => a.id.localeCompare(b.id));
  for (const bt of DATA.bonus_types) {
    const count = countForBonus(bt.id);
    if (count === 0) continue;

    const opt = document.createElement('label');
    opt.className = 'filter-option';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = bt.id;
    cb.checked = activeFilters.has(bt.id);
    cb.addEventListener('change', () => {
      if (cb.checked) activeFilters.add(bt.id);
      else            activeFilters.delete(bt.id);
      onFilterChange();
    });

    const lbl = document.createElement('span');
    lbl.className = 'filter-option-label';
    lbl.textContent = bt.label;

    const cnt = document.createElement('span');
    cnt.className = 'filter-option-count';
    cnt.textContent = count;

    opt.append(cb, lbl, cnt);
    container.appendChild(opt);
  }
}

function buildDesktopFilterUI() {
  buildFilterOptions(document.getElementById('filter-options'));
}

function syncFilterCheckboxes(container) {
  container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.checked = activeFilters.has(cb.value);
  });
}

function updateFilterBadge() {
  // Desktop badge
  const badge = document.getElementById('filter-count-badge');
  const trigger = document.getElementById('filter-trigger');
  if (badge && trigger) {
    if (activeFilters.size > 0) {
      badge.textContent = activeFilters.size;
      badge.classList.add('visible');
      trigger.classList.add('active');
    } else {
      badge.classList.remove('visible');
      trigger.classList.remove('active');
    }
  }

  // Mobile badge dot
  const dot = document.getElementById('m-filter-badge');
  const mBtn = document.getElementById('m-filter-btn');
  if (dot && mBtn) {
    dot.textContent = activeFilters.size || '';
    dot.classList.toggle('visible', activeFilters.size > 0);
    mBtn.classList.toggle('active', activeFilters.size > 0);
  }
}

function onFilterChange() {
  syncFilterCheckboxes(document.getElementById('filter-options'));
  if (document.getElementById('m-filter-options')) {
    syncFilterCheckboxes(document.getElementById('m-filter-options'));
  }
  updateFilterBadge();
  renderBrowser();
  renderMobileBrowse();
  pushParams();
}

function initDesktopFilterDropdown() {
  const wrap     = document.getElementById('filter-wrap');
  const trigger  = document.getElementById('filter-trigger');
  const dropdown = document.getElementById('filter-dropdown');
  if (!wrap || !trigger || !dropdown) return;

  function openDropdown() {
    const rect = trigger.getBoundingClientRect();
    dropdown.style.top   = rect.bottom + 6 + 'px';
    dropdown.style.left  = rect.left + 'px';
    dropdown.style.width = rect.width + 'px';
    dropdown.style.display = 'block';
    wrap.classList.add('open');
  }

  function closeDropdown() {
    dropdown.style.display = 'none';
    wrap.classList.remove('open');
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.style.display === 'block' ? closeDropdown() : openDropdown();
  });

  dropdown.addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('click', closeDropdown);

  document.getElementById('filter-select-all').addEventListener('click', () => {
    DATA.bonus_types.forEach(bt => { if (countForBonus(bt.id) > 0) activeFilters.add(bt.id); });
    onFilterChange();
  });

  document.getElementById('filter-clear').addEventListener('click', () => {
    activeFilters.clear();
    onFilterChange();
  });
}

/* ════════════════════════════════════════════
   MOBILE FILTER DROPDOWN
   ════════════════════════════════════════════ */
function initMobileFilter() {
  const btn      = document.getElementById('m-filter-btn');
  const dropdown = document.getElementById('m-filter-dropdown');
  if (!btn || !dropdown) return;

  const optionsEl = document.getElementById('m-filter-options');
  buildFilterOptions(optionsEl);

  function openFilter() {
    const rect = btn.getBoundingClientRect();
    dropdown.style.top = rect.bottom + 6 + 'px';
    dropdown.classList.add('open');
  }

  function closeFilter() {
    dropdown.classList.remove('open');
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.contains('open') ? closeFilter() : openFilter();
  });

  dropdown.addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('click', closeFilter);

  document.getElementById('m-filter-select-all').addEventListener('click', () => {
    DATA.bonus_types.forEach(bt => { if (countForBonus(bt.id) > 0) activeFilters.add(bt.id); });
    onFilterChange();
  });

  document.getElementById('m-filter-clear').addEventListener('click', () => {
    activeFilters.clear();
    onFilterChange();
  });
}

/* ════════════════════════════════════════════
   SETTINGS BOTTOM SHEET (mobile)
   ════════════════════════════════════════════ */
function initSettingsSheet() {
  const btn      = document.getElementById('m-settings-btn');
  const backdrop = document.getElementById('settings-sheet-backdrop');
  const sheet    = document.getElementById('settings-sheet');
  const reportLink = document.getElementById('m-report-btn');
  if (!btn || !backdrop || !sheet) return;

  function openSheet() {
    backdrop.classList.add('open');
    sheet.classList.add('open');
  }

  function closeSheet() {
    backdrop.classList.remove('open');
    sheet.classList.remove('open');
  }

  btn.addEventListener('click', openSheet);
  backdrop.addEventListener('click', closeSheet);

  if (reportLink) {
    reportLink.addEventListener('click', (ev) => {
      ev.currentTarget.href = buildReportUrl();
    });
  }
}

/* ════════════════════════════════════════════
   MODE BAR
   ════════════════════════════════════════════ */
function updateModeBtns() {
  document.querySelectorAll('.gmode-btn').forEach(b => {
    const m = mc(b.dataset.id);
    const hasMode = !selectedId || cardIndex[selectedId]?.card.modes[b.dataset.id];
    b.disabled = !hasMode;
    b.style.opacity = hasMode ? '1' : '0.35';
    b.style.cursor = hasMode ? 'pointer' : 'not-allowed';
    b.classList.toggle('active', b.dataset.id === currentMode);
    b.style.background = b.dataset.id === currentMode ? m.color : '';
  });
}

function buildModeBar() {
  // Build buttons in all .mode-group elements (desktop + mobile share same class)
  document.querySelectorAll('.mode-group').forEach(g => {
    g.innerHTML = '';
    for (const m of (DATA.modes || [])) {
      const b = document.createElement('button');
      b.className = 'gmode-btn';
      b.textContent = m.label;
      b.dataset.id = m.id;
      b.addEventListener('click', () => setGlobalMode(m.id));
      g.appendChild(b);
    }
  });
  setGlobalMode(DATA.modes?.[0]?.id || 'normal');
}

function setGlobalMode(id) {
  currentMode = id;
  document.querySelectorAll('.gmode-btn').forEach(b => {
    const m = mc(b.dataset.id);
    b.classList.toggle('active', b.dataset.id === id);
    b.style.background = b.dataset.id === id ? m.color : '';
  });
  renderBrowser();
  renderMobileBrowse();
  if (selectedId) {
    const { card } = cardIndex[selectedId];
    if (!card.modes[currentMode]) {
      const f = firstForMode(currentMode);
      f ? selectCard(f.id) : clearCard();
      return;
    }
  }
  renderStars();
  renderCard();
  renderDrops();
  renderMobileDrops();
  pushParams();
  updateModeBtns();
}

/* ════════════════════════════════════════════
   DESKTOP BROWSER
   ════════════════════════════════════════════ */
function renderBrowser() {
  const el = document.getElementById('browser');
  if (!el) return;
  el.innerHTML = '';
  const filterActive = activeFilters.size > 0;

  for (const cat of DATA.categories) {
    const realMatching = cat.cards.filter(c => !c.placeholder && cardPassesFilter(c));
    if (filterActive && realMatching.length === 0) continue;

    const blk = document.createElement('div');
    blk.className = 'cat-block';
    const lbl = document.createElement('div');
    lbl.className = 'cat-lbl';
    lbl.textContent = cat.label;
    blk.appendChild(lbl);
    const grid = document.createElement('div');
    grid.className = 'thumb-grid';

    for (const card of cat.cards) {
      if (card.placeholder) {
        if (!filterActive) {
          const tc = document.createElement('div');
          tc.className = 'thumb-card thumb-placeholder';
          grid.appendChild(tc);
        }
        continue;
      }

      const passes = cardPassesFilter(card);
      if (filterActive && !passes) continue;

      const stars = 0;
      const s = sc(stars);
      const tc = document.createElement('div');
      tc.className = 'thumb-card' + (card.id === selectedId ? ' selected' : '');
      if (filterActive && !passes) tc.style.opacity = '0.35';
      tc.id = 'thumb-' + card.id;
      tc.style.borderColor = s.border;

      const src = card.image_thumb || card.image_card;
      const name = card.short_name || card.name;
      if (src) {
        const img = document.createElement('img');
        img.className = 'thumb-img';
        img.src = src;
        img.alt = name;
        const shiftX = card.thumb_x ?? 50;
        img.style.objectPosition = `${shiftX}% 50%`;
        img.onerror = function() {
          this.remove();
          const ph = document.createElement('div');
          ph.className = 'thumb-ph';
          ph.textContent = name;
          tc.prepend(ph);
        };
        tc.appendChild(img);
      } else {
        const ph = document.createElement('div');
        ph.className = 'thumb-ph';
        ph.textContent = name;
        tc.appendChild(ph);
      }

      if (stars > 0) {
        const sr = document.createElement('div');
        sr.className = 'thumb-stars-row';
        for (let i = 1; i <= stars; i++) {
          const s2 = document.createElement('span');
          s2.className = 'sl';
          s2.textContent = '★';
          sr.appendChild(s2);
        }
        tc.appendChild(sr);
      }

      const nl = document.createElement('div');
      nl.className = 'thumb-name-lbl';
      nl.textContent = name;
      tc.appendChild(nl);

      const allM = Object.keys(card.modes || {});
      if (allM.length === 1 && allM[0] !== 'normal') {
        const b = document.createElement('div');
        b.className = 'mode-badge';
        b.style.color = mc(allM[0]).color;
        b.textContent = allM[0].toUpperCase();
        tc.appendChild(b);
      }

      tc.addEventListener('click', () => selectCard(card.id));
      grid.appendChild(tc);
    }
    blk.appendChild(grid);
    el.appendChild(blk);
  }
}

/* ════════════════════════════════════════════
   MOBILE BROWSE PANEL
   ════════════════════════════════════════════ */
function renderMobileBrowse() {
  const container = document.getElementById('m-browse-content');
  if (!container) return;
  container.innerHTML = '';
  const filterActive = activeFilters.size > 0;
  const query = (document.getElementById('m-search-input')?.value || '').toLowerCase().trim();

  for (const cat of DATA.categories) {
    const cards = cat.cards.filter(c => {
      if (c.placeholder) return false;
      if (filterActive && !cardPassesFilter(c)) return false;
      if (query && !(c.name || '').toLowerCase().includes(query) && !(c.short_name || '').toLowerCase().includes(query)) return false;
      return true;
    });
    if (cards.length === 0) continue;

    const blk = document.createElement('div');
    blk.className = 'm-cat-block';

    const lbl = document.createElement('div');
    lbl.className = 'm-cat-lbl';
    lbl.textContent = cat.label;
    blk.appendChild(lbl);

    const row = document.createElement('div');
    row.className = 'm-card-row';

    for (const card of cards) {
      const s = sc(0);
      const tc = document.createElement('div');
      tc.className = 'm-thumb' + (card.id === selectedId ? ' selected' : '');
      tc.id = 'm-thumb-' + card.id;
      tc.style.borderColor = s.border;

      const src = card.image_thumb || card.image_card;
      const name = card.short_name || card.name;

      if (src) {
        const img = document.createElement('img');
        img.src = src;
        img.alt = name;
        const shiftX = card.thumb_x ?? 50;
        img.style.objectPosition = `${shiftX}% 50%`;
        img.onerror = function() {
          this.remove();
          const ph = document.createElement('div');
          ph.className = 'm-thumb-ph';
          ph.textContent = name;
          tc.prepend(ph);
        };
        tc.appendChild(img);
      } else {
        const ph = document.createElement('div');
        ph.className = 'm-thumb-ph';
        ph.textContent = name;
        tc.appendChild(ph);
      }

      const nl = document.createElement('div');
      nl.className = 'm-thumb-lbl';
      nl.textContent = name;
      tc.appendChild(nl);

      tc.addEventListener('click', () => {
        selectCard(card.id);
        // Auto-navigate to card tab after selection
        switchTab('card');
      });

      row.appendChild(tc);
    }

    blk.appendChild(row);
    container.appendChild(blk);
  }
}

/* ════════════════════════════════════════════
   SELECT CARD
   ════════════════════════════════════════════ */
function selectCard(id) {
  // Deselect old
  if (selectedId) {
    document.getElementById('thumb-' + selectedId)?.classList.remove('selected');
    document.getElementById('m-thumb-' + selectedId)?.classList.remove('selected');
  }

  selectedId = id;
  const { card, cat } = cardIndex[selectedId];

  if (!card.modes[currentMode]) {
    const availableMode = Object.keys(card.modes)[0];
    setGlobalMode(availableMode);
    return;
  }

  // Select new in desktop browser
  const el = document.getElementById('thumb-' + id);
  if (el) {
    el.classList.add('selected');
    if (isInitialLoad) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      isInitialLoad = false;
    }
  }

  // Select new in mobile browser
  const mel = document.getElementById('m-thumb-' + id);
  if (mel) {
    mel.classList.add('selected');
  }

  const md = card.modes[currentMode];
  const newMax = resolve('stars', md, card, cat) ?? 0;
  currentStars = Math.min(currentStars, newMax);

  renderStars();
  renderCard();
  renderDrops();
  renderMobileDrops();
  updateMobileCardContext();
  pushParams();
  updateModeBtns();
}

function clearCard() {
  selectedId = null;
  const nm = document.getElementById('card-name');
  if (nm) nm.textContent = 'No card';
  document.getElementById('drop-list')?.innerHTML && (document.getElementById('drop-list').innerHTML = '');
  document.getElementById('drop-footer')?.innerHTML && (document.getElementById('drop-footer').innerHTML = '');
  document.getElementById('star-sel')?.querySelectorAll('.star-btn').forEach(b => b.remove());
  renderMobileDrops();
  updateMobileCardContext();
}

function updateMobileCardContext() {
  const el = document.getElementById('m-card-context');
  if (!el) return;
  if (selectedId && cardIndex[selectedId]) {
    el.textContent = cardIndex[selectedId].card.name;
  } else {
    el.textContent = 'No card selected';
  }
}

/* ════════════════════════════════════════════
   STAR SELECTOR
   ════════════════════════════════════════════ */
function renderStars() {
  // Works for both desktop (#star-sel) and mobile (#m-star-sel) by iterating all
  ['star-sel', 'm-star-sel'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.querySelectorAll('.star-btn').forEach(b => b.remove());
    if (!selectedId) return;

    const { card, cat } = cardIndex[selectedId];
    const md = card.modes[currentMode];
    maxStars = resolve('stars', md, card, cat) ?? 0;

    for (let i = 0; i <= maxStars; i++) {
      const btn = document.createElement('button');
      btn.className = 'star-btn' + (i === currentStars ? ' active' : '');
      btn.textContent = i === 0 ? '0★' : '★'.repeat(i);
      const s = sc(i);
      if (i === currentStars) {
        btn.style.background = s.border;
        btn.style.borderColor = s.border;
        btn.style.color = '#1a1530';
      }
      btn.addEventListener('click', () => {
        currentStars = i;
        renderStars();
        renderCard();
        pushParams();
      });
      sel.appendChild(btn);
    }
  });
}

/* ════════════════════════════════════════════
   CARD RENDER
   ════════════════════════════════════════════ */
function renderCard() {
  if (!selectedId) return;
  const { card, cat } = cardIndex[selectedId];
  const md = card.modes[currentMode];
  if (!md) return;
  const s = sc(currentStars);

  // Works for both #game-card (desktop) and #m-game-card (mobile) if present
  // We use a single shared #game-card that lives in both layouts via CSS show/hide
  const gc = document.getElementById('game-card');
  if (!gc) return;
  gc.style.borderColor = s.border;
  gc.style.boxShadow = `0 0 30px 5px ${s.glow}`;

  const div = document.getElementById('divider');
  if (div) div.style.color = s.border;

  /* art */
  const art = document.getElementById('card-art');
  if (art) {
    art.innerHTML = '';
    if (card.image_card) {
      const img = document.createElement('img');
      img.src = card.image_card; img.alt = card.name;
      img.style.cssText = 'width:100%;height:100%;object-fit:contain;image-rendering:pixelated;';
      img.onerror = () => {
        art.innerHTML = '<div class="art-ph"><svg viewBox="0 0 24 24" style="width:56px;height:56px;fill:#3e3668"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg></div>';
      };
      art.appendChild(img);
    } else {
      art.innerHTML = '<div class="art-ph"><svg viewBox="0 0 24 24" style="width:56px;height:56px;fill:#3e3668"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg></div>';
    }
  }

  /* name + mode label */
  const nm = document.getElementById('card-name');
  if (nm) nm.textContent = card.name;

  const ml = document.getElementById('card-mode-lbl');
  if (ml) {
    if (currentMode !== 'normal') {
      const m = mc(currentMode);
      ml.textContent = '(' + m.label + ')';
      ml.style.color = m.color;
      ml.style.display = '';
    } else {
      ml.innerHTML = '&nbsp;';
    }
  }

  /* stats */
  const statsEl = document.getElementById('stats');
  if (statsEl) {
    statsEl.innerHTML = '';
    const stats = resolve('stats', md, card, cat) ?? {};
    const present = DATA.statDefs.filter(d => d.key in stats);
    present.forEach((def, i) => {
      const box = document.createElement('div');
      const isWide = def.wide || (present.length % 2 === 1 && i === present.length - 1);
      box.className = 'stat-box' + (isWide ? ' wide' : '');
      const sw = document.createElement('div');
      sw.className = 'stat-swatch';
      sw.style.background = def.bg;
      if (def.icon) {
        const img = mkImg(def.icon, def.label);
        img.style.cssText = 'width:100%;height:100%;object-fit:contain;image-rendering:pixelated;';
        sw.appendChild(img);
      }
      box.appendChild(sw);
      const t = document.createElement('div');
      t.innerHTML = `<span class="stat-val">${stats[def.key]}</span><span class="stat-lbl">${def.label}</span>`;
      const spacer = document.createElement('div');
      box.appendChild(t);
      box.appendChild(spacer);
      statsEl.appendChild(box);
    });
  }

  /* bonus */
  const bonuses = md.bonuses ?? card.bonuses ?? {};
  const bs = document.getElementById('bonus-stars');
  if (bs) {
    bs.innerHTML = '';
    for (let i = 1; i <= maxStars; i++) {
      const sp = document.createElement('span');
      sp.className = 'bstar' + (i <= currentStars ? '' : ' dim');
      sp.textContent = '★';
      bs.appendChild(sp);
    }
  }
  const bt = document.getElementById('bonus-txt');
  if (bt) {
    const bv = bonuses[String(currentStars)];
    bt.textContent = bv || 'No bonus';
    bt.className = 'bonus-txt' + (bv ? '' : ' none');
    bt.style.color = bv ? s.border : '';
  }

  /* bottom */
  const tiers = resolve('tiers', md, card, cat);
  const collEl = document.getElementById('collected');
  const nextEl = document.getElementById('next-tier');
  if (collEl && nextEl) {
    if (tiers && tiers.length > currentStars) {
      collEl.textContent = tiers[currentStars] ?? '—';
      const next = tiers[currentStars + 1];
      nextEl.textContent = next != null ? (next - tiers[currentStars]) : 'MAX';
    } else {
      collEl.textContent = '—';
      nextEl.textContent = '—';
    }
  }

  /* page title */
  document.title = `Evitania - ${card.name}`;
}

/* ════════════════════════════════════════════
   DROPS RENDER (desktop)
   ════════════════════════════════════════════ */
function renderDrops() {
  if (!selectedId) return;
  const { card, cat } = cardIndex[selectedId];
  const md = card.modes[currentMode];
  const list = document.getElementById('drop-list');
  if (!list) return;
  list.innerHTML = '';

  for (const ref of md.drops ?? []) {
    const drop = resolveItem(ref);
    const row = document.createElement('div');
    row.className = 'drop-row';
    const iw = document.createElement('div');
    iw.className = 'drop-icon';
    if (drop.image) {
      const img = mkImg(drop.image, drop.name);
      img.onerror = () => { iw.innerHTML = '<div class="icon-ph"></div>'; };
      iw.appendChild(img);
    } else {
      iw.innerHTML = '<div class="icon-ph"></div>';
    }
    const nm = document.createElement('div');
    nm.className = 'drop-name';
    nm.textContent = drop.name;
    const rt = document.createElement('div');
    rt.className = 'drop-rate';
    rt.textContent = drop.rate;
    row.append(iw, nm, rt);
    list.appendChild(row);
  }

  const footer = document.getElementById('drop-footer');
  if (footer) {
    footer.innerHTML = '';
    const footerItemsRef = resolveFooter(md, card, cat);
    const items = footerItemsRef.length ? footerItemsRef : [
      { image: null, color: '#c8a020', value: md?.gold },
      { image: null, color: '#8040cc', value: md?.exp },
    ].filter(x => x.value != null);

    for (const ref of items) {
      const item = resolveItem(ref);
      const pill = document.createElement('div');
      pill.className = 'footer-pill';
      const fw = document.createElement('div');
      fw.className = 'footer-icon';
      if (item.image) {
        const img = mkImg(item.image, item.label || '');
        img.onerror = () => { fw.innerHTML = `<div class="footer-icon-ph" style="background:${item.color || '#888'}"></div>`; };
        fw.appendChild(img);
      } else {
        fw.innerHTML = `<div class="footer-icon-ph" style="background:${item.color || '#888'}"></div>`;
      }
      const v = document.createElement('span');
      v.className = 'footer-val';
      v.textContent = item.value;
      pill.append(fw, v);
      footer.appendChild(pill);
    }
  }
}

/* ════════════════════════════════════════════
   DROPS RENDER (mobile)
   ════════════════════════════════════════════ */
function renderMobileDrops() {
  const titleEl = document.getElementById('m-drop-title');
  const listEl  = document.getElementById('m-drop-list');
  const footerEl = document.getElementById('m-drop-footer');
  if (!titleEl || !listEl || !footerEl) return;

  if (!selectedId) {
    titleEl.textContent = 'Drop Table';
    listEl.innerHTML = '';
    footerEl.innerHTML = '';
    return;
  }

  const { card, cat } = cardIndex[selectedId];
  const md = card.modes[currentMode];

  titleEl.textContent = card.name + ' — Drops';
  listEl.innerHTML = '';
  footerEl.innerHTML = '';

  for (const ref of md.drops ?? []) {
    const drop = resolveItem(ref);
    const row = document.createElement('div');
    row.className = 'drop-row';
    const iw = document.createElement('div');
    iw.className = 'drop-icon';
    if (drop.image) {
      const img = mkImg(drop.image, drop.name);
      img.onerror = () => { iw.innerHTML = '<div class="icon-ph"></div>'; };
      iw.appendChild(img);
    } else {
      iw.innerHTML = '<div class="icon-ph"></div>';
    }
    const nm = document.createElement('div');
    nm.className = 'drop-name';
    nm.textContent = drop.name;
    const rt = document.createElement('div');
    rt.className = 'drop-rate';
    rt.textContent = drop.rate;
    row.append(iw, nm, rt);
    listEl.appendChild(row);
  }

  const footerItemsRef = resolveFooter(md, card, cat);
  const items = footerItemsRef.length ? footerItemsRef : [
    { image: null, color: '#c8a020', value: md?.gold },
    { image: null, color: '#8040cc', value: md?.exp },
  ].filter(x => x.value != null);

  for (const ref of items) {
    const item = resolveItem(ref);
    const pill = document.createElement('div');
    pill.className = 'footer-pill';
    const fw = document.createElement('div');
    fw.className = 'footer-icon';
    if (item.image) {
      const img = mkImg(item.image, item.label || '');
      img.onerror = () => { fw.innerHTML = `<div class="footer-icon-ph" style="background:${item.color || '#888'}"></div>`; };
      fw.appendChild(img);
    } else {
      fw.innerHTML = `<div class="footer-icon-ph" style="background:${item.color || '#888'}"></div>`;
    }
    const v = document.createElement('span');
    v.className = 'footer-val';
    v.textContent = item.value;
    pill.append(fw, v);
    footerEl.appendChild(pill);
  }
}

/* ════════════════════════════════════════════
   MOBILE TAB SWITCHING
   ════════════════════════════════════════════ */
function switchTab(tab) {
  currentTab = tab;

  document.querySelectorAll('.m-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });

  document.querySelectorAll('.m-panel').forEach(p => {
    p.classList.toggle('active', p.dataset.panel === tab);
  });

  pushParams();
}

function initMobileTabs() {
  document.querySelectorAll('.m-tab').forEach(t => {
    t.addEventListener('click', () => switchTab(t.dataset.tab));
  });
}

/* ════════════════════════════════════════════
   INIT
   ════════════════════════════════════════════ */
async function init() {
  try {
    const r = await fetch('cards.json?v=2');
    DATA = await r.json();
  } catch {
    document.body.innerHTML = '<p style="color:#f88;padding:2rem;font-size:16px">Could not load cards.json. Run: python -m http.server 8080</p>';
    return;
  }

  for (const cat of DATA.categories)
    for (const c of cat.cards)
      cardIndex[c.id] = { card: c, cat };

  const params = getParams();
  params.filter.forEach(id => activeFilters.add(id));

  const startMode = params.mode && DATA.modes.find(m => m.id === params.mode)
      ? params.mode
      : DATA.modes?.[0]?.id ?? 'normal';

  buildModeBar();
  buildDesktopFilterUI();
  initDesktopFilterDropdown();
  initMobileFilter();
  initSettingsSheet();
  initMobileTabs();
  updateFilterBadge();

  // Search input
  const searchInput = document.getElementById('m-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', renderMobileBrowse);
  }

  adoptCardForMobile();
  window.addEventListener('resize', () => {
    adoptCardForMobile();
  });

  renderBrowser();
  renderMobileBrowse();
  setGlobalMode(startMode);

  // Restore tab on mobile
  if (isMobile() && ['card', 'drops', 'browse'].includes(params.tab)) {
    switchTab(params.tab);
  } else {
    switchTab('card');
  }

  const startCard = params.card && cardIndex[params.card]
      ? params.card
      : DATA.categories[0]?.cards[0]?.id;

  if (startCard) {
    currentStars = params.stars;
    requestAnimationFrame(() => requestAnimationFrame(() => selectCard(startCard)));
  }

  // Desktop report btn
  const reportBtn = document.getElementById('report-btn');
  if (reportBtn) {
    reportBtn.addEventListener('click', (ev) => ev.target.href = buildReportUrl());
  }
}

init();