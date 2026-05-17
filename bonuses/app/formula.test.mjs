import assert from 'node:assert/strict';
import { formulaMethods } from './formula.js';

const multiply = formulaMethods._parseFormulaExpression('2 × 3');
assert.equal(multiply?.type, 'binary');
assert.equal(multiply?.op, '*');

const divide = formulaMethods._parseFormulaExpression('8 ÷ 4');
assert.equal(divide?.type, 'binary');
assert.equal(divide?.op, '/');

console.log('bonuses/app/formula.test.mjs passed');
