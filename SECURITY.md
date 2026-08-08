# Security

KeepCV stores a complete personal career history: employment, education,
contact details, and private evidence notes. That is sensitive personal data,
and the threat model is treated accordingly.

## Reporting a vulnerability

Please report privately through
[GitHub Security Advisories](https://github.com/keepcv/keepcv/security/advisories/new),
not as a public issue.

Please include what you can reproduce, the impact, and the affected version.
You will get an acknowledgement, and we will keep you informed until it is
resolved.

Anything that could **lose, alter, or silently expose a user's content** is
treated as the highest severity, regardless of how difficult it is to trigger.

## Local mode threat model

`npx keepcv` runs an HTTP server on your machine holding your entire career
store. Any web page open in the same browser can *send* requests to it — the
same-origin policy prevents reading the responses, but not the requests. DNS
rebinding can additionally defeat naive origin checks.

These controls exist because of that, and each one is tested:

1. **Binds to `127.0.0.1` only** — never `0.0.0.0`, never a LAN interface.
2. **Random ephemeral port per launch** — not a guessable fixed port.
3. **Per-launch session token**, required in a custom request header. Custom
   headers force a CORS preflight that a cross-origin page cannot satisfy,
   which defeats drive-by request forgery.
4. **Strict `Host` and `Origin` validation** — the DNS rebinding guard, and the
   control most often omitted.
5. **No CORS headers at all** — not a narrow allowlist. None.
6. **Strict Content-Security-Policy** with no remote origins permitted.
7. **Zero outbound network requests.** No telemetry, no update checks, no
   remote fonts, no CDN assets. This is enforced by a test that fails the build
   if any network call is attempted during the end-to-end suite.

If you find a way around any of these, that is a vulnerability — please report
it.

## Data handling

- Nothing you write is destroyed by a normal delete. Content is archived and
  restorable; genuine erasure is a separate, explicitly confirmed operation.
- Export is never gated by any account, licence or entitlement state.
- Private evidence notes are excluded from rendered output *structurally* —
  the rendering document type has no field that could carry them — rather than
  by a runtime filter that could be bypassed or forgotten.

## Supported versions

The project is in early development. Only the latest release is supported.
