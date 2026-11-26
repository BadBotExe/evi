import { hasDisplayLabel, translateLabel } from './locale.js';

export function bindStaticLabels(root) {
    const updates = [];
    const walker = root.ownerDocument.createTreeWalker(root, 4);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const label = node.data.trim().replace(/\s+/g, ' ');
        if (hasDisplayLabel(label)) {
            const text = node;
            updates.push(() => { text.data = translateLabel(label); });
        }
    }
    for (const element of root.querySelectorAll('[aria-label], [title], [placeholder]')) {
        for (const attr of ['aria-label', 'title', 'placeholder']) {
            const label = element.getAttribute(attr);
            if (hasDisplayLabel(label)) updates.push(() => element.setAttribute(attr, translateLabel(label)));
        }
    }
    return () => updates.forEach(update => update());
}
