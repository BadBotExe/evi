let DATA = null;
let selectedBonus = null;
let selectedClass = null;
let activeConditions = new Set();
let conditionPanelOpen = false;
let characterLevel = 1;

const collapsedSections = new Set();

const TYPE_COLORS = {};
const DEFAULT_UNITS = { flat: '', percent: '%', multiplier: '' };

function slotMax(slotId) {
    const s = DATA.slot_types.find(s => s.id === slotId);
    return s ? s.max : 1;
}

function slotLabel(slotId) {
    const s = DATA.slot_types.find(s => s.id === slotId);
    return s ? s.label : slotId;
}

function typeLabel(type) {
    const t = DATA.types[type];
    return t ? t.label : type;
}

function typeTagStyle(type) {
    const t = DATA.types[type];
    return t ? t.tag_style : { background: '#222', color: '#aaa' };
}

function buildLevelInput() {
    const wrap = document.getElementById('level-input-wrap');
    const input = wrap.querySelector('input');
    input.max = DATA.max_level ?? 150;
    input.value = characterLevel;
    input.addEventListener('input', () => {
        const max = DATA.max_level ?? 150;
        let val = parseInt(input.value);
        if (isNaN(val) || val < 1) val = 1;
        if (val > max) val = max;
        characterLevel = val;
        updateUrl();
        renderContent();
    });
    input.addEventListener('focus', () => input.select());
}

/* ── BONUS TYPE HELPERS ── */
function getBonusType(bonusId) {
    return DATA.bonus_types.find(b => b.id === bonusId);
}

function getSelectedBonusIds() {
    const bt = getBonusType(selectedBonus);
    return [selectedBonus, ...(bt?.aliases || [])];
}

// Returns unit string for a given bonus + unit_type
function unitFor(bonusId, unitType) {
    const bt = getBonusType(bonusId);
    const ut = unitType || 'flat';
    if (!bt) return DEFAULT_UNITS[ut] || '';
    if (bt.units && bt.units[ut] !== undefined) return bt.units[ut];
    return DEFAULT_UNITS[ut] || '';
}

// Returns true if bonus has more than one unit type defined
function bonusIsMixed(bonusId) {
    const bt = getBonusType(bonusId);
    if (!bt || !bt.units) return false;
    return Object.keys(bt.units).length > 1;
}

function formatVal(value, unit, unitType) {
    const v = Math.round(value * 1000) / 1000; // fix 0.8999...
    if (unitType === 'multiplier') return '×' + v + ' ' + unit;
    if (unitType === 'percent')    return '+' + v + unit;
    return '+' + v + ' ' + unit;
}

/* ── TIERS ── */
// Generate tier rows from a formula definition
function generateTierRows(formula, bonusId) {
    const rows = [];
    if (formula.type === 'linear') {
        for (let i = 1; i <= formula.max_tier; i++) {
            const val = (formula.init ?? formula.coeff) + (i - 1) * (formula.coeff ?? 0);
            const row = { label: formula.tier_labels ? formula.tier_labels[i - 1] : (formula.label_prefix || 'Tier') + ' ' + i };
            row[bonusId] = val;
            rows.push(row);
        }
    }
    return rows;
}

function resolveFormula(src, bonusEntry) {
    if (src.tiers_formula === false || bonusEntry?.tiers_formula === false) return null;
    if (bonusEntry?.value !== undefined && !bonusEntry?.tiers_formula) return null;

    const global = DATA.tiers_formula;
    const file   = src._file_tiers_formula;
    const entity = typeof src.tiers_formula === 'object' ? src.tiers_formula : null;
    const bonus  = typeof bonusEntry?.tiers_formula === 'object' ? bonusEntry.tiers_formula : null;

    if (!global && !file && !entity && !bonus) return null;

    return Object.assign({}, global ?? {}, file ?? {}, entity ?? {}, bonus ?? {});
}

// Get tier rows for a source, either from tiers array or formula
function getTierRows(src, bonusEntry, bonusId) {
    if (src.tiers) return src.tiers; // explicit tiers array always wins

    const formula = resolveFormula(src, bonusEntry);
    if (!formula) return null;

    return generateTierRows(formula, bonusId, bonusEntry);
}

