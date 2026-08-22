import { live } from "@keepcv/core";
import type { Store } from "@keepcv/schema";
import { useState } from "react";
import { Failure } from "../../../app/states.js";
import { Button } from "../../../components/ui/button.js";
import { Panel, PanelBody, PanelHeader } from "../../../components/ui/panel.js";
import type { ApiClient } from "../../../lib/api.js";
import { saveFile } from "../../../lib/files.js";
import { useLoadBackup, useReadBackup } from "../api/use-backup.js";

const JSON_TYPE = "application/json;charset=utf-8";

function fileName(at: string): string {
  return `keepcv-${at.slice(0, 10)}.json`;
}

// Counted rather than described: "everything" is what every backup screen says,
// and it is the sentence nobody believes until the numbers are beside it.
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

function TakeACopy({ client, store }: { client: ApiClient; store: Store }) {
  const read = useReadBackup(client);
  const held = holdings(store);

  return (
    <Panel>
      <PanelHeader title="Take a copy">
        Every row this store holds, archived ones and superseded wordings included. Never gated by
        anything.
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
        <p className="text-xs leading-relaxed text-slate-500">
          {held === "" ? "There is nothing in the store yet." : `Currently ${held}.`} The launcher
          also keeps a copy of this beside the store on disk, and writes it again when it stops.
        </p>
      </PanelBody>
    </Panel>
  );
}

// Into an empty store only, which is the store's rule rather than this screen's:
// merging two career histories needs a review step in front of it.
function PutOneBack({ client, store }: { client: ApiClient; store: Store }) {
  const load = useLoadBackup(client);
  const [unreadable, setUnreadable] = useState<string | undefined>(undefined);

  const isEmpty =
    store.records.length === 0 && store.points.length === 0 && store.resumes.length === 0;

  return (
    <Panel>
      <PanelHeader title="Put one back">
        All or nothing, and only into a store nothing has been written to yet.
      </PanelHeader>
      <PanelBody className="space-y-2">
        {load.error === null ? null : <Failure error={load.error} />}
        {unreadable === undefined ? null : <p className="text-sm text-red-700">{unreadable}</p>}

        <input
          type="file"
          accept="application/json,.json"
          aria-label="A backup file to load"
          className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-sm file:text-white"
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
          <p className="text-sm text-slate-700">Loaded. Everything below reads from it now.</p>
        ) : (
          <p className="text-xs leading-relaxed text-slate-500">
            {isEmpty
              ? "This store is empty, so a backup will load straight into it."
              : "This store already holds something, so a load will be refused. Run the launcher against an empty --data-dir to read a backup into."}
          </p>
        )}
      </PanelBody>
    </Panel>
  );
}

export function DataScreen({ store, client }: { store: Store; client: ApiClient }) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Your data</h1>
        <p className="max-w-xl text-xs text-slate-500">
          The store is a file on your machine. Nothing here asks anything of a network you did not
          start yourself.
        </p>
      </div>

      <TakeACopy client={client} store={store} />
      <PutOneBack client={client} store={store} />

      <Panel>
        <PanelHeader title="From a terminal">
          The same two things, without a browser open.
        </PanelHeader>
        <PanelBody>
          <pre className="overflow-x-auto rounded-lg bg-slate-900 px-3 py-2 text-xs leading-relaxed text-slate-100">
            {
              "keepcv backup --out my-store.json\nkeepcv restore --from my-store.json --data-dir ./fresh"
            }
          </pre>
        </PanelBody>
      </Panel>
    </div>
  );
}
