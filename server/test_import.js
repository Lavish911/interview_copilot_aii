import * as pdfNamespace from 'pdf-parse';
import pdfDefault from 'pdf-parse';

console.log("Namespace:", Object.keys(pdfNamespace));
console.log("Default:", pdfDefault);
console.log("Default type:", typeof pdfDefault);
if (pdfDefault && pdfDefault.default) {
    console.log("Default.default:", pdfDefault.default);
}
