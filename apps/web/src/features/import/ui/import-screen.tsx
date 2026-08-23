import type { IntakeReview } from "@keepcv/core";
import { matchIntake, suggestedDecisions } from "@keepcv/core";
import type { Intake, IntakeChoice, IntakeDecisions, Store } from "@keepcv/schema";
import { useState } from "react";
import { Failure } from "../../../app/states.js";
import { Icon } from "../../../components/icon/icon.js";
import { Button } from "../../../components/ui/button.js";
import { PageBody, PageHeader } from "../../../components/ui/page.js";
import { Panel, PanelBody, PanelHeader } from "../../../components/ui/panel.js";
import type { ApiClient } from "../../../lib/api.js";
import { useApplyIntake } from "../api/use-intake.js";
import { readFile, UnreadableFileError } from "../model/read-file.js";
import { ChoiceRow, IdentityRow } from "./rows.js";

interface Chosen {
  intake: Intake;
  decisions: IntakeDecisions;
}

function replace(choices: IntakeChoice[], at: number, choice: IntakeChoice): IntakeChoice[] {
  return choices.map((each, index) => (index === at ? choice : each));
}

function detailOf(match: IntakeReview["records"][number]): string {
  const fresh = match.points.filter((point) => point.duplicateOf === undefined).length;
  const already = match.points.length - fresh;

  return [
    match.incoming.kind.replace("_", " "),
    // A custom entry has no organisation, and the heading it lands under is the
    // only thing telling two untitled ones apart.
    match.incoming.kind === "custom_entry"
      ? match.incoming.sectionHeading
      : match.incoming.organisationName,
    fresh === 0 ? null : `${String(fresh)} point${fresh === 1 ? "" : "s"}`,
    already === 0 ? null : `${String(already)} already here`,
  ]
    .filter((part) => part !== null)
    .join(" - ");
}

