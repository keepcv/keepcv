import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { agentConfigSchema } from "@keepcv/agent";
import { AUTH_MODES } from "@keepcv/api";
import { z } from "zod";
import { writePrivateFile } from "./private-file.js";
import { publicOrigin } from "./request-policy.js";

export const launcherConfigSchema = z
  .object({
    port: z.number().int().min(1).max(65535).optional(),
    host: z.string().trim().min(1).optional(),
    origin: z.string().transform(publicOrigin).optional(),
    auth: z.enum(AUTH_MODES).optional(),
    "proxy-header": z.string().trim().min(1).optional(),
    "proxy-from": z.string().trim().min(1).optional(),
    "proxy-user": z.string().trim().min(1).optional(),
    agent: agentConfigSchema.optional(),
    openRouterApiKey: z.string().min(1).optional(),
  })
  .strict();

export type LauncherConfig = z.infer<typeof launcherConfigSchema>;

export const ENV_OPTIONS = {
  "data-dir": "KEEPCV_DATA_DIR",
  port: "KEEPCV_PORT",
  host: "KEEPCV_HOST",
  origin: "KEEPCV_ORIGIN",
  auth: "KEEPCV_AUTH",
  "agent-config": "KEEPCV_AGENT_CONFIG",
  "proxy-header": "KEEPCV_PROXY_HEADER",
  "proxy-from": "KEEPCV_PROXY_FROM",
  "proxy-user": "KEEPCV_PROXY_USER",
  format: "KEEPCV_FORMAT",
  out: "KEEPCV_OUT",
  from: "KEEPCV_FROM",
} as const;

export function environmentOptions(environment: NodeJS.ProcessEnv = process.env) {
  const values: Partial<Record<keyof typeof ENV_OPTIONS, string>> = {};
  for (const option of Object.keys(ENV_OPTIONS) as (keyof typeof ENV_OPTIONS)[]) {
    const value = environment[ENV_OPTIONS[option]];
    if (value !== undefined && value.trim() !== "") values[option] = value;
  }
  return values;
}

export function configPath(dataDir: string): string {
  return join(dataDir, "config.json");
}

export async function readConfig(dataDir: string): Promise<LauncherConfig> {
  let body: string;
  try {
    body = await readFile(configPath(dataDir), "utf8");
  } catch (reason) {
    if (reason instanceof Error && "code" in reason && reason.code === "ENOENT") return {};
    throw new Error(`Cannot read ${configPath(dataDir)}. Check its permissions.`);
  }
  try {
    return launcherConfigSchema.parse(JSON.parse(body));
  } catch {
    throw new Error(
      `Invalid configuration at ${configPath(dataDir)}. Check its format and values.`,
    );
  }
}

export async function writeConfig(dataDir: string, config: LauncherConfig): Promise<void> {
  await writePrivateFile(
    configPath(dataDir),
    `${JSON.stringify(launcherConfigSchema.parse(config), null, 2)}\n`,
  );
}
