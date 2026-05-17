import assert from 'node:assert/strict';
import { renderShellLayoutMarkup } from './shellLayout.js';

const markup = renderShellLayoutMarkup('Cards');

assert.equal(
    markup.includes('id="shell-mobile-inline-actions"'),
    true,
    'shell layout should include a mobile inline actions slot'
);

console.log('shell/shellMobileInlineActions.test.mjs passed');
