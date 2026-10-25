import type { TemplateSpec } from "@keepcv/schema";
import { KNOBS, type TemplateConfig } from "@keepcv/templates";
import { Panel, PanelBody, PanelHeader } from "../../../components/ui/panel.js";
import { Control } from "./control.js";

const GROUPS = [
  {
    title: "Page and spacing",
    hint: "Set the starting page size and breathing room. A resume can adjust these to fit.",
    keys: ["pageSize", "margin", "sectionGap"],
  },
  {
    title: "Typography and color",
    hint: "System fonts work offline. A custom accent takes priority over the preset.",
    keys: ["fontFamily", "fontSize", "lineHeight", "accent", "accentColor"],
  },
  {
    title: "Name and header",
    hint: "Style the name and contact area at the top of every resume.",
    keys: ["nameSize", "headerAlign", "headerRule"],
  },
  {
    title: "Section headings",
    hint: "Place headings above each section or in a narrow column beside it.",
    keys: [
      "headingPlace",
      "headingWidth",
      "headingSize",
      "headingCase",
      "headingAlign",
      "headingRule",
    ],
  },
  {
    title: "Entries and points",
    hint: "Choose where dates appear and how entries and points are spaced.",
    keys: ["entryMeta", "entryGap", "bullet", "pointGap"],
  },
];

const HINTS: Record<string, string> = {
  margin: "Applied equally to all four page edges, in millimeters.",
  fontFamily: "The preview uses the first installed font in the chosen system stack.",
  fontSize: "Starting body size. Individual resumes can adjust it.",
  lineHeight: "A multiple of the body size; higher values give lines more space.",
  nameSize: "A multiple of the body size.",
  headingSize: "A multiple of the body size.",
  headingWidth: "Only used when headings sit beside their sections.",
};

export function BuilderControls({
  config,
  spec,
  onChange,
}: {
  config: TemplateConfig;
  spec: TemplateSpec;
  onChange: (spec: TemplateSpec) => void;
}) {
  return GROUPS.map((group) => (
    <Panel key={group.title} collapsible defaultOpen={group.title === "Typography and color"}>
      <PanelHeader title={group.title}>{group.hint}</PanelHeader>
      <PanelBody className="space-y-4">
        {group.keys.map((key) => {
          const field = KNOBS.find((knob) => knob.key === key);
          if (field === undefined) return null;
          if (key === "headingWidth" && config["headingPlace"] !== "beside") return null;
          const hint = HINTS[key];
          return (
            <Control
              key={key}
              field={field}
              precise
              config={config}
              {...(hint === undefined ? {} : { hint })}
              onChange={(value) => {
                onChange({
                  ...spec,
                  settings: {
                    ...spec.settings,
                    [key]: value,
                    ...(key === "accent" && config["accentColor"] !== ""
                      ? { accentColor: "" }
                      : {}),
                  },
                });
              }}
            />
          );
        })}
      </PanelBody>
    </Panel>
  ));
}
