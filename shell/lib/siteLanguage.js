import { setLocale, SITE_LOCALES } from '../../i18n/locale.js?v=0ca2bbd58a';

export { SITE_LOCALES };

const DEFAULT_LOCALE = 'en';
const STORAGE_KEY = 'evitania_site_locale';

export function resolveSiteLocale(preference, browserLanguages = [], available = SITE_LOCALES) {
    if (Object.hasOwn(available, preference)) return preference;

    const locales = new Map(Object.keys(available).map(locale => [locale.toLowerCase(), locale]));
    for (const language of browserLanguages) {
        let tag = language.toLowerCase();
        while (tag) {
            if (locales.has(tag)) return locales.get(tag);
            const separator = tag.lastIndexOf('-');
            tag = separator === -1 ? '' : tag.slice(0, separator);
        }
        const base = language.toLowerCase().split('-')[0];
        const related = [...locales].filter(([locale]) => locale.split('-')[0] === base);
        if (related.length === 1) return related[0][1];
    }
    return DEFAULT_LOCALE;
}

export function renderLanguageSelect(className) {
    const options = Object.entries(SITE_LOCALES)
        .map(([locale, label]) => `<option value="${locale}" lang="${locale}">${label}</option>`)
        .join('');
    return `<select class="engineering-input ${className}" data-site-language aria-label="Site language" data-i18n-aria-label="shell.language">
        <option value="" data-i18n="shell.browserLanguage">Browser language</option>
        ${options}
    </select>`;
}

export function installSiteLanguage(
    doc = document,
    browser = navigator,
    getStorage = () => localStorage,
    available = { en: SITE_LOCALES.en }
) {
    const controls = [...doc.querySelectorAll('[data-site-language]')];
    let preference = '';
    try {
        preference = getStorage()?.getItem(STORAGE_KEY) ?? '';
    } catch {
        // The browser can block storage.
    }

    function applyPreference(value) {
        preference = Object.hasOwn(available, value) ? value : '';
        const browserLanguages = browser.languages?.length ? browser.languages : [browser.language].filter(Boolean);
        const locale = resolveSiteLocale(preference, browserLanguages, available);
        doc.documentElement.lang = locale;
        setLocale(locale);
        controls.forEach(control => { control.value = preference; });
    }

    applyPreference(preference);
    controls.forEach(control => {
        control.addEventListener('change', () => {
            applyPreference(control.value);
            try {
                if (preference) getStorage()?.setItem(STORAGE_KEY, preference);
                else getStorage()?.removeItem(STORAGE_KEY);
            } catch {
                // The preference is still applied for this page.
            }
        });
    });
}
