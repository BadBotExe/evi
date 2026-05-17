import assert from 'node:assert/strict';
import { renderShellLayoutMarkup } from './shellLayout.js';

const defaultMarkup = renderShellLayoutMarkup();
const cardsMarkup = renderShellLayoutMarkup('Cards');

assert.equal(
    defaultMarkup.includes('id="shell-route-host"'),
    true,
    'shell layout should include the route host mount'
);

assert.equal(
    defaultMarkup.includes('data-shell-route="tools" href="/tools"'),
    true,
    'shell layout should include calculator navigation links'
);

assert.equal(
    defaultMarkup.includes('id="shell-mobile-secondary"'),
    true,
    'shell layout should include the optional mobile secondary action button'
);

assert.equal(
    cardsMarkup.includes('id="shell-mobile-title" class="mobile-header-title">Cards<'),
    true,
    'shell layout should render the requested initial mobile title'
);

console.log('shell/shellLayout.test.mjs passed');
