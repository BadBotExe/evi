import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SpriteImage } from '../bonuses/components/SpriteImage.js';
import { localizeComponents } from './vueLocale.js';

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
