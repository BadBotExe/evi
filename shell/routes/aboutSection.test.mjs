import assert from 'node:assert/strict';
import { renderAboutSectionMarkup } from './aboutSection.js';

const markup = renderAboutSectionMarkup();

assert.equal(
    markup.includes('layout about-view about-mobile-browser'),
    true,
    'about section should keep the desktop layout class and the dedicated mobile about class'
);

assert.equal(
    markup.includes('data-shell-link'),
    true,
    'about section cards should keep shell navigation hooks'
);

assert.equal(
    markup.includes('href="/tools"'),
    true,
    'about section should link to calculators'
);

console.log('shell/aboutSection.test.mjs passed');
