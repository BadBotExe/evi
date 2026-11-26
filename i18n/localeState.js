// Keep the active language shared when locale.js is imported with different URL versions.
export const localeState = {
    current: 'en',
    listeners: new Set()
};
