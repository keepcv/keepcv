import { DOCUMENT_RULES } from "./document-rules.js";
import { OUTPUT_RULES } from "./output-rules.js";
import type { LintInput, LintReport, LintRule } from "./report.js";
import { tierFor } from "./report.js";

export const RULES: readonly LintRule[] = [...DOCUMENT_RULES, ...OUTPUT_RULES];

export function lint(input: LintInput): LintReport {
  const findings = RULES.flatMap((rule) =>
    rule.check(input).map((issue) => ({ rule: rule.id, ...issue })),
  );
  return { tier: tierFor(findings), findings };
}
