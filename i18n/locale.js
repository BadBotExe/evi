import en from './ui-en.js?v=696f20e789';
import ru from './ui-ru.js?v=6ab9553f40';
import gameEn from './game-en.js?v=253b5374fe';
import gameRu from './game-ru.js?v=9452b421a4';
import sectionRu from './section-ru.js?v=34978d60e7';
import { localeState } from './localeState.js?v=4b16b5aec1';

const catalog = {
    en: { label: 'English', messages: en, game: gameEn },
    ru: { label: 'Русский', messages: ru, game: gameRu, sectionLabels: sectionRu }
};
export const SITE_LOCALES = Object.freeze(
    Object.fromEntries(Object.entries(catalog).map(([id, entry]) => [id, entry.label]))
);

function displayLabels(entry) {
    if (entry === catalog.en) return new Map();
    return new Map([
        ...Object.entries(en).map(([key, value]) => [value, entry.messages[key]]),
        ...Object.entries(entry.sectionLabels ?? {}),
        ...Object.entries(entry.game.display ?? {}),
        ...Object.entries(gameEn.nav).map(([id, value]) => [value, entry.game.nav[id]])
    ]);
}

const displayLabelsByLocale = Object.fromEntries(
    Object.entries(catalog).map(([id, entry]) => [id, displayLabels(entry)])
);
const knownDisplayLabels = new Set(Object.values(displayLabelsByLocale).flatMap(labels => [...labels.keys()]));
const numberedLabel = /^(Node|Nodes|Tier|Tiers|Level|Act) ([0-9]+(?:[-–][0-9]+)?)$/;
const durationLabel = /^(.+) \((\d+) hours\)$/;
const combinedLabel = / (?:·|×) /;
const sourceLabels = [
    [/^Act (\d+) Zone (\d+)$/, 'Act {0} Zone {1}'],
    [/^Act (\d+) Zones (\d+-\d+)$/, 'Act {0} Zones {1}'],
    [/^Act (\d+) (Town Shop|Smith|Egg|All Zones|All Zones \(with bosses\)|All Bosses)$/, 'Act {0} {1}'],
    [/^(.+) \(Act (\d+) Boss\)$/, '{0} (Act {1} Boss)'],
    [/^(.+) Event (\d{4})(?: \(Part (\d+)\))$/, '{0} Event {1} (Part {2})'],
    [/^(.+) Event (\d{4})$/, '{0} Event {1}'],
    [/^Monthly Rewards (\w+) (\d{4})$/, 'Monthly Rewards {0} {1}'],
    [/^(Timeline|Sand) T(\d+)$/, '{0} T{1}'],
    [/^(Timeline|Sand) T(\d+), already built$/, '{0} T{1}, already built'],
    [/^free now: (\d+)$/, 'free now: {0}'],
    [/^Spawn (\d+) × ([A-Z]+1)$/, 'Spawn {0} × {1}'],
    [/^Merge (.+) \((\d+) times\)$/, 'Merge {0} ({1} times)'],
    [/^Merge (.+)$/, 'Merge {0}'],
    [/^Decrease: (.+)$/, 'Decrease: {0}'],
    [/^Increase: (.+)$/, 'Increase: {0}'],
    [/^Board, (\d+) of (\d+) cells occupied$/, 'Board, {0} of {1} cells occupied'],
    [/^Show exact quantity for (.+)$/, 'Show exact quantity for {0}'],
    [/^Show exact (.+) value for (.+)$/, 'Show exact {0} value for {1}']
];

export function hasDisplayLabel(source) {
    return typeof source === 'string' && Boolean(source.trim()) && knownDisplayLabels.has(source);
}

export function translateLabel(source, values = []) {
    if (typeof source !== 'string' || !source.trim()) return source;
    const labels = displayLabelsByLocale[localeState.current];
    if (!labels.size) return values.length ? interpolate(source, values) : source;
    const direct = labels.get(source.trim());
    if (direct !== undefined) return values.length ? interpolate(direct, values.map(value => translateLabel(value))) : direct;
    const numbered = numberedLabel.exec(source);
    if (numbered) return interpolate(labels.get(`${numbered[1]} {0}`) ?? `${numbered[1]} {0}`, [numbered[2]]);
    const duration = durationLabel.exec(source);
    if (duration) return interpolate(labels.get('{0} ({1} hours)') ?? '{0} ({1} hours)', [
        translateLabel(duration[1]),
        duration[2]
    ]);
    if (combinedLabel.test(source)) {
        return source.split(/( [·×] )/).map((part, index) => index % 2 ? part : translateLabel(part)).join('');
    }
    for (const [pattern, key] of sourceLabels) {
        const match = pattern.exec(source);
        if (match && labels.has(key)) return translateLabel(key, match.slice(1));
    }
    return source;
}

function interpolate(label, values) {
    return label.replace(/\{(\d+)\}/g, (_, index) => values[index] ?? '');
}

export function setLocale(next) {
    if (!Object.hasOwn(catalog, next) || next === localeState.current) return;
    localeState.current = next;
    localeState.listeners.forEach(listener => listener(next));
}

export function onLocaleChange(listener) {
    localeState.listeners.add(listener);
    return () => localeState.listeners.delete(listener);
}

export function t(key, params = {}, fallback = key) {
    const message = catalog[localeState.current].messages[key] ?? en[key] ?? fallback;
    return message.replace(/\{(\w+)\}/g, (token, name) => params[name] ?? token);
}

export function gameTerm(group, id, fallback = id) {
    return catalog[localeState.current].game[group]?.[id] || gameEn[group]?.[id] || fallback;
}

function domMessage(key) {
    const [group, id] = key.split(':');
    return id === undefined ? t(key) : gameTerm(group, id);
}

export function translateMarkup(root) {
    for (const node of root.querySelectorAll('[data-i18n]')) {
        node.textContent = domMessage(node.dataset.i18n);
    }
    for (const attr of ['title', 'placeholder', 'aria-label']) {
        for (const node of root.querySelectorAll(`[data-i18n-${attr}]`)) {
            node.setAttribute(attr, domMessage(node.getAttribute(`data-i18n-${attr}`)));
        }
    }
}
