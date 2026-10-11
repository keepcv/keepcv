import type { RichText } from "@keepcv/schema";
import { Fragment } from "react";

export function RichBody({ body }: { body: RichText }) {
  return body.map((node, index) => {
    if (node.t === "text") return <Fragment key={index}>{node.v}</Fragment>;
    const children = <RichBody body={node.c} />;
    if (node.t === "b") return <strong key={index}>{children}</strong>;
    if (node.t === "i") return <em key={index}>{children}</em>;
    return (
      <a key={index} href={node.href} target="_blank" rel="noreferrer" className="underline">
        {children}
      </a>
    );
  });
}
