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
    defaultMarkup.includes('data-shell-route="smith" href="/smith"'),
    true,
    'shell layout should include smith navigation links'
);

assert.equal(
    defaultMarkup.includes('id="shell-mobile-secondary"'),
    true,
    'shell layout should include the optional mobile secondary action button'
);

assert.equal(
    defaultMarkup.includes('id="shell-mobile-search"'),
    true,
    'shell layout should include the mobile search action button'
);

assert.equal(
    defaultMarkup.includes('<path d="M3 6.75A.75.75 0 0 1 3.75 6h16.5a.75.75 0 0 1 .53 1.28L14.5 13.56v4.19a.75.75 0 0 1-.33.62l-3 2A.75.75 0 0 1 10 19.75v-6.19L3.22 7.28A.75.75 0 0 1 3 6.75Z" fill="currentColor"/></svg>'),
    true,
    'shell layout should render the filter icon for the mobile search action button'
);

assert.equal(
    cardsMarkup.includes('id="shell-mobile-title" class="mobile-header-title">Cards<'),
    true,
    'shell layout should render the requested initial mobile title'
);

assert.equal(
    defaultMarkup.includes('id="shell-loader"'),
    true,
    'shell layout should include the shared loading overlay mount'
);

assert.equal(
    defaultMarkup.includes('id="shell-loader-frame-host"'),
    true,
    'shell layout should include the shared loading frame host'
);

assert.equal(
    defaultMarkup.includes('class="shell-loader-label">Loading<'),
    true,
    'shell layout should render the shared loader label'
);

assert.equal(
    cardsMarkup.includes('id="shell-mobile-inline-actions"'),
    true,
    'shell layout should include a mobile inline actions slot'
);

console.log('shell/shellLayout.test.mjs passed');