/* ── DROPDOWN ── */
function buildDropdown(filter) {
    const opts = document.getElementById('bonus-options');
    opts.innerHTML = '';
    const q = (filter || '').toLowerCase();
    for (const bt of [...DATA.bonus_types].sort((a, b) => a.label.localeCompare(b.label))) {
        if (q && !bt.label.toLowerCase().includes(q)) continue;
        const opt = document.createElement('div');
        opt.className = 'bonus-option' + (selectedBonus === bt.id ? ' selected' : '');
        opt.textContent = bt.label;
        opt.addEventListener('click', () => {
            selectBonus(bt.id);
            closeDropdown();
        });
        opts.appendChild(opt);
    }
}

function openDropdown() {
    document.getElementById('bonus-select-box').classList.add('open');
    document.getElementById('bonus-dropdown').classList.add('open');
    document.getElementById('bonus-search').value = '';
    buildDropdown('');
    setTimeout(() => document.getElementById('bonus-search').focus(), 50);
}

function closeDropdown() {
    document.getElementById('bonus-select-box').classList.remove('open');
    document.getElementById('bonus-dropdown').classList.remove('open');
}

/* ── RENDER ── */
function selectBonus(id) {
    selectedBonus = id;
    const bt = getBonusType(id);
    const lbl = document.getElementById('bonus-select-label');
    lbl.textContent = bt.label;
    lbl.classList.remove('placeholder');
    updateUrl();
    renderContent();
}

// Get all bonus entries for a source matching the selected bonus id
function getMatchingBonuses(src, bonusId) {
    const parents = DATA.bonus_types.filter(bt => bt.aliases?.includes(bonusId)).map(bt => bt.id);
    const ids = [bonusId, ...parents];
    return src.bonuses.filter(b => ids.includes(b.bonus));
}

