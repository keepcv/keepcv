import type { Store, StoredTemplate, TemplateSpec } from "@keepcv/schema";
import { extraCssSchema } from "@keepcv/schema";
import type { TemplateConfig } from "@keepcv/templates";
import { DESIGN_KNOBS, FIXTURE_DOCUMENT, fromSpec } from "@keepcv/templates";
import { useEffect, useState } from "react";
import { Empty } from "../../../app/states.js";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { TextAreaField, TextField } from "../../../components/ui/field.js";
import { PageHeader } from "../../../components/ui/page.js";
import { Panel, PanelBody, PanelHeader } from "../../../components/ui/panel.js";
import type { ApiClient } from "../../../lib/api.js";
import { counted } from "../../../lib/label.js";
import { TemplateFrame } from "../../resumes/ui/template-frame.js";
import { useUpdateTemplate } from "../api/use-templates.js";
import { designFile, designFileName } from "../model/design-file.js";
import { templateRows } from "../model/template-rows.js";
import { Control } from "./control.js";

// Long enough that dragging a slider is one write rather than forty. Each one
// carries the row's `updatedAt`, and a burst would race its own answers.
const SETTLES_AFTER = 500;

// A design leaves as a file the templates screen reads back: the store holds it
// so it round-trips through the export, and this is what makes one shareable.
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
  const [name, setName] = useState(template.name);
  const [pending, setPending] = useState<TemplateSpec | null>(null);
  const spec = pending ?? template.spec;
  const built = fromSpec(template.id, name, spec);
  const design: TemplateConfig = built.defaultConfig;
  const cssProblem = extraCssSchema.safeParse(spec.extraCss).error?.issues[0]?.message;
  const { mutate } = update;
  const usedBy = store.resumes.filter(
    (resume) => resume.templateId === template.id && resume.archivedAt === null,
  ).length;

  useEffect(() => {
    if (pending === null) return;
    const timer = setTimeout(() => {
      if (extraCssSchema.safeParse(pending.extraCss).success) {
        mutate({ template, patch: { spec: pending } });
        setPending(null);
      }
    }, SETTLES_AFTER);

    return () => {
      clearTimeout(timer);
    };
  }, [pending, template, mutate]);

  const change = (key: string, value: string | number) => {
    setPending({ ...spec, settings: { ...spec.settings, [key]: value } });
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

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
          <Panel>
            <PanelHeader title="What it is called" />
            <PanelBody className="space-y-3">
              <TextField label="Name" value={name} onChange={setName} />
              <Button
                icon="confirm"
                disabled={name.trim() === "" || name === template.name}
                onClick={() => {
                  mutate({ template, patch: { name: name.trim() } });
                }}
              >
                Rename it
              </Button>
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
                  setPending({ ...spec, extraCss });
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

  return <Editor store={store} client={client} template={template} />;
}
