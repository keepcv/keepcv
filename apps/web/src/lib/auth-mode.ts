import { type AuthState, isAuthMode } from "@keepcv/api";

// A build served by something that has no `/auth` at all is a build in token
// mode: that is what every launcher before these modes existed answers.
const ASSUMED: AuthState = { mode: "token", signedIn: false };

export async function discoverAuth(): Promise<AuthState> {
  const body = await fetch("/auth/mode")
    .then(async (response): Promise<unknown> => (response.ok ? await response.json() : undefined))
    .catch(() => undefined);

  if (typeof body !== "object" || body === null) return ASSUMED;
  const { mode, signedIn } = body as { mode?: unknown; signedIn?: unknown };
  return isAuthMode(mode) ? { mode, signedIn: signedIn === true } : ASSUMED;
}

export async function signIn(password: string): Promise<string | undefined> {
  const response = await fetch("/auth/sign-in", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (response.ok) return undefined;

  const body: unknown = await response.json().catch(() => undefined);
  const said = (body as { error?: unknown } | undefined)?.error;
  return typeof said === "string" ? said : "The store could not be reached.";
}

export async function signOut(): Promise<void> {
  await fetch("/auth/sign-out", { method: "POST" });
}