function renderContent() {
    const content = document.getElementById('bonus-content');
    const empty = document.getElementById('empty-state');
    const openPills = document.querySelector('.breakdown.open') !== null;
    content.innerHTML = '';

    if (!selectedBonus) {
        content.classList.remove('visible');
        empty.style.display = '';
        return;
    }

    empty.style.display = 'none';
    content.classList.add('visible');

    // Group sources by type that have this bonus (may have multiple entries)
    const groups = {};
    for (const src of DATA.sources) {
        const matchingBonuses = getMatchingBonuses(src, selectedBonus);
        if (matchingBonuses.length === 0) continue;
        if (!groups[src.type]) groups[src.type] = [];
        groups[src.type].push({ src, bonuses: matchingBonuses });
    }

    renderConditionPanel(content);
    renderMaxPills(content, groups);
    if (openPills) {
        content.querySelectorAll('.breakdown').forEach(b => b.classList.add('open'));
        content.querySelectorAll('.max-pill').forEach(p => p.classList.add('open'));
        content.querySelectorAll('.max-pill-chevron').forEach(c => c.style.transform = 'rotate(180deg)');
    }

    const typeOrder = Object.keys(DATA.types);

    for (const type of typeOrder) {
        if (!groups[type]) continue;
        const section = document.createElement('div');
        section.className = 'source-section';
        section.dataset.type = type;

        const hdr = document.createElement('div');
        hdr.className = 'section-header';
        hdr.style.cursor = 'pointer';
        hdr.style.userSelect = 'none';
        const ts = typeTagStyle(type);
        hdr.style.borderLeft = 'none';
        section.style.setProperty('--section-color', ts.color);
        hdr.textContent = typeLabel(type) + 's';

        const hdrChev = document.createElement('span');
        hdrChev.textContent = '▼';
        hdrChev.className = 'section-chev';
        hdr.appendChild(hdrChev);

        const sectionBody = document.createElement('div');

        if (collapsedSections.has(type)) {
            sectionBody.style.display = 'none';
            hdrChev.classList.add('collapsed');
        }

        hdr.addEventListener('click', () => {
            const isCollapsed = sectionBody.style.display === 'none';
            sectionBody.style.display = isCollapsed ? '' : 'none';
            hdrChev.classList.toggle('collapsed', !isCollapsed);
            if (isCollapsed) collapsedSections.delete(type);
            else {
                collapsedSections.add(type);
                sectionBody.querySelectorAll('.detail-table.open').forEach(t => t.classList.remove('open'));
                sectionBody.querySelectorAll('.src-chev').forEach(c => c.style.transform = '');
            }
        });

        section.appendChild(hdr);

        for (const { src, bonuses } of groups[type]) {
            const row = document.createElement('div');
            row.className = 'source-row';

            // image
            const imgWrap = document.createElement('div');
            imgWrap.className = 'src-img';
            if (src.image) {
                const img = document.createElement('img');
                img.src = src.image;
                img.alt = src.name;
                img.onerror = () => { imgWrap.innerHTML = '<div class="src-img-ph"></div>'; };
                imgWrap.appendChild(img);
            } else {
                imgWrap.innerHTML = '<div class="src-img-ph"></div>';
            }

            // info
            const info = document.createElement('div');
            info.className = 'src-info';
            const name = document.createElement('div');
            name.className = 'src-name';
            name.textContent = src.name;
            info.appendChild(name);

            const tags = document.createElement('div');
            tags.className = 'src-tags';

            for (const b of bonuses) {
                if (b.bonus !== selectedBonus) {
                    const aliasTag = document.createElement('span');
                    aliasTag.className = 'tag tag-alias';
                    aliasTag.textContent = getBonusType(b.bonus)?.label ?? b.bonus;
                    tags.appendChild(aliasTag);
                }
            }

            if (bonuses[0].derived_from) {
                const bt = getBonusType(bonuses[0].derived_from);
                const derived = document.createElement('span');
                derived.className = 'tag src-derived';
                derived.textContent = (bt ? bt.label : bonuses[0].derived_from);
                tags.appendChild(derived);
            }

            if (src.available === false) {
                const naTag = document.createElement('span');
                naTag.className = 'tag tag-na';
                naTag.textContent = 'Unavailable';
                tags.appendChild(naTag);
            }

            info.appendChild(tags);

            if (src.classes) {
                for (const c of src.classes) {
                    const found = DATA.classes.find(cl => cl.id === c);
                    const clsTag = document.createElement('span');
                    clsTag.className = 'tag';
                    clsTag.style.background = found?.color ? found.color + '22' : '#1a2030';
                    clsTag.style.color = found?.color || '#6090c0';
                    clsTag.textContent = found ? found.label : c;
                    tags.appendChild(clsTag);
                }
            }

            if (bonuses.some(b => b.condition)) {
                const condTag = document.createElement('span');
                condTag.className = 'tag tag-conditional';
                const condId = bonuses.find(b => b.condition)?.condition;
                const cond = DATA.conditions?.find(c => c.id === condId);
                condTag.textContent = '⚑ ' + (cond ? cond.label : condId);
                tags.appendChild(condTag);
            }

            // right — stack all matching bonus values
            const right = document.createElement('div');
            right.className = 'src-right';

            const val = document.createElement('div');
            val.className = 'src-val';
            val.innerHTML = bonuses.map(b => {
                const ut = b.unit_type || 'flat';
                const u = unitFor(b.bonus, ut);
                return formatVal(b.value, u, ut);
            }).join('<br>');
            right.appendChild(val);

            if (src.slot) {
                const max = slotMax(src.slot);
                const slots = document.createElement('div');
                slots.className = 'src-slots';
                slots.textContent = max > 1 ? 'up to ' + max + ' slots' : '1 slot';
                right.appendChild(slots);
            }

            row.append(imgWrap, info, right);

            const wrapper = document.createElement('div');
            wrapper.className = 'source-row-wrap';
            wrapper.appendChild(row);

            // Detail table — show tiers for the first matching bonus (or all bonuses if multiple)
            const tierRows = getTierRows(src, bonuses[0], selectedBonus);
            if (tierRows) {
                wrapper.classList.add('has-detail');

                const table = document.createElement('div');
                table.className = 'detail-table';

                const totalTiers = tierRows.length;
                const indicesToShow = totalTiers <= 4
                    ? tierRows.map((_, i) => i)
                    : [0, 1, 2, null, totalTiers - 1]; // null = ellipsis row

                for (const idx of indicesToShow) {
                    if (idx === null) {
                        const ellipsis = document.createElement('div');
                        ellipsis.className = 'detail-row';
                        ellipsis.style.color = 'var(--hint)';
                        ellipsis.style.justifyContent = 'center';
                        ellipsis.textContent = '⋯';
                        table.appendChild(ellipsis);
                        continue;
                    }

                    const tier = tierRows[idx];
                    const tr = document.createElement('div');
                    tr.className = 'detail-row';
                    const lbl = document.createElement('span');
                    lbl.className = 'detail-lbl';
                    lbl.textContent = tier.label;
                    tr.appendChild(lbl);

                    for (const b of bonuses) {
                        const ut = b.unit_type || 'flat';
                        const cell = document.createElement('span');
                        cell.className = 'detail-val';
                        const tierVal = tier[selectedBonus];
                        cell.textContent = tierVal != null
                            ? formatVal(tierVal, unitFor(selectedBonus, ut), ut)
                            : '—';
                        tr.appendChild(cell);
                    }

                    table.appendChild(tr);
                }

                wrapper.appendChild(table);

                const chev = document.createElement('span');
                chev.className = 'src-chev';
                chev.textContent = '▼';
                right.appendChild(chev);

                row.addEventListener('click', () => {
                    const isOpen = table.classList.contains('open');
                    table.classList.toggle('open', !isOpen);
                    chev.style.transform = isOpen ? '' : 'rotate(180deg)';
                });
            }

            sectionBody.appendChild(wrapper);
        }

        section.appendChild(sectionBody);
        content.appendChild(section);
    }
}

