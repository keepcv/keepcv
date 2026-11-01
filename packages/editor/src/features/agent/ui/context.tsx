import { createContext, type ReactNode, useContext } from "react";
import type { ApiClient } from "../../../lib/api.js";
import { useAgentController } from "../api/use-agent.js";

const Context = createContext<ReturnType<typeof useAgentController> | null>(null);

export function AgentProvider({
  api,
  children,
  enabled = true,
}: {
  api: ApiClient;
  children: ReactNode;
  enabled?: boolean;
}) {
  const controller = useAgentController(api, enabled);
  return <Context.Provider value={controller}>{children}</Context.Provider>;
}
export function useAgent() {
  const agent = useContext(Context);
  if (agent === null) throw new Error("Missing assistant context");
  return agent;
}
