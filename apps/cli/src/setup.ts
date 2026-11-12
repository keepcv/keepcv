import * as p from "@clack/prompts";
import { readAuth, writePassword } from "./auth.js";
import { configPath, type LauncherConfig, readConfig, writeConfig } from "./config.js";
import { publicOrigin } from "./request-policy.js";
import { DEFAULT_HOST, DEFAULT_PORT, isLoopback } from "./serve.js";

class Cancelled extends Error {}

async function answer<T>(pending: Promise<T>): Promise<Exclude<T, symbol>> {
  const value = await pending;
  if (p.isCancel(value)) throw new Cancelled();
  return value as Exclude<T, symbol>;
}

const required = (value: string | undefined): string | undefined =>
  value?.trim() ? undefined : "Enter a value.";

async function text(message: string, initialValue?: string): Promise<string> {
  return (
    await answer(
      p.text({
        message,
        ...(initialValue === undefined ? {} : { initialValue }),
        validate: required,
      }),
    )
  ).trim();
}

async function confirm(message: string, initialValue = false): Promise<boolean> {
  return await answer(p.confirm({ message, initialValue }));
}

export async function setup(dataDir: string): Promise<number> {
  if (process.stdin.isTTY !== true || process.stdout.isTTY !== true) {
    throw new Error(
      "Setup needs an interactive terminal. Use serve flags or a config.json file for automation.",
    );
  }
  p.intro("KeepCV setup");
  try {
    const config = await readConfig(dataDir);
    p.note(
      `Settings: ${configPath(dataDir)}\nSkip a section to keep its current settings. Ctrl+C cancels before saving.`,
    );
    await configureServer(config);
    const password = await configureAuth(config, dataDir);
    await configureOrigin(config);
    await configureAI(config);
    if (!(await confirm("Save these settings?", true))) throw new Cancelled();
    if (password !== undefined) await writePassword(dataDir, password);
    await writeConfig(dataDir, config);
    p.outro(
      "Saved. Run keepcv serve with the same --data-dir to start. Restart a running server to apply settings.",
    );
    return 0;
  } catch (reason) {
    if (!(reason instanceof Cancelled)) throw reason;
    p.cancel("Setup cancelled. Nothing was changed.");
    return 1;
  }
}

async function configureServer(config: LauncherConfig): Promise<void> {
  if (await confirm("Configure server address and port?")) {
    config.host = await text("Listen address", config.host ?? DEFAULT_HOST);
    config.port = Number(
      await answer(
        p.text({
          message: "Port",
          initialValue: String(config.port ?? DEFAULT_PORT),
          validate: (value) => {
            const port = Number(value);
            return Number.isInteger(port) && port >= 1 && port <= 65535
              ? undefined
              : "Use a port from 1 to 65535.";
          },
        }),
      ),
    );
  }
}

async function configureAuth(config: LauncherConfig, dataDir: string): Promise<string | undefined> {
  let password: string | undefined;
  if (await confirm("Configure sign-in?")) {
    config.auth = await answer(
      p.select({
        message: "Sign-in mode",
        initialValue: config.auth ?? "token",
        options: [
          { value: "token" as const, label: "Launch token (local machine only)" },
          { value: "password" as const, label: "Password" },
          { value: "proxy" as const, label: "Trusted reverse proxy" },
        ],
      }),
    );
    if (
      config.auth === "password" &&
      ((await readAuth(dataDir)) === undefined || (await confirm("Replace the existing password?")))
    ) {
      password = await answer(
        p.password({
          message: "New password",
          validate: (value) =>
            value !== undefined && value.length >= 8 && value.length <= 1024
              ? undefined
              : "Use 8 to 1024 characters.",
        }),
      );
      await answer(
        p.password({
          message: "Confirm password",
          validate: (value) => (value === password ? undefined : "Passwords must match."),
        }),
      );
    }
    if (config.auth === "proxy") {
      config["proxy-header"] = await text("User header set by your proxy", config["proxy-header"]);
      config["proxy-from"] = await text(
        "Trusted proxy address",
        config["proxy-from"] ?? DEFAULT_HOST,
      );
      config["proxy-user"] = await text("Allowed user value", config["proxy-user"]);
    }
  }
  return password;
}

async function configureOrigin(config: LauncherConfig): Promise<void> {
  if (!isLoopback(config.host ?? DEFAULT_HOST) && (config.auth ?? "token") === "token") {
    throw new Error(
      "Off-loopback access requires password or proxy sign-in. Run setup again and configure sign-in.",
    );
  }
  if (config.auth !== undefined && config.auth !== "token") {
    if (config.origin !== undefined && !(await confirm("Change the public origin?"))) return;
    config.origin = await answer(
      p.text({
        message: "Public origin (the URL you will open)",
        initialValue: config.origin ?? `http://localhost:${String(config.port ?? DEFAULT_PORT)}`,
        validate: (value) => {
          try {
            publicOrigin(value ?? "");
            return undefined;
          } catch {
            return "Enter an HTTP(S) origin without a path, query or fragment.";
          }
        },
      }),
    );
  } else {
    delete config.origin;
  }
}

async function configureAI(config: LauncherConfig): Promise<void> {
  if (await confirm("Configure AI chat with OpenRouter?")) {
    if (
      await confirm("Enable AI chat? Career data used in chat is sent to the configured providers.")
    ) {
      p.note(
        "Choose exact model IDs and approved provider slugs from https://openrouter.ai/models.\nQualify tool support and data policy before use. Web search and attachments stay off.",
      );
      const model = await text("OpenRouter model ID", config.agent?.routes[0]?.model);
      const providers = (
        await text(
          "Approved provider slugs (comma separated)",
          config.agent?.routes[0]?.providers.join(", "),
        )
      )
        .split(",")
        .map((provider) => provider.trim())
        .filter(Boolean);
      if (providers.length === 0) throw new Error("Enter at least one approved provider slug.");
      const key = await answer(
        p.password({
          message: "OpenRouter API key (blank uses OPENROUTER_API_KEY from the environment)",
        }),
      );
      config.agent = {
        routes: [{ model, providers, apiKeyEnv: "OPENROUTER_API_KEY", images: false, pdf: false }],
        deadlineMs: 90000,
        nativeSearchPolicyConfirmed: false,
      };
      delete config.openRouterApiKey;
      if (key.trim()) config.openRouterApiKey = key.trim();
    } else {
      delete config.agent;
      delete config.openRouterApiKey;
    }
  }
}
