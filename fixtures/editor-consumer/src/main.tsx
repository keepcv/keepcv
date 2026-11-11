import { createClient } from "@keepcv/api";
import { Editor, type HostAction } from "@keepcv/editor";
import favicon from "@keepcv/editor/favicon.svg?url";
import { QueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "@keepcv/editor/style.css";

const api = createClient(window.location.origin);
const link = document.createElement("link");
link.rel = "icon";
link.href = favicon;
document.head.append(link);
const account: HostAction = { id: "account", label: "Account settings", href: "/account.html" };
function HostedEditor() {
  const [notice, setNotice] = useState(false);
  const [connection, setConnection] = useState(() => ({
    owner: "synthetic-owner-a",
    queries: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  }));
  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column" }}>
      <header style={{ padding: "0.5rem" }}>
        <button type="button" onClick={() => setNotice(!notice)}>
          Toggle host notice
        </button>
        <button
          type="button"
          onClick={() => {
            connection.queries.clear();
            setConnection({
              owner:
                connection.owner === "synthetic-owner-a"
                  ? "synthetic-owner-b"
                  : "synthetic-owner-a",
              queries: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
            });
          }}
        >
          Switch synthetic connection
        </button>
      </header>
      {notice ? (
        <aside style={{ padding: "1rem" }}>
          A host notice can grow and shrink above the editor. The editor fills the remaining area.
        </aside>
      ) : null}
      <div style={{ flex: 1, minHeight: 0 }}>
        <Editor
          key={connection.owner}
          api={api}
          queries={connection.queries}
          sizing="container"
          recoveryNamespace={connection.owner}
          hostActions={[account]}
          recoveryActions={(failure) =>
            failure.problem?.status === 401
              ? [{ id: "signin", label: "Sign in again", href: "/sign-in.html" }]
              : [{ id: "help", label: "Contact support", href: "/help.html" }]
          }
        />
      </div>
    </div>
  );
}
const root = document.getElementById("root");
if (root === null) throw new Error("Missing editor root");
createRoot(root).render(<HostedEditor />);
