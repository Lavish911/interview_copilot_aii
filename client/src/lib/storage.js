export const STORAGE_KEYS = {
    mockHistory: 'ic.mockHistory',
    atsScore: 'ic.lastAtsScore',
    settings: 'ic.settings',
};

export function loadLocal(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
    } catch {
        return fallback;
    }
}

export function saveLocal(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Storage full or unavailable — fail silently
    }
}
