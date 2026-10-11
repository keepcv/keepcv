import { Link } from "@tanstack/react-router";
import { Icon } from "../icon/icon.js";

export function ContentGuide() {
  return (
    <details className="group/guide rounded-lg border border-line bg-surface px-4 py-3 text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-text-muted hover:text-text">
        <Icon name="info" size="sm" />
        How your content fits
        <Icon
          name="chevronDown"
          size="sm"
          className="ml-auto transition-transform group-open/guide:rotate-180"
        />
      </summary>
      <div className="mt-3 space-y-3 text-text-muted">
        <p>Start with a record, add points, then choose them for a resume.</p>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-surface-sunken p-3">
            <dt className="font-medium text-text">
              <Link
                to="/records"
                search={{ archived: "exclude" }}
                className="underline-offset-2 hover:underline"
              >
                Record
              </Link>
            </dt>
            <dd>A job, project, or qualification. For example, Engineer at Cedar.</dd>
          </div>
          <div className="rounded-lg bg-surface-sunken p-3">
            <dt className="font-medium text-text">
              <Link
                to="/points"
                search={{ filter: "all" }}
                className="underline-offset-2 hover:underline"
              >
                Point
              </Link>
            </dt>
            <dd>One statement about your work. For example, Reduced response time by 35%.</dd>
          </div>
          <div className="rounded-lg bg-surface-sunken p-3">
            <dt className="font-medium text-text">Wording</dt>
            <dd>
              A way to say a point or summary. Choose a point's wording for each resume. Summaries
              use their default wording.
            </dd>
          </div>
          <div className="rounded-lg bg-surface-sunken p-3">
            <dt className="font-medium text-text">
              <Link
                to="/resumes"
                search={{ archived: "exclude" }}
                className="underline-offset-2 hover:underline"
              >
                Resume
              </Link>
            </dt>
            <dd>
              Selected records and points, grouped into sections and styled with a{" "}
              <Link
                to="/templates"
                search={{ archived: "exclude" }}
                className="underline underline-offset-2"
              >
                template
              </Link>
              .
            </dd>
          </div>
        </dl>
        <p className="text-xs">
          Removing content from a resume keeps it in your career store. Editing its wording updates
          resumes using that wording; saved versions keep their past text.
        </p>
      </div>
    </details>
  );
}
