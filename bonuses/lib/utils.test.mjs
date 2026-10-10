import assert from 'node:assert/strict';
import { formatCompactNumber, formatEngineeringNumber } from './utils.js';

const normalizeSeparators = value => value.replace(/[\s,\u00A0]+/g, '_');

assert.equal(normalizeSeparators(formatCompactNumber(123456789)), '123_456_789');
assert.equal(normalizeSeparators(formatCompactNumber(12345.67)), '12_346');
assert.equal(formatCompactNumber(9999.99), '9,999.99');
assert.equal(formatCompactNumber(1000000000), '1B');
assert.equal(formatCompactNumber(1234567890), '1.23B');
assert.equal(formatCompactNumber(13664335558742.35), '13.66T');
assert.equal(formatCompactNumber(999500000000), '999.5B');
assert.equal(formatCompactNumber(-2500000000), '-2.5B');

assert.equal(formatEngineeringNumber(845000), '845,000');
assert.equal(formatEngineeringNumber(2210000), '2.21M');
assert.equal(formatEngineeringNumber(4190000000), '4.19B');
assert.equal(formatEngineeringNumber(441000000000000), '441T');
assert.equal(formatEngineeringNumber(539000000000000000), '5.39e17');
assert.equal(formatEngineeringNumber(3200000000000000000000), '3.2e21');
assert.equal(formatEngineeringNumber(1140000000000000000000000000000000000), '1.14e36');
assert.equal(formatEngineeringNumber(-3250000000000000), '-3.25e15');

console.log('bonuses/lib/utils.test.mjs passed');
