export function publicOrigin(value: string): string {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new Error("--origin must be an http or https origin, without a path or credentials.");
  }
  return url.origin;
}

export function acceptsRequest(
  request: Request,
  port: number,
  origin: string | undefined,
): boolean {
  const url = new URL(request.url);
  const authority = request.headers.get("host") ?? url.host;
  const allowed =
    origin === undefined
      ? ["127.0.0.1", "localhost", "[::1]"].map(
          (host) => new URL(`http://${host}:${String(port)}`).origin,
        )
      : [origin];
  const own = allowed.find((value) => new URL(value).host === authority.toLowerCase());
  if (own === undefined) return false;
  const from = request.headers.get("origin");
  return from === null || from === own;
}

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "frame-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");