/* ── MAX PILLS ── */
function compoundTotal(items, bonusId) {
    // Each item: { value, unit_type, mult }
    // Compound formula: sum(flat) × (1 + sum(percent)/100) × product(multipliers)
    // mult is the slot multiplier (how many of this source can be equipped)
    let flat = 0, percent = 0, multiplier = 1;
    let hasMixed = false;
    const unitTypes = new Set(items.map(i => i.unit_type || 'flat'));
    hasMixed = unitTypes.size > 1;

    for (const item of items) {
        const ut = item.unit_type || 'flat';
        const total = item.value * item.mult;
        if (ut === 'flat') flat += total;
        else if (ut === 'percent') percent += total;
        else if (ut === 'multiplier') multiplier *= (1 + total / 100);
    }

    if (hasMixed) {
        // Compound result — return as flat ATK equivalent
        return { value: flat * (1 + percent / 100) * multiplier, unit_type: 'flat', isMixed: true };
    } else {
        // All same type — just sum
        const ut = [...unitTypes][0];
        const sum = ut === 'flat' ? flat : ut === 'percent' ? percent : multiplier - 1;
        return { value: ut === 'multiplier' ? (multiplier - 1) * 100 : (ut === 'flat' ? flat : percent), unit_type: ut, isMixed: false };
    }
}

function formatTotal(result, bonusId) {
    const ut = result.unit_type || 'flat';
    const u = unitFor(bonusId, ut);
    if (result.isMixed) {
        return formatVal(Math.round(result.value * 10) / 10, u, 'flat') + ' (combined)';
    }
    return formatVal(Math.round(result.value * 10) / 10, u, ut);
}

function updateUrl() {
    const params = new URLSearchParams();
    if (selectedBonus) params.set('bonus', selectedBonus);
    if (selectedClass) params.set('class', selectedClass);
    params.set('level', characterLevel);
    if (activeConditions.size > 0) params.set('conditions', [...activeConditions].join(','));
    history.replaceState(null, '', '?' + params.toString());
}

function renderConditionPanel(content) {
    if (!DATA.conditions || DATA.conditions.length === 0) return;

    const panel = document.createElement('div');
    panel.className = 'condition-panel';

    const hdr = document.createElement('div');
    hdr.className = 'condition-header';
    hdr.textContent = 'Conditions';
    hdr.style.cursor = 'pointer';
    hdr.style.userSelect = 'none';

    const chev = document.createElement('span');
    chev.className = 'section-chev';
    chev.textContent = '▼';
    chev.classList.toggle('collapsed', !conditionPanelOpen);
    hdr.appendChild(chev);

    const body = document.createElement('div');
    body.className = 'condition-body';
    body.style.display = conditionPanelOpen ? '' : 'none';

    for (const cond of DATA.conditions) {
        const row = document.createElement('label');
        row.className = 'condition-row';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = activeConditions.has(cond.id);
        cb.addEventListener('change', () => {
            if (cb.checked) activeConditions.add(cond.id);
            else activeConditions.delete(cond.id);
            updateUrl();
            renderContent();
        });

        const lbl = document.createElement('span');
        lbl.textContent = cond.label;

        row.append(cb, lbl);
        body.appendChild(row);
    }

    hdr.addEventListener('click', () => {
        conditionPanelOpen = !conditionPanelOpen;
        body.style.display = conditionPanelOpen ? '' : 'none';
        chev.classList.toggle('collapsed', !conditionPanelOpen);
    });

    panel.append(hdr, body);
    content.appendChild(panel);
}

