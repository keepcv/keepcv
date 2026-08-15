import type { Uuid } from "@keepcv/schema";

// Local mode mints one token per launch; hosted mode resolves a session instead.
// Either way a route handler never sees a credential - it gets an owner from
// ambient scope and cannot ask for a different one (api-contract.md #2).
export type Authenticate = (request: Request) => Promise<Uuid | undefined>;

export const SESSION_TOKEN_HEADER = "x-keepcv-session";

// Constant time: a plain comparison returns on the first wrong byte, which turns
// the token into something guessable one character at a time.
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
