import type { Store, Uuid } from "@keepcv/schema";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Failure } from "../../../app/states.js";
import { Button } from "../../../components/ui/button.js";
import { Panel, PanelBody, PanelHeader } from "../../../components/ui/panel.js";
import type { ApiClient } from "../../../lib/api.js";
import { counted } from "../../../lib/label.js";
import { useApplyRoleProfile } from "../api/use-role-profiles.js";
import { roleProfileRows } from "../model/role-profile-rows.js";

// What it would place is answered by the same selector the profiles screen
// reads, so the number beside a name is the number the resume gets.
export function ApplyRoleProfile({
  store,
  client,
  resumeId,
}: {
  store: Store;
  client: ApiClient;
  resumeId: Uuid;
}) {
  const applied = useApplyRoleProfile(client);
  const [chosen, setChosen] = useState("");

  const rows = roleProfileRows(store, false);
  const picked = rows.find((row) => row.profile.id === chosen);

  return (
    <Panel>
      <PanelHeader title="Apply a role profile">
        It places what the words select and takes nothing off, so nothing you have already put on
        this resume is disturbed.
      </PanelHeader>
      <PanelBody className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-text-muted">
            No role profiles yet.{" "}
            <Link
              to="/role-profiles"
              search={{ archived: false }}
              className="underline underline-offset-2"
            >
              Name one
            </Link>{" "}
            and it is offered here.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Role profile to apply"
              value={chosen}
              onChange={(event) => {
                setChosen(event.target.value);
              }}
              className="min-w-0 max-w-full flex-1 rounded-lg border border-line px-2 py-1 text-sm text-text-muted"
            >
              <option value="">Choose a role profile</option>
              {rows.map((row) => (
                <option key={row.profile.id} value={row.profile.id}>
                  {row.profile.name} - {counted(row.records, "record", "records")},{" "}
                  {counted(row.points, "point", "points")}
                </option>
              ))}
            </select>
            <Button
              tone="primary"
              disabled={picked === undefined || applied.isPending}
              onClick={() => {
                if (picked === undefined) return;
                applied.mutate({ roleProfileId: picked.profile.id, resumeId });
                setChosen("");
              }}
            >
              Apply
            </Button>
          </div>
        )}

        {picked === undefined || picked.tags.length > 0 ? null : (
          <p className="text-xs text-text-subtle">
            {picked.profile.name} has no words in it yet, so it would place nothing.
          </p>
        )}

        {applied.data === undefined ? null : (
          <p className="text-sm text-text-muted">
            {applied.data.entries === 0 && applied.data.points === 0
              ? "Everything it selects was already on this resume."
              : `Placed ${counted(applied.data.entries, "record", "records")} and ${counted(
                  applied.data.points,
                  "point",
                  "points",
                )}.`}
          </p>
        )}
        {applied.error === null ? null : <Failure error={applied.error} />}
      </PanelBody>
    </Panel>
  );
}