function renderMaxPills(content, groups) {
    function calcItems(availableOnly) {
        const slotBest = {};
        const items = [];

        for (const type of Object.keys(DATA.types)) {
            if (!groups[type]) continue;
            for (const { src, bonuses } of groups[type]) {
                if (availableOnly && src.available === false) continue;

                const parents = DATA.bonus_types.filter(bt => bt.aliases?.includes(selectedBonus)).map(bt => bt.id);
                const ids = [selectedBonus, ...parents];
                for (const b of bonuses.filter(b => {
                    if (!ids.includes(b.bonus)) return false;
                    const classes = b.classes || src.classes;
                    if (classes && !classes.includes(selectedClass)) return false;
                    if (b.condition && !activeConditions.has(b.condition)) return false;
                    return true;
                })) {
                    const entry = { src, bonus: b, value: b.value, unit_type: b.unit_type || 'flat', mult: 1 };

                    if (src.slot) {
                        const max = slotMax(src.slot);
                        if (max === 1) {
                            // Keep best per slot per unit_type
                            const key = src.slot + ':' + entry.unit_type;
                            if (!slotBest[key] || b.value > slotBest[key].value) {
                                slotBest[key] = entry;
                            }
                        } else {
                            items.push({ ...entry, mult: max });
                        }
                    } else {
                        items.push(entry);
                    }
                }
            }
        }

        for (const s of Object.values(slotBest)) items.push(s);
        return items;
    }

    const allItems = calcItems(false);
    const availItems = calcItems(true);

    const allResult = compoundTotal(allItems, selectedBonus);
    const availResult = compoundTotal(availItems, selectedBonus);

    const maxSection = document.createElement('div');
    maxSection.className = 'max-section';

    function makePill(label, result, items, pillId) {
        const pill = document.createElement('div');
        pill.className = 'max-pill';
        pill.id = pillId;

        const top = document.createElement('div');
        top.className = 'max-pill-top';

        const left = document.createElement('div');
        const lbl = document.createElement('div');
        lbl.className = 'max-pill-lbl';
        lbl.textContent = label;
        const val = document.createElement('div');
        val.className = 'max-pill-val';
        val.textContent = formatTotal(result, selectedBonus);
        left.append(lbl, val);

        const chev = document.createElement('span');
        chev.className = 'max-pill-chevron';
        chev.textContent = '▼';

        top.append(left, chev);
        pill.appendChild(top);

        const bd = document.createElement('div');
        bd.className = 'breakdown';

        for (const item of items) {
            const row = document.createElement('div');
            row.className = 'bd-row';
            const nameEl = document.createElement('div');
            nameEl.className = 'bd-name';
            const dot = document.createElement('span');
            dot.className = 'bd-dot';
            dot.style.background = TYPE_COLORS[item.src.type] || '#888';
            const txt = document.createElement('span');
            const ut = item.unit_type || 'flat';
            const u = unitFor(selectedBonus, ut);
            let nameText = item.src.name + (item.mult > 1 ? ' ×' + item.mult : '');
            if (item.src.available === false) {
                txt.style.color = '#d04040';
                nameText += ' (unavail.)';
            }
            txt.textContent = nameText;
            nameEl.append(dot, txt);

            const valEl = document.createElement('div');
            valEl.className = 'bd-val';
            valEl.textContent = formatVal(item.value * item.mult, u, ut);
            row.append(nameEl, valEl);
            bd.appendChild(row);
        }

        const totalRow = document.createElement('div');
        totalRow.className = 'bd-total';
        totalRow.innerHTML = '<span>Total</span><span>' + formatTotal(result, selectedBonus) + '</span>';
        bd.appendChild(totalRow);
        pill.appendChild(bd);

        return pill;
    }

    maxSection.appendChild(makePill('Max (all sources)', allResult, allItems, 'pill-all'));
    maxSection.appendChild(makePill('Max (available only)', availResult, availItems, 'pill-avail'));
    content.appendChild(maxSection);

    const pills = maxSection.querySelectorAll('.max-pill');
    pills.forEach(pill => {
        pill.addEventListener('click', () => {
            const isOpen = pill.querySelector('.breakdown').classList.contains('open');
            pills.forEach(p => {
                p.querySelector('.breakdown').classList.toggle('open', !isOpen);
                p.classList.toggle('open', !isOpen);
            });
        });
    });
}

