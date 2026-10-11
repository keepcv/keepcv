import { createClient } from "@keepcv/api";
import { Editor } from "@keepcv/editor";
import { QueryClient } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import "@keepcv/editor/style.css";

const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const api = createClient(window.location.origin);
const root = document.getElementById("root");
if (root === null) throw new Error("Missing editor root");
createRoot(root).render(<Editor api={api} queries={queries} signOut={() => queries.clear()} />);
