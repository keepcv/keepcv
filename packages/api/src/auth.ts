import type { Uuid } from "@keepcv/schema";

// A route handler never sees a credential: it gets an owner from ambient scope
// and cannot ask for a different one.
export type Authenticate = (request: Request) => Promise<Uuid | undefined>;

export const SESSION_TOKEN_HEADER = "x-keepcv-session";
export const SESSION_COOKIE = "keepcv.session";

// How a deployment decides who is asking. Implemented by whatever serves this,
// never by `createApi`.
export const AUTH_MODES = ["token", "password", "proxy"] as const;
export type AuthMode = (typeof AUTH_MODES)[number];

// The body of `GET /auth/mode`, which takes no credential: the app has to know
// what to render before it has anything to authenticate with.
export interface AuthState {
  mode: AuthMode;
  signedIn: boolean;
}

export function isAuthMode(value: unknown): value is AuthMode {
  return AUTH_MODES.some((mode) => mode === value);
}

// Constant time: a plain comparison returns on the first wrong byte, which
// makes the token guessable one character at a time.
function equalsConstantTime(presented: Uint8Array, expected: Uint8Array): boolean {
  let mismatch = presented.length ^ expected.length;
  for (let index = 0; index < presented.length; index += 1) {
    mismatch |= (presented[index] ?? 0) ^ (expected[index % expected.length] ?? 0);
  }
  return mismatch === 0;
}

export function sessionTokenAuth(token: string, ownerId: Uuid): Authenticate {
  if (token.length === 0) {
    throw new Error("a session token cannot be empty");
  }
  const expected = new TextEncoder().encode(token);

  return (request) => {
    const presented = request.headers.get(SESSION_TOKEN_HEADER);
    if (presented === null) {
      return Promise.resolve(undefined);
    }
    const matches = equalsConstantTime(new TextEncoder().encode(presented), expected);
    return Promise.resolve(matches ? ownerId : undefined);
  };
}
