import assert from 'node:assert/strict';
import { renderShellLayoutMarkup } from './shellLayout.js';

const markup = renderShellLayoutMarkup();

assert.equal(
    markup.includes('id="shell-loader"'),
    true,
    'shell layout should include the shared loading overlay mount'
);

assert.equal(
    markup.includes('id="shell-loader-frame-host"'),
    true,
    'shell layout should include the shared loading frame host'
);

assert.equal(
    markup.includes('class="shell-loader-label">Loading<'),
    true,
    'shell layout should render the shared loader label'
);

console.log('shell/layout/shellLoaderLayout.test.mjs passed');
