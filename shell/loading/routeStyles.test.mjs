import assert from 'node:assert/strict';

import { getShellRouteStyleHref, syncShellRouteStyles } from './routeStyles.js';

function createFakeDocument(initialHref = null) {
    const headChildren = [];
    const nodesById = new Map();

    function createLink() {
        return {
            id: '',
            rel: '',
            attributes: new Map(),
            parentNode: null,
            setAttribute(name, value) {
                this.attributes.set(name, value);
            },
            getAttribute(name) {
                return this.attributes.get(name) ?? null;
            },
            remove() {
                if (!this.parentNode) return;
                const index = this.parentNode.children.indexOf(this);
                if (index >= 0) {
                    this.parentNode.children.splice(index, 1);
                }
                if (this.id) {
                    nodesById.delete(this.id);
                }
                this.parentNode = null;
            }
        };
    }

    const doc = {
        head: {
            children: headChildren,
            appendChild(node) {
                node.parentNode = this;
                headChildren.push(node);
                if (node.id) {
                    nodesById.set(node.id, node);
                }
                return node;
            }
        },
        createElement(tagName) {
            assert.equal(tagName, 'link');
            return createLink();
        },
        getElementById(id) {
            return nodesById.get(id) ?? null;
        }
    };

    if (initialHref) {
        const link = createLink();
        link.id = 'shell-route-style';
        link.rel = 'stylesheet';
        link.setAttribute('href', initialHref);
        doc.head.appendChild(link);
    }

    return doc;
}

assert.equal(getShellRouteStyleHref('about'), null);
for (const route of ['bonuses', 'cards', 'smith', 'tools']) {
    const href = new URL(getShellRouteStyleHref(route), 'https://example.test');
    assert.equal(href.pathname, `/${route}/style.css`);
    assert.ok(href.searchParams.get('v'), `${route} stylesheet should have a cache version`);
}

const cardsHref = getShellRouteStyleHref('cards');
const bonusesHref = getShellRouteStyleHref('bonuses');

{
    const doc = createFakeDocument();
    const link = syncShellRouteStyles('cards', doc);
    assert.equal(link?.getAttribute('href'), cardsHref);
    assert.equal(doc.head.children.length, 1);
}

{
    const doc = createFakeDocument(cardsHref);
    const existing = doc.getElementById('shell-route-style');
    const link = syncShellRouteStyles('cards', doc);
    assert.equal(link, existing);
    assert.equal(doc.head.children.length, 1);
}

{
    const doc = createFakeDocument(cardsHref);
    const existing = doc.getElementById('shell-route-style');
    const link = syncShellRouteStyles('bonuses', doc);
    assert.equal(link, existing);
    assert.equal(link.getAttribute('href'), bonusesHref);
    assert.equal(doc.head.children.length, 1);
}

{
    const doc = createFakeDocument(cardsHref);
    syncShellRouteStyles('about', doc);
    assert.equal(doc.getElementById('shell-route-style'), null);
    assert.equal(doc.head.children.length, 0);
}

console.log('shell/loading/routeStyles.test.mjs passed');
