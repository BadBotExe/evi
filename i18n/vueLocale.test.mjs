import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SpriteImage } from '../bonuses/components/SpriteImage.js';
import { installVueLocale, localizeComponents } from './vueLocale.js';
import { setLocale } from './locale.js';

test('Vue can render localized components before section setup installs the root', () => {
    const cleanups = [];
    const app = { config: { globalProperties: {} }, onUnmount: cleanup => cleanups.push(cleanup) };
    installVueLocale(app);
    const label = app.config.globalProperties.$label;
    try {
        setLocale('ru');
        assert.equal(label('Recipe'), 'Рецепт');
        installVueLocale(app, { childNodes: [] });
        assert.equal(app.config.globalProperties.$label, label);
        assert.equal(cleanups.length, 1);
    } finally {
        cleanups.forEach(cleanup => cleanup());
        setLocale('en');
    }
});

test('localizing a SpriteImage keeps SVG directives out of the HTML parser', () => {
    const originalDocument = globalThis.document;
    const templates = [];
    globalThis.document = {
        createElement() {
            return {
                content: { childNodes: [] },
                set innerHTML(source) { templates.push(source); },
                get innerHTML() { return templates.at(-1); }
            };
        }
    };
    try {
        const localized = localizeComponents({ SpriteImage }).SpriteImage;
        assert.doesNotMatch(templates[0], /<svg\b/);
        const svg = /<svg\b[\s\S]*?<\/svg>/;
        assert.equal(localized.template.match(svg)?.[0], SpriteImage.template.match(svg)?.[0]);
        assert.match(localized.template, /:viewBox="viewBox"/);
    } finally {
        globalThis.document = originalDocument;
    }
});
