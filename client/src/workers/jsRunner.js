self.onmessage = (e) => {
    const logs = [];
    const fmt = (v) => {
        if (typeof v === 'string') return v;
        try {
            return JSON.stringify(v, (_, val) => typeof val === 'function' ? '[Function]' : val, 2);
        } catch {
            return String(v);
        }
    };
    const sandboxConsole = {
        log: (...a) => logs.push(a.map(fmt).join(' ')),
        info: (...a) => logs.push(a.map(fmt).join(' ')),
        warn: (...a) => logs.push('[warn] ' + a.map(fmt).join(' ')),
        error: (...a) => logs.push('[error] ' + a.map(fmt).join(' ')),
        table: (...a) => logs.push(a.map(fmt).join('\n')),
    };

    try {
        const fn = new Function('console', e.data.code);
        const result = fn(sandboxConsole);
        if (result !== undefined) logs.push('➜ ' + fmt(result));
        self.postMessage({ ok: true, logs });
    } catch (err) {
        logs.push('[error] ' + (err && err.stack ? err.stack.split('\n').slice(0, 3).join('\n') : String(err)));
        self.postMessage({ ok: false, logs });
    }
};
