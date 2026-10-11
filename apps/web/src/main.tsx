import { type AuthMode, createClient } from "@keepcv/api";
import { Editor } from "@keepcv/editor";
import { QueryClient } from "@tanstack/react-query";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { SignIn } from "./features/auth/ui/sign-in.js";
import { Landing } from "./features/landing/ui/landing.js";
import { discoverAuth, signOut } from "./lib/auth-mode.js";
import { claimSessionToken } from "./lib/session.js";
import "@keepcv/editor/style.css";

const queries = new QueryClient({
  defaultOptions: {
    // A 401 is a credential problem that retrying identically will not fix.
    queries: { retry: false, refetchOnWindowFocus: false },
  },
});

function App({ token, canSignOut }: { token: string | undefined; canSignOut: boolean }) {
  const [api] = useState(() =>
    createClient(window.location.origin, token === undefined ? {} : { sessionToken: token }),
  );
  const [onSignOut] = useState(() =>
    canSignOut
      ? () => {
          void signOut().then(() => window.location.assign("/"));
        }
      : undefined,
  );
  return <Editor api={api} queries={queries} signOut={onSignOut} />;
}

// Every route under the router would only render the same 401, so nothing that
// is not signed in mounts it at all.
function Boot({ mode, signedIn, token }: { mode: AuthMode; signedIn: boolean; token?: string }) {
  const [inside, setInside] = useState(signedIn);

  if (inside) return <App token={token} canSignOut={mode === "password"} />;
  if (mode === "token") return <Landing />;
  return (
    <SignIn
      mode={mode}
      onSignedIn={() => {
        setInside(true);
      }}
    />
  );
}

const root = document.getElementById("root");
if (root === null) throw new Error("index.html has no #root to mount into");

// Before the first render rather than in an effect: which of the three screens
// belongs here is not something to decide twice.
const state = await discoverAuth();
const token =
  state.mode === "token" ? claimSessionToken(window.location, window.sessionStorage) : undefined;

createRoot(root).render(
  <StrictMode>
    <Boot
      mode={state.mode}
      signedIn={state.mode === "token" ? token !== undefined : state.signedIn}
      {...(token === undefined ? {} : { token })}
    />
  </StrictMode>,
);
