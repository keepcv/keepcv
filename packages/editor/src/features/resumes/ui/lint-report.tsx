import type { LintSeverity, LintTier } from "@keepcv/ats-lint";
import { lint } from "@keepcv/ats-lint";
import { renderHtml } from "@keepcv/render";
import type { ResumeDocument } from "@keepcv/schema";
import { useMemo } from "react";

const VERDICT: Record<LintTier, { tone: string; says: string }> = {
  clean: {
    tone: "text-positive-text",
    says: "Nothing here trips a reader that pulls the text back out.",
  },
  readable: { tone: "text-caution-text", says: "Readable, with something worth knowing." },
  "at-risk": {
    tone: "text-critical-text",
    says: "Something here does not survive being read by a machine.",
  },
};

// Named rather than shown only as a colour, so the severity is in the text a
// screen reader reaches.
const SEVERITY: Record<LintSeverity, { label: string; tone: string }> = {
  blocker: { label: "Will break", tone: "text-critical-text" },
  warning: { label: "Worth knowing", tone: "text-caution-text" },
};

// The heading and the box come from the group this sits in.
export function LintPanel({ document }: { document: ResumeDocument }) {
  const report = useMemo(() => lint({ document, html: renderHtml(document) }), [document]);
  const verdict = VERDICT[report.tier];

  return (
    <div className="space-y-2">
      <p className={`text-xs ${verdict.tone}`}>{verdict.says}</p>

      {report.findings.length === 0 ? null : (
        <ul className="space-y-1.5 text-xs leading-relaxed text-text-muted">
          {report.findings.map((finding) => (
            <li key={`${finding.rule}-${finding.where}`}>
              <span className={SEVERITY[finding.severity].tone}>
                {SEVERITY[finding.severity].label}
              </span>{" "}
              <span className="font-medium text-text-muted">{finding.where}</span> {finding.detail}
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-text-subtle">
        Observations about this file, not a claim of compatibility with any product.
      </p>
    </div>
  );
}
