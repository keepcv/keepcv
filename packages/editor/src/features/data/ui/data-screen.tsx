import { isEmptyStore, live } from "@keepcv/core";
import type { Store } from "@keepcv/schema";
import { useState } from "react";
import { Failure } from "../../../app/states.js";
import { Button } from "../../../components/ui/button.js";
import { PageBody, PageHeader } from "../../../components/ui/page.js";
import { Panel, PanelBody, PanelHeader } from "../../../components/ui/panel.js";
import type { ApiClient } from "../../../lib/api.js";
import { saveFile } from "../../../lib/files.js";
import { useLoadBackup, useReadBackup } from "../api/use-backup.js";
import { type DataPagePresentation, DEFAULT_DATA_PAGE } from "../model/presentation.js";

const JSON_TYPE = "application/json;charset=utf-8";

function fileName(at: string): string {
  return `keepcv-${at.slice(0, 10)}.json`;
}

function holdings(store: Store): string {
  const counts = [
    [live(store.records).length, "record"],
    [live(store.points).length, "point"],
    [live(store.resumes).length, "resume"],
  ] as const;
  return counts
    .filter(([count]) => count > 0)
    .map(([count, noun]) => `${String(count)} ${noun}${count === 1 ? "" : "s"}`)
    .join(", ");
}

function TakeACopy({
  client,
  store,
  presentation,
}: {
  client: ApiClient;
  store: Store;
  presentation: DataPagePresentation;
}) {
  const read = useReadBackup(client);
  const held = holdings(store);

  return (
    <Panel>
      <PanelHeader title="Download a backup">
        Includes archived content, every wording revision, and resume history.
      </PanelHeader>
      <PanelBody className="space-y-2">
        {read.error === null ? null : <Failure error={read.error} />}
        <Button
          tone="primary"
          disabled={read.isPending}
          onClick={() => {
            read.mutate(undefined, {
              onSuccess: (document) => {
                saveFile(
                  fileName(document.exportedAt),
                  JSON_TYPE,
                  `${JSON.stringify(document, null, 2)}\n`,
                );
              },
            });
          }}
        >
          {read.isPending ? "Reading" : "Download a backup"}
        </Button>
        <p className="text-xs leading-relaxed text-text-subtle">
          {held === "" ? "Just the profile so far." : `Currently ${held}.`}{" "}
          {presentation.backupDescription}
        </p>
      </PanelBody>
    </Panel>
  );
}

function PutOneBack({
  client,
  store,
  presentation,
}: {
  client: ApiClient;
  store: Store;
  presentation: DataPagePresentation;
}) {
  const load = useLoadBackup(client);
  const [unreadable, setUnreadable] = useState<string | undefined>(undefined);

  const isEmpty = isEmptyStore(store);

  return (
    <Panel>
      <PanelHeader title="Restore a backup">
        Restore is only available for an empty store.
      </PanelHeader>
      <PanelBody className="space-y-2">
        {load.error === null ? null : <Failure error={load.error} />}
        {unreadable === undefined ? null : (
          <p className="text-sm text-critical-text">{unreadable}</p>
        )}

        <input
          type="file"
          accept="application/json,.json"
          aria-label="A backup file to load"
          className="block w-full text-sm text-text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-sm file:text-on-brand"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file === undefined) return;
            setUnreadable(undefined);
            void file.text().then((body) => {
              try {
                load.mutate(JSON.parse(body));
              } catch {
                setUnreadable(`${file.name} is not JSON this build can read.`);
              }
            });
          }}
        />

        {load.isSuccess ? (
          <p className="text-sm text-text-muted">Loaded. Everything below reads from it now.</p>
        ) : (
          <p className="text-xs leading-relaxed text-text-subtle">
            {isEmpty
              ? "This store is empty, so a backup will load straight into it."
              : `This store already holds something, so a load will be refused. ${presentation.restoreDescription}`}
          </p>
        )}
      </PanelBody>
    </Panel>
  );
}

export function DataScreen({
  store,
  client,
  presentation = DEFAULT_DATA_PAGE,
}: {
  store: Store;
  client: ApiClient;
  presentation?: DataPagePresentation | undefined;
}) {
  return (
    <PageBody>
      <PageHeader title="Your data" icon="data">
        {presentation.storageDescription}
      </PageHeader>

      <TakeACopy client={client} store={store} presentation={presentation} />
      <PutOneBack client={client} store={store} presentation={presentation} />

      {presentation.showTerminalInstructions ? (
        <Panel collapsible>
          <PanelHeader title="From a terminal">Back up or restore with the launcher.</PanelHeader>
          <PanelBody>
            <pre className="overflow-x-auto rounded-lg border border-line bg-surface-sunken px-3 py-2 font-mono text-xs leading-relaxed text-text">
              {
                "keepcv backup --out my-store.json\nkeepcv restore --from my-store.json --data-dir ./fresh"
              }
            </pre>
          </PanelBody>
        </Panel>
      ) : null}
    </PageBody>
  );
}
