export const formulaMethods = {
    _escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    _tokenizeFormulaExpression(expression) {
        const source = String(expression ?? '')
            .trim()
            .replace(/Ã—/g, '*')
            .replace(/Ã·/g, '/');
        const tokens = [];
        let i = 0;

        while (i < source.length) {
            const ch = source[i];
            if (/\s/.test(ch)) {
                i += 1;
                continue;
            }
            if (/[0-9.]/.test(ch)) {
                let j = i + 1;
                while (j < source.length) {
                    const next = source[j];
                    if (/[0-9.]/.test(next)) {
                        j += 1;
                        continue;
                    }
                    if (
                        next === ','
                        && /[0-9]/.test(source[j - 1] ?? '')
                        && /[0-9]/.test(source[j + 1] ?? '')
                    ) {
                        j += 1;
                        continue;
                    }
                    break;
                }
                tokens.push({ type: 'number', value: source.slice(i, j) });
                i = j;
                continue;
            }
            if ('()+-*/^,[]'.includes(ch)) {
                tokens.push({ type: ch, value: ch });
                i += 1;
                continue;
            }
            if (/[A-Za-z_]/.test(ch)) {
                let j = i + 1;
                while (j < source.length) {
                    if (/[A-Za-z0-9_]/.test(source[j])) {
                        j += 1;
                        continue;
                    }
                    if (/\s/.test(source[j])) {
                        let k = j;
                        while (k < source.length && /\s/.test(source[k])) k += 1;
                        if (k < source.length && /[A-Za-z0-9_]/.test(source[k])) {
                            j = k + 1;
                            while (j < source.length && /[A-Za-z0-9_]/.test(source[j])) j += 1;
                            continue;
                        }
                    }
                    break;
                }
                tokens.push({ type: 'identifier', value: source.slice(i, j).trim() });
                i = j;
                continue;
            }
            return null;
        }

        return tokens;
    },

    _parseFormulaExpression(expression) {
        const tokens = this._tokenizeFormulaExpression(expression);
        if (!tokens) return null;

        let index = 0;
        const peek = () => tokens[index] ?? null;
        const consume = expected => {
            const token = peek();
            if (!token || (expected && token.type !== expected)) return null;
            index += 1;
            return token;
        };

        const parsePrimary = () => {
            const token = peek();
            if (!token) return null;

            if (token.type === 'number') {
                consume();
                return { type: 'literal', value: token.value };
            }
            if (token.type === 'identifier') {
                consume();
                if (peek()?.type === '(') {
                    consume('(');
                    const args = [];
                    if (peek()?.type !== ')') {
                        while (true) {
                            const arg = parseAdditive();
                            if (!arg) return null;
                            args.push(arg);
                            if (peek()?.type === ',') {
                                consume(',');
                                continue;
                            }
                            break;
                        }
                    }
                    if (!consume(')')) return null;
                    return { type: 'call', name: token.value, args };
                }
                return { type: 'identifier', value: token.value };
            }
            if (token.type === '(') {
                consume('(');
                const expr = parseAdditive();
                if (!expr || !consume(')')) return null;
                return { type: 'group', expr };
            }
            if (token.type === '[') {
                consume('[');
                const values = [];
                if (peek()?.type !== ']') {
                    while (true) {
                        const item = parseAdditive();
                        if (!item) return null;
                        values.push(item);
                        if (peek()?.type === ',') {
                            consume(',');
                            continue;
                        }
                        break;
                    }
                }
                if (!consume(']')) return null;
                return { type: 'list', values };
            }
            if (token.type === '+' || token.type === '-') {
                consume();
                const operand = parsePrimary();
                if (!operand) return null;
                return { type: 'unary', op: token.type, operand };
            }

            return null;
        };

        const parsePower = () => {
            let left = parsePrimary();
            if (!left) return null;
            while (peek()?.type === '^') {
                consume('^');
                const right = parsePower();
                if (!right) return null;
                left = { type: 'binary', op: '^', left, right };
            }
            return left;
        };

        const parseMultiplicative = () => {
            let left = parsePower();
            if (!left) return null;
            while (peek() && (peek().type === '*' || peek().type === '/')) {
                const op = consume().type;
                const right = parsePower();
                if (!right) return null;
                left = { type: 'binary', op, left, right };
            }
            return left;
        };

        const parseAdditive = () => {
            let left = parseMultiplicative();
            if (!left) return null;
            while (peek() && (peek().type === '+' || peek().type === '-')) {
                const op = consume().type;
                const right = parseMultiplicative();
                if (!right) return null;
                left = { type: 'binary', op, left, right };
            }
            return left;
        };

        const root = parseAdditive();
        if (!root || index !== tokens.length) return null;
        return root;
    },

    _formulaNodePrecedence(node) {
        if (!node) return 0;
        if (node.type === 'binary') {
            if (node.op === '+' || node.op === '-') return 1;
            if (node.op === '*' || node.op === '/') return 2;
            if (node.op === '^') return 3;
        }
        if (node.type === 'unary') return 4;
        return 5;
    },

    _renderFormulaNodeHtml(node, parentPrecedence = 0, position = null) {
        if (!node) return '';

        const wrapGrouped = html => `<span class="price-breakdown-formula-group-wrap"><span class="price-breakdown-formula-group">(</span>${html}<span class="price-breakdown-formula-group">)</span></span>`;
        const wrapIfNeeded = (html, needsParens) => needsParens ? wrapGrouped(html) : html;

        if (node.type === 'literal') {
            return `<span class="price-breakdown-formula-atom">${this._escapeHtml(node.value)}</span>`;
        }

        if (node.type === 'identifier') {
            return `<span class="price-breakdown-formula-symbol">${this._escapeHtml(node.value)}</span>`;
        }

        if (node.type === 'group') {
            const inner = this._renderFormulaNodeHtml(node.expr, 0);
            return wrapGrouped(inner);
        }

        if (node.type === 'list') {
            const items = node.values.map(item => this._renderFormulaNodeHtml(item, 0)).join('<span class="price-breakdown-formula-punct">, </span>');
            return `<span class="price-breakdown-formula-group">[</span>${items}<span class="price-breakdown-formula-group">]</span>`;
        }

        if (node.type === 'call') {
            const args = node.args.map(arg => this._renderFormulaNodeHtml(arg, 0)).join('<span class="price-breakdown-formula-punct">, </span>');
            if (node.args.length === 1 && (node.name === 'floor' || node.name === 'ceil')) {
                const leftBracket = node.name === 'floor' ? '&lfloor;' : '&lceil;';
                const rightBracket = node.name === 'floor' ? '&rfloor;' : '&rceil;';
                return `<span class="price-breakdown-formula-bracketed"><span class="price-breakdown-formula-bracket">${leftBracket}</span>${args}<span class="price-breakdown-formula-bracket">${rightBracket}</span></span>`;
            }
            return `<span class="price-breakdown-formula-call"><span class="price-breakdown-formula-fn">${this._escapeHtml(node.name)}</span><span class="price-breakdown-formula-group">(</span>${args}<span class="price-breakdown-formula-group">)</span></span>`;
        }

        if (node.type === 'unary') {
            const operand = this._renderFormulaNodeHtml(node.operand, this._formulaNodePrecedence(node), 'right');
            const html = `<span class="price-breakdown-formula-op">${this._escapeHtml(node.op)}</span>${operand}`;
            return wrapIfNeeded(html, this._formulaNodePrecedence(node) < parentPrecedence);
        }

        if (node.type === 'binary') {
            const precedence = this._formulaNodePrecedence(node);

            if (node.op === '/') {
                const leftNeedsParens = this._formulaNodePrecedence(node.left) < precedence;
                const rightNeedsParens = this._formulaNodePrecedence(node.right) < precedence
                    || this._formulaNodePrecedence(node.right) === precedence;
                const numerator = wrapIfNeeded(this._renderFormulaNodeHtml(node.left, precedence, 'left'), leftNeedsParens);
                const denominator = wrapIfNeeded(this._renderFormulaNodeHtml(node.right, precedence, 'right'), rightNeedsParens);
                const html = `${numerator}<span class="price-breakdown-formula-op">/</span>${denominator}`;
                return wrapIfNeeded(html, precedence < parentPrecedence);
            }

            if (node.op === '^') {
                const baseNeedsParens = ['binary', 'unary'].includes(node.left?.type) && node.left?.type !== 'group';
                const exponent = this._renderFormulaNodeHtml(node.right, 0);
                const base = this._renderFormulaNodeHtml(node.left, precedence, 'left');
                const html = `${wrapIfNeeded(base, baseNeedsParens)}<sup class="price-breakdown-formula-sup">${exponent}</sup>`;
                return wrapIfNeeded(html, precedence < parentPrecedence);
            }

            const leftNeedsParens = this._formulaNodePrecedence(node.left) < precedence;
            const rightNeedsParens = this._formulaNodePrecedence(node.right) < precedence
                || ((node.op === '-' || node.op === '*') && this._formulaNodePrecedence(node.right) === precedence)
                || (node.op === '+' && node.right?.op === '-');
            const left = wrapIfNeeded(this._renderFormulaNodeHtml(node.left, precedence, 'left'), leftNeedsParens);
            const right = wrapIfNeeded(this._renderFormulaNodeHtml(node.right, precedence, 'right'), rightNeedsParens);
            const op = node.op === '*' ? '&times;' : this._escapeHtml(node.op);
            const html = `${left}<span class="price-breakdown-formula-op">${op}</span>${right}`;
            return wrapIfNeeded(html, precedence < parentPrecedence);
        }

        return '';
    },

    _formatFormulaExpressionHtml(expression) {
        const parsed = this._parseFormulaExpression(expression);
        if (!parsed) {
            return this._escapeHtml(expression)
                .replace(/\*/g, '&times;')
                .replace(/\//g, '&divide;');
        }
        return `<span class="price-breakdown-formula-math">${this._renderFormulaNodeHtml(parsed)}</span>`;
    },
};
