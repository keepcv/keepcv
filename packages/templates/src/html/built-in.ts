import { folioDefinition } from "./samples/folio.js";
import { signalDefinition } from "./samples/signal.js";
import { studioDefinition } from "./samples/studio.js";
import { fromHtmlDefinition } from "./template.js";

export const HTML_TEMPLATES = [
  fromHtmlDefinition("studio-html-v1", "Studio", studioDefinition),
  fromHtmlDefinition("folio-html-v1", "Folio", folioDefinition),
  fromHtmlDefinition("signal-html-v1", "Signal", signalDefinition),
];
