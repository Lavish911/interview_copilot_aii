import { createRequire } from "module";
const require = createRequire(import.meta.url);

try {
    const pdf = require("pdf-parse");
    console.log("Type:", typeof pdf);
    console.log("Keys:", Object.keys(pdf));
    // Try to see if default exists
    if (pdf.default) console.log("Has default export");
} catch (e) {
    console.error("Failed:", e);
}