function Found({
  store,
  chosen,
  onChange,
}: {
  store: Store;
  chosen: Chosen;
  onChange: (decisions: IntakeDecisions) => void;
}) {
  const { intake, decisions } = chosen;
  const review = matchIntake(store, intake);

  return (
    <div className="space-y-5">
      {intake.fidelity === "declared" ? null : (
        <Panel>
          <PanelBody className="flex gap-2.5">
            <Icon name="warning" size="sm" className="mt-0.5 shrink-0 text-caution-text" />
            <p className="text-sm text-text-muted">
              A {intake.source === "pdf" ? "PDF" : "Word document"} says how a resume looked, not
              what each part of it was. Everything below was worked out from the layout, so read it
              before you bring it in - titles, employers and dates are the ones to check.
            </p>
          </PanelBody>
        </Panel>
      )}

      {review.identity.length === 0 && review.summary === undefined ? null : (
        <Panel>
          <PanelHeader title="You">
            An import fills what the profile has nowhere to show. It never writes over something you
            typed.
          </PanelHeader>
          <PanelBody className="divide-y divide-line">
            {review.identity.map((match) => (
              <IdentityRow
                key={match.field}
                match={match}
                taken={decisions.identity.includes(match.field)}
                onToggle={(taken) => {
                  onChange({
                    ...decisions,
                    identity: taken
                      ? [...decisions.identity, match.field]
                      : decisions.identity.filter((field) => field !== match.field),
                  });
                }}
              />
            ))}
            {review.summary === undefined ? null : (
              <IdentityRow
                match={{ field: "summary", ...review.summary }}
                taken={decisions.summary}
                onToggle={(summary) => {
                  onChange({ ...decisions, summary });
                }}
              />
            )}
          </PanelBody>
        </Panel>
      )}

      {review.organisations.length === 0 ? null : (
        <Panel>
          <PanelHeader title="Organisations">
            Where the work was done. One named in three places is one row here.
          </PanelHeader>
          <PanelBody className="divide-y divide-line">
            {review.organisations.map((match, index) => (
              <ChoiceRow
                key={match.incoming.name}
                title={match.incoming.name}
                detail={match.incoming.kind}
                existing={match.existing?.name}
                choice={decisions.organisations[index]}
                mergeInto={match.existing?.id}
                onChoose={(choice) => {
                  onChange({
                    ...decisions,
                    organisations: replace(decisions.organisations, index, choice),
                  });
                }}
              />
            ))}
          </PanelBody>
        </Panel>
      )}

      {review.contactChannels.length === 0 ? null : (
        <Panel>
          <PanelHeader title="Ways to reach you">
            These become the header of every resume this store compiles.
          </PanelHeader>
          <PanelBody className="divide-y divide-line">
            {review.contactChannels.map((match, index) => (
              <ChoiceRow
                key={`${match.incoming.kind}:${match.incoming.value}`}
                title={match.incoming.value}
                detail={match.incoming.label ?? match.incoming.kind}
                existing={match.existing === undefined ? undefined : "already here"}
                choice={decisions.contactChannels[index]}
                onChoose={(choice) => {
                  onChange({
                    ...decisions,
                    contactChannels: replace(decisions.contactChannels, index, choice),
                  });
                }}
              />
            ))}
          </PanelBody>
        </Panel>
      )}

      <Panel>
        <PanelHeader title={`Records (${String(review.records.length)})`}>
          Merging adds what the file had and leaves the record you already have alone.
        </PanelHeader>
        <PanelBody className="divide-y divide-line">
          {review.records.length === 0 ? (
            <p className="py-2 text-sm text-text-muted">The file held nothing to file.</p>
          ) : (
            review.records.map((match, index) => (
              <ChoiceRow
                key={`${match.incoming.kind}:${match.incoming.title ?? ""}:${String(index)}`}
                title={match.incoming.title ?? "Untitled"}
                detail={detailOf(match)}
                existing={match.existing === undefined ? undefined : "a record like this"}
                choice={decisions.records[index]}
                mergeInto={match.existing?.id}
                onChoose={(choice) => {
                  onChange({ ...decisions, records: replace(decisions.records, index, choice) });
                }}
              />
            ))
          )}
        </PanelBody>
      </Panel>

      {intake.notes.length === 0 ? null : (
        <Panel>
          <PanelHeader title="What did not come across">
            Named rather than guessed at. Nothing here was invented to fill a gap.
          </PanelHeader>
          <PanelBody>
            <ul className="space-y-1.5">
              {intake.notes.map((note) => (
                <li key={note} className="flex gap-2 text-sm text-text-muted">
                  <Icon name="warning" size="sm" className="mt-0.5 shrink-0 text-caution-text" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </PanelBody>
        </Panel>
      )}
    </div>
  );
}

function Chooser({ onRead }: { onRead: (intake: Intake) => void }) {
  const [unreadable, setUnreadable] = useState<string | undefined>(undefined);

  return (
    <Panel>
      <PanelHeader title="Choose a file">
        A PDF, a Word document, or a resume written by JSON Resume, Reactive Resume or RenderCV. It
        is read in this tab and never uploaded; what reaches the store is what you approve below.
      </PanelHeader>
      <PanelBody className="space-y-2">
        {unreadable === undefined ? null : (
          <p className="text-sm text-critical-text">{unreadable}</p>
        )}
        <input
          type="file"
          accept=".json,.yaml,.yml,.pdf,.docx,application/json,application/pdf"
          aria-label="A resume to read"
          className="block w-full text-sm text-text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-1.5 file:text-sm file:text-on-brand"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file === undefined) return;
            setUnreadable(undefined);
            void readFile(file).then(onRead, (error: unknown) => {
              setUnreadable(
                error instanceof UnreadableFileError
                  ? error.message
                  : `${file.name} is not a resume this build can read.`,
              );
            });
          }}
        />
      </PanelBody>
    </Panel>
  );
}

export function ImportScreen({ store, client }: { store: Store; client: ApiClient }) {
  const [chosen, setChosen] = useState<Chosen | undefined>(undefined);
  const apply = useApplyIntake(client);

  return (
    <PageBody>
      <PageHeader title="Bring a resume in" icon="upload">
        Everything a file holds arrives as records and points you own, not as a resume. A PDF has no
        structure in it, so what a reader works out from one is a guess worth checking. Nothing is
        written until you say so.
      </PageHeader>

      {apply.data === undefined ? null : (
        <Panel>
          <PanelHeader title="Done">
            {`${String(apply.data.records)} records, ${String(apply.data.points)} points and ${String(apply.data.organisations)} organisations came in.`}
          </PanelHeader>
        </Panel>
      )}

      {chosen === undefined ? (
        <Chooser
          onRead={(intake) => {
            apply.reset();
            setChosen({ intake, decisions: suggestedDecisions(matchIntake(store, intake)) });
          }}
        />
      ) : (
        <>
          {apply.error === null ? null : <Failure error={apply.error} />}
          <Found
            store={store}
            chosen={chosen}
            onChange={(decisions) => {
              setChosen({ ...chosen, decisions });
            }}
          />
          <div className="flex gap-2">
            <Button
              tone="primary"
              disabled={apply.isPending}
              onClick={() => {
                apply.mutate(chosen, {
                  onSuccess: () => {
                    setChosen(undefined);
                  },
                });
              }}
            >
              {apply.isPending ? "Writing" : "Bring these in"}
            </Button>
            <Button
              onClick={() => {
                setChosen(undefined);
              }}
            >
              Choose a different file
            </Button>
          </div>
        </>
      )}
    </PageBody>
  );
}
