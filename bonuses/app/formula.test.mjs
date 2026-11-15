import assert from 'node:assert/strict';
import { formulaMethods } from './formula.js';

const multiply = formulaMethods._parseFormulaExpression('2 × 3');
assert.equal(multiply?.type, 'binary');
assert.equal(multiply?.op, '*');

const divide = formulaMethods._parseFormulaExpression('8 ÷ 4');
assert.equal(divide?.type, 'binary');
assert.equal(divide?.op, '/');

const compactNotation = formulaMethods._parseFormulaExpression('953B * 1.3311^(Level - 1)');
assert.equal(compactNotation?.type, 'binary');
assert.match(
    formulaMethods._formatFormulaExpressionHtml('953B * 1.3311^(Level - 1)'),
    /price-breakdown-formula-symbol[^>]*>Level</,
    'compact notation keeps formula variables highlighted'
);

const scientificNotation = formulaMethods._parseFormulaExpression('1.93e24 * 2.211^(Level - 1)');
assert.equal(scientificNotation?.type, 'binary');

console.log('bonuses/app/formula.test.mjs passed');
