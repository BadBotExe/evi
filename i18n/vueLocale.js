import { shallowRef } from 'vue';
import { hasDisplayLabel, onLocaleChange, translateLabel } from './locale.js?v=0ca2bbd58a';

const expressionPattern = /\{\{([\s\S]*?)\}\}/g;
const displayAttributes = ['aria-label', 'placeholder', 'title', 'alt'];

function expression(value) {
    const escaped = value.replaceAll('\\', '\\\\').replaceAll("'", "\\'").replaceAll('\n', '\\n')
        .replaceAll('{', '\\u007b').replaceAll('}', '\\u007d');
    return `'${escaped}'`;
}

function localizeText(node) {
    const text = node.data.trim().replace(/\s+/g, ' ');
    const args = [...text.matchAll(expressionPattern)];
    const pattern = text.replace(expressionPattern, (_, _value, offset) => {
        return `{${args.findIndex(match => match.index === offset)}}`;
    });
    if (hasDisplayLabel(pattern)) {
        const values = args.map(match => `(${match[1]})`).join(', ');
        node.data = node.data.replace(/\S[\s\S]*\S|\S/, () => `{{ $label(${expression(pattern)}, [${values}]) }}`);
    } else if (args.length) {
        node.data = node.data.replace(expressionPattern, (_, value) => `{{ $label((${value})) }}`);
    }
}

function localizeNodes(root) {
    for (const node of root.childNodes) {
        if (node.nodeType === 3) {
            localizeText(node);
        } else if (node.nodeType === 1 && !node.hasAttribute('v-pre')) {
            for (const attr of displayAttributes) {
                if (node.hasAttribute(`:${attr}`)) {
                    node.setAttribute(`:${attr}`, `$label((${node.getAttribute(`:${attr}`)}))`);
                } else if (hasDisplayLabel(node.getAttribute(attr))) {
                    node.setAttribute(`:${attr}`, `$label(${expression(node.getAttribute(attr))})`);
                    node.removeAttribute(attr);
                }
            }
            localizeNodes(node.content ?? node);
        }
    }
}

export function localizeComponents(components) {
    if (typeof document === 'undefined') return components;
    return Object.fromEntries(Object.entries(components).map(([name, component]) => {
        if (typeof component.template !== 'string') return [name, component];
        const template = document.createElement('template');
        if (!template.content) return [name, component];
        // HTML parsing lowercases directive names such as :viewBox inside SVG.
        const graphics = [];
        template.innerHTML = component.template.replace(/<svg\b[\s\S]*?<\/svg>/gi, svg => {
            const index = graphics.push(svg) - 1;
            return `<!--i18n-svg:${index}-->`;
        });
        localizeNodes(template.content);
        return [name, {
            ...component,
            template: template.innerHTML.replace(/<!--i18n-svg:(\d+)-->/g, (_, index) => graphics[index]),
            components: localizeComponents(component.components ?? {})
        }];
    }));
}

export function installVueLocale(app, root) {
    const properties = app.config.globalProperties;
    if (typeof properties.$label !== 'function') {
        const revision = shallowRef(0);
        const unsubscribe = onLocaleChange(() => { revision.value += 1; });
        app.onUnmount?.(unsubscribe);
        properties.$label = (value, values) => {
            revision.value;
            return translateLabel(value, values);
        };
    }
    if (root?.childNodes) localizeNodes(root);
    return app;
}
