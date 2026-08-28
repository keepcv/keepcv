import type { ResumeDocument } from "@keepcv/schema";

export const LINT_RULES = [
  "contact-extractable",
  "section-headings",
  "date-format",
  "undated-history",
  "reading-order",
  "text-as-image",
  "hidden-text",
  "page-furniture",
] as const;

export type LintRuleId = (typeof LINT_RULES)[number];

export type LintSeverity = "blocker" | "warning";

export type LintTier = "clean" | "readable" | "at-risk";

export interface LintIssue {
  severity: LintSeverity;
  where: string;
  detail: string;
}

export interface LintFinding extends LintIssue {
  rule: LintRuleId;
}

export interface LintReport {
  tier: LintTier;
  findings: readonly LintFinding[];
}

// Both, because half the checks are about what the resume says and half are
// about what the file the template produced does with it.
export interface LintInput {
  document: ResumeDocument;
  html: string;
}

export interface LintRule {
  id: LintRuleId;
  check: (input: LintInput) => readonly LintIssue[];
}

// A tier is the absence of findings, never a claim about a named product.
export function tierFor(findings: readonly LintFinding[]): LintTier {
  if (findings.some((finding) => finding.severity === "blocker")) return "at-risk";
  return findings.length === 0 ? "clean" : "readable";
}
