async function test() {
    try {
        const mod = await import('pdf-parse');
        console.log("Module keys:", Object.keys(mod));
        console.log("Module default:", mod.default);
        if (mod.default) {
            console.log("Default keys:", Object.keys(mod.default));
        }
    } catch (e) {
        console.error("Import failed:", e);
    }
}
test();
