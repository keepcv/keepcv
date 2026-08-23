import type { DocumentEntry, DocumentField, RichText } from "@keepcv/schema";
import { Fragment, type ReactElement } from "react";

export function Marks({ nodes }: { nodes: RichText }): ReactElement {
  return (
    <>
      {nodes.map((node, index) => {
        const key = String(index);
        if (node.t === "text") return <Fragment key={key}>{node.v}</Fragment>;
        if (node.t === "b")
          return (
            <strong key={key}>
              <Marks nodes={node.c} />
            </strong>
          );
        if (node.t === "i")
          return (
            <em key={key}>
              <Marks nodes={node.c} />
            </em>
          );
        return (
          <a key={key} href={node.href}>
            <Marks nodes={node.c} />
          </a>
        );
      })}
    </>
  );
}

export function joined(parts: (string | undefined)[]): string {
  return parts.filter((part) => part !== undefined && part !== "").join(" - ");
}

// A field prints its label and a real colon, and a URL prints as its address:
// an extractor reading the page as text gets "Credential ID: AWS-1234" and a
// link whose text is a word loses the address entirely.
export function Field({ field }: { field: DocumentField }): ReactElement {
  return (
    <li data-field={field.key}>
      <span className="kc-label">{field.label}: </span>
      {field.kind === "url" ? <a href={field.value}>{field.value}</a> : field.value}
    </li>
  );
}

export function Fields({ entry }: { entry: DocumentEntry }): ReactElement | null {
  if (entry.fields.length === 0) return null;
  return (
    <ul className="kc-fields">
      {entry.fields.map((field) => (
        <Field key={field.key} field={field} />
      ))}
    </ul>
  );
}

export function Points({ entry }: { entry: DocumentEntry }): ReactElement | null {
  if (entry.points.length === 0) return null;
  return (
    <ul className="kc-points">
      {entry.points.map((point) => (
        <li key={point.key} data-key={point.key}>
          <Marks nodes={point.text} />
          {point.metrics.map((metric) => (
            <span className="kc-metrics" key={metric.key} data-key={metric.key}>
              {` (${metric.label}: ${metric.display})`}
            </span>
          ))}
        </li>
      ))}
    </ul>
  );
}

export function Links({ entry }: { entry: DocumentEntry }): ReactElement | null {
  if (entry.links.length === 0) return null;
  return (
    <p className="kc-links">
      {entry.links.map((link, index) => (
        <Fragment key={link.key}>
          {index === 0 ? null : "  |  "}
          <a href={link.url} data-key={link.key}>
            {link.url}
          </a>
        </Fragment>
      ))}
    </p>
  );
}
