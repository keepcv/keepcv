import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { buildRouter } from "./app/router.js";
import { Landing } from "./features/landing/ui/landing.js";
import { apiClient } from "./lib/api.js";
import { claimSessionToken } from "./lib/session.js";
import "./styles/app.css";

const queries = new QueryClient({
  defaultOptions: {
    // A 401 is a token problem that retrying identically will not fix.
    queries: { retry: false, refetchOnWindowFocus: false },
  },
});

const token = claimSessionToken(window.location, window.sessionStorage);

const root = document.getElementById("root");
if (root === null) throw new Error("index.html has no #root to mount into");

// No token means no store to ask about, so the router never mounts: every route
// under it would only render the same 401. A token that is present and refused
// is a different case, and the app's own failure state says what to do about it.
createRoot(root).render(
  token === undefined ? (
    <StrictMode>
      <Landing />
    </StrictMode>
  ) : (
    <StrictMode>
      <QueryClientProvider client={queries}>
        <RouterProvider router={buildRouter({ queries, api: apiClient(token) })} />
      </QueryClientProvider>
    </StrictMode>
  ),
);
