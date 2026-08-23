// The readers that need a parser. Kept off the package's main entry so a caller
// that only speaks JSON never loads a PDF engine.
export { docxLines, NotADocxError } from "./docx.js";
export { NotAPdfError, pdfLines } from "./pdf.js";
export { NotARenderCvError, parseRenderCv } from "./yaml.js";
