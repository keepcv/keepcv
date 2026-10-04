import type { Store, StoredTemplate, TemplateSpec } from "@keepcv/schema";
import { extraCssSchema, templateSpecSchema } from "@keepcv/schema";
import type { TemplateConfig } from "@keepcv/templates";
import { DESIGN_KNOBS, FIXTURE_DOCUMENT, fromSpec } from "@keepcv/templates";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { Empty, Failure } from "../../../app/states.js";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { TextAreaField, TextField } from "../../../components/ui/field.js";
import { PageHeader } from "../../../components/ui/page.js";
import { Panel, PanelBody, PanelHeader } from "../../../components/ui/panel.js";
import type { ApiClient } from "../../../lib/api.js";
import { counted } from "../../../lib/label.js";
import { SaveState } from "../../../lib/save-state.js";
import { STORE_KEY } from "../../../lib/store-cache.js";
import { useAutosave } from "../../../lib/use-autosave.js";
import { TemplateFrame } from "../../resumes/ui/template-frame.js";
import { useUpdateTemplate } from "../api/use-templates.js";
import { designFile, designFileName } from "../model/design-file.js";
import { templateRows } from "../model/template-rows.js";
import { Control } from "./control.js";

const validSpec = (spec: TemplateSpec) => extraCssSchema.safeParse(spec.extraCss).success;
const recoverableSpec = templateSpecSchema.extend({ extraCss: z.string() });
const readSpec = (value: unknown) => recoverableSpec.safeParse(value).data ?? null;

function DownloadDesign({ name, spec }: { name: string; spec: TemplateSpec }) {
  const href = URL.createObjectURL(designFile(name, spec));

  return (
    <Button
      icon="download"
      onClick={() => {
        const link = document.createElement("a");
        link.href = href;
        link.download = designFileName(name);
        link.click();
        URL.revokeObjectURL(href);
      }}
    >
      Save it as a file
    </Button>
  );
}

function Editor({
  store,
  client,
  template,
}: {
  store: Store;
  client: ApiClient;
  template: StoredTemplate;
}) {
  const update = useUpdateTemplate(client);
  const queries = useQueryClient();
  const [name, setName] = useState(template.name);
  const autosave = useAutosave(
    `keepcv.template-edit:${template.id}`,
    readSpec,
    async (spec: TemplateSpec) => {
      const current =
        queries.getQueryData<Store>(STORE_KEY)?.templates.find((row) => row.id === template.id) ??
        template;
      await update.mutateAsync({ template: current, patch: { spec } });
    },
    validSpec,
  );
  const spec = autosave.pending ?? template.spec;
  const built = fromSpec(template.id, name, spec);
  const design: TemplateConfig = built.defaultConfig;
  const cssProblem = extraCssSchema.safeParse(spec.extraCss).error?.issues[0]?.message;
  const { mutate } = update;
  const usedBy = store.resumes.filter(
    (resume) => resume.templateId === template.id && resume.archivedAt === null,
  ).length;

  const change = (key: string, value: string | number) => {
    autosave.change({ ...spec, settings: { ...spec.settings, [key]: value } });
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <PageHeader
        title={template.name}
        icon="template"
        trail={[{ label: "Templates", to: "/templates", search: { archived: "exclude" } }]}
        actions={<DownloadDesign name={name} spec={spec} />}
      >
        {usedBy === 0
          ? "On no resume yet."
          : `On ${counted(usedBy, "resume", "resumes")}. Editing changes what they print next time, not what a saved version says they printed.`}
      </PageHeader>
      <SaveState
        saving={autosave.saving}
        pending={autosave.pending !== null}
        error={autosave.error}
        retry={autosave.flush}
      />

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
          <Panel>
            <PanelHeader title="What it is called" />
            <PanelBody className="space-y-3">
              <TextField label="Name" value={name} onChange={setName} />
              <Button
                icon="confirm"
                disabled={
                  name.trim() === "" ||
                  name === template.name ||
                  update.isPending ||
                  autosave.pending !== null ||
                  autosave.saving
                }
                onClick={() => {
                  mutate({ template, patch: { name: name.trim() } });
                }}
              >
                Rename it
              </Button>
              {update.error === null || autosave.error !== null ? null : (
                <Failure error={update.error} />
              )}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="How it looks" />
            <PanelBody className="space-y-3">
              {DESIGN_KNOBS.map((field) => (
                <Control
                  key={field.key}
                  field={field}
                  config={design}
                  onChange={(value) => {
                    change(field.key, value);
                  }}
                />
              ))}
            </PanelBody>
          </Panel>

          <Panel>
            <PanelHeader title="CSS of your own" aside={<Badge tone="warning">Advanced</Badge>}>
              Added last, so it wins. It cannot fetch anything, and the resume's findings are read
              off the file this produces.
            </PanelHeader>
            <PanelBody className="space-y-2">
              <TextAreaField
                label="Extra CSS"
                rows={6}
                value={spec.extraCss}
                placeholder=".kc-name { letter-spacing: 0; }"
                onChange={(extraCss) => {
                  autosave.change({ ...spec, extraCss });
                }}
              />
              {cssProblem === undefined ? null : (
                <p className="text-xs text-caution-text">{cssProblem}</p>
              )}
            </PanelBody>
          </Panel>
        </div>

        <div className="min-h-0 overflow-y-auto">
          <div className="rounded-xl bg-paper p-4">
            <TemplateFrame title={`${name}, on an example resume`} styles={built.styles(design)}>
              {built.render(FIXTURE_DOCUMENT, design)}
            </TemplateFrame>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TemplateEditorScreen({
  store,
  client,
  templateId,
}: {
  store: Store;
  client: ApiClient;
  templateId: string;
}) {
  const template = templateRows(store, "include").find((row) => row.id === templateId)?.row;

  if (template === undefined) {
    return (
      <Empty title="No design with that id" spot="noResults">
        The shipped designs are not edited here, and every design of yours is on the templates list.
      </Empty>
    );
  }

  return <Editor key={template.id} store={store} client={client} template={template} />;
}
