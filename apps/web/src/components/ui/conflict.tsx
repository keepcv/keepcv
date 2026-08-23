import type { Difference } from "../../lib/form.js";
import { Button } from "./button.js";
import { Panel, PanelBody, PanelHeader } from "./panel.js";

// Both sides of a stale write, named. Nothing is kept until one is chosen
// (application-structure.md #4).
export function Conflict({
  title,
  rows,
  onKeepTheirs,
  onKeepMine,
}: {
  title: string;
  rows: Difference[];
  onKeepTheirs: () => void;
  onKeepMine: () => void;
}) {
  return (
    <Panel className="border-caution/50 bg-caution-soft">
      <PanelHeader title={title} icon="warning">
        Nothing has been saved. Both versions are below.
      </PanelHeader>
      <PanelBody className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-caution-text">
            The change was to a field this form does not show.
          </p>
        ) : (
          <dl className="space-y-2 text-sm">
            {rows.map((row) => (
              <div key={row.label} className="grid gap-1 sm:grid-cols-3">
                <dt className="text-xs font-medium uppercase tracking-wide text-caution-text">
                  {row.label}
                </dt>
                <dd className="text-text">
                  <span className="text-xs text-text-subtle">yours: </span>
                  {row.mine}
                </dd>
                <dd className="text-text">
                  <span className="text-xs text-text-subtle">stored: </span>
                  {row.theirs}
                </dd>
              </div>
            ))}
          </dl>
        )}
        <div className="flex flex-wrap gap-2">
          <Button tone="primary" onClick={onKeepMine}>
            Save mine over it
          </Button>
          <Button onClick={onKeepTheirs}>Keep what is stored</Button>
        </div>
      </PanelBody>
    </Panel>
  );
}