function buildClassSwitcher() {
    const wrap = document.getElementById('class-switcher');
    wrap.innerHTML = '';
    for (const cls of DATA.classes) {
        const btn = document.createElement('button');
        btn.className = 'class-btn' + (selectedClass === cls.id ? ' active' : '');
        btn.textContent = cls.label;
        if (selectedClass === cls.id) btn.style.background = cls.color;
        btn.style.setProperty('--cls-color', cls.color);
        btn.addEventListener('click', () => {
            selectedClass = cls.id;
            updateUrl();
            buildClassSwitcher();
            renderContent();
        });
        wrap.appendChild(btn);
    }
}

/* ── INIT ── */
async function init() {
    try {
        const r = await fetch('bonuses.json');
        DATA = await r.json();
        const sourceArrays = await Promise.all(
            DATA.source_files.map(f => fetch(f).then(r => r.json()))
        );
        DATA.sources = sourceArrays.flatMap(file =>
            file.bonuses.map(src => ({
                ...src,
                type: src.type ?? file.type,
                available: src.available ?? true,
                _file_tiers_formula: file.tiers_formula ?? null,
                bonuses: src.bonuses.map(b => {
                    const formula = resolveFormula({ _file_tiers_formula: file.tiers_formula ?? null, ...src }, b);
                    return { ...b, value: b.tiers_formula === false || (!b.tiers_formula && b.value !== undefined) ? b.value : formula ? (formula.init ?? formula.coeff) + (formula.max_tier - 1) * formula.coeff : b.value };
                })
            }))
        );
    } catch (e) {
        console.log(e)
        document.body.innerHTML = '<p style="color:#f88;padding:2rem;font-size:16px">Could not load bonuses.json</p>';
        return;
    }

    // Build TYPE_COLORS from JSON for breakdown dots
    for (const [type, def] of Object.entries(DATA.types)) {
        TYPE_COLORS[type] = def.tag_style ? def.tag_style.color : '#888';
    }

    const params = new URLSearchParams(window.location.search);
    selectedClass = params.get('class') || DATA.classes[0].id;
    buildClassSwitcher();

    const conditionsParam = params.get('conditions');
    if (conditionsParam) {
        conditionsParam.split(',').forEach(c => activeConditions.add(c));
        conditionPanelOpen = true;
    }

    const bonusParam = params.get('bonus');
    if (bonusParam && DATA.bonus_types.find(b => b.id === bonusParam)) {
        selectBonus(bonusParam);
    }

    const levelParam = params.get('level');
    if (levelParam) characterLevel = Math.min(parseInt(levelParam) || 1, DATA.max_level ?? 150);
    buildLevelInput();

    // Dropdown toggle
    document.getElementById('bonus-select-box').addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = document.getElementById('bonus-dropdown').classList.contains('open');
        isOpen ? closeDropdown() : openDropdown();
    });

    document.getElementById('bonus-dropdown').addEventListener('click', e => e.stopPropagation());
    document.addEventListener('click', closeDropdown);

    document.getElementById('bonus-search').addEventListener('input', (e) => {
        buildDropdown(e.target.value);
    });

    document.getElementById('report-btn').addEventListener('click', (e) => {
        e.currentTarget.href = `https://github.com/badbotexe/evi/issues/new?title=${encodeURIComponent('[Bonuses] Issue')}&body=${encodeURIComponent('**Bonus:** ' + (selectedBonus ?? 'N/A') + '\n\n**Description:**\n')}`;
    });

    buildDropdown('');
}

init();
