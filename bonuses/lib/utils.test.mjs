import assert from 'node:assert/strict';
import { formatCompactNumber } from './utils.js';

const normalizeSeparators = value => value.replace(/[\s,\u00A0]+/g, '_');

assert.equal(normalizeSeparators(formatCompactNumber(123456789)), '123_456_789');
assert.equal(normalizeSeparators(formatCompactNumber(12345.67)), '12_346');
assert.equal(formatCompactNumber(9999.99), '9,999.99');
assert.equal(formatCompactNumber(1000000000), '1B');
assert.equal(formatCompactNumber(1234567890), '1.23B');
assert.equal(formatCompactNumber(13664335558742.35), '13.66T');
assert.equal(formatCompactNumber(999500000000), '999.5B');
assert.equal(formatCompactNumber(-2500000000), '-2.5B');

console.log('bonuses/lib/utils.test.mjs passed');
