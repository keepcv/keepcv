import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { buildRouter } from "./app/router.js";
import { apiClient } from "./lib/api.js";
import { claimSessionToken } from "./lib/session.js";
import "./styles/app.css";

const queries = new QueryClient({
  defaultOptions: {
    // Nothing but this client writes to a local store, and a 401 is a token
    // problem that retrying identically will not fix.
    queries: { retry: false, refetchOnWindowFocus: false },
  },
});

const api = apiClient(claimSessionToken(window.location, window.sessionStorage));
const router = buildRouter({ queries, api });

const root = document.getElementById("root");
if (root === null) throw new Error("index.html has no #root to mount into");

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queries}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
