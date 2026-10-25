export class HtmlTemplateError extends Error {
  override readonly name = "HtmlTemplateError";
  readonly code: string;
  readonly file: string | undefined;
  readonly line: number | undefined;

  constructor(code: string, message: string, file?: string, line?: number) {
    super(
      `${file === undefined ? "" : `${file}${line === undefined ? "" : `:${String(line)}`}: `}${message}`,
    );
    this.code = code;
    this.file = file;
    this.line = line;
  }
}
