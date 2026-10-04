# Security

KeepCV stores personal career history, contact details and private evidence.
The launcher authenticates every store request and serves the app and API on
one origin.

## Reporting a vulnerability

Please report privately through
[GitHub Security Advisories](https://github.com/keepcv/keepcv/security/advisories/new),
not as a public issue. Include the affected version, reproduction and impact.

Anything that could lose, alter or silently expose content is treated as the
highest severity. We will acknowledge the report and keep you informed.

## Launcher request boundary

The default `npx @keepcv/cli serve` binds to `127.0.0.1:4319`.
`--port` changes the port. Token mode refuses a network bind.

- A random per-launch token travels in the launch URL fragment and is required
  in `x-keepcv-session` for protected API routes. The fragment is not sent to
  the HTTP server. The public OpenAPI document and app assets contain no token.
- Host must name a loopback address on the listening port. If Origin is present,
  it must be that exact origin. Foreign and null Origins and arbitrary hostnames
  are refused before any route runs, including sign-in.
- The launcher sets no CORS permission headers.
- The app's CSP permits local scripts and connections, with no remote origins.
  It refuses inline scripts, objects, base URL overrides and external framing.
  Inline styles are allowed for rendered templates and geometry; local blob
  workers/frames and data images/fonts support parsing and export.
- Responses carry `X-Content-Type-Options: nosniff` and
  `Referrer-Policy: no-referrer`.
- The app has no telemetry, update checks, remote fonts or CDN assets. Resume
  files are self-contained. User-followed links navigate to their destinations.

Tests exercise the actual HTTP boundary, same-origin requests, authentication,
foreign Origin and rebinding Host rejection, and the response policy.

## Network deployments

Password and trusted-proxy modes support network access. Declare
`--origin http[s]://host[:port]` using the address opened in the browser;
it is required for a non-loopback bind. The proxy must preserve the public Host.
Host and browser Origin must match that configuration. Forwarded headers do not
override it.

Password sessions are signed, HttpOnly, SameSite=Strict cookies lasting thirty
days. Setting a password rotates the signing secret and ends existing sessions.
HTTPS origins also set Secure; terminate HTTPS at the reverse proxy because the
launcher itself serves HTTP. Running launchers read current credentials on every
request, so password changes revoke existing cookies without a restart. Sign-in
reserves one of five attempts before reading a request body, and verification
uses asynchronous scrypt. The body is limited to 8 KiB and ten seconds; passwords
are limited to 1024 characters. Protected API responses are not cacheable.

Proxy identity headers are accepted only from the configured `--proxy-from`
socket address. `--proxy-user` can restrict the one identity value permitted.
All modes answer the same single owner.

## Data handling

- Normal removal archives content. Phrasing revisions and resume versions are
  immutable. Reapplying a wording moves the current pointer without rewriting
  its old revisions.
- Export is never gated by account, licence or entitlement state. A browser
  history-write failure does not prevent a download.
- Private evidence is absent from the rendering document's type, and is included
  in native backups so the store round-trips without losing it.
- Launcher directories and backup files enforce private filesystem access:
  `0700` directories and `0600` files on POSIX; the current user, SYSTEM and
  Administrators on Windows. Backup replacement preserves this protection, and
  an unchanged mirror repairs its access too.
- New design CSS permits known local constructs and data URLs only, with escape
  decoding. Older designs retain their saved CSS in native archives; rendering
  omits unsafe CSS and reports that omission. Exported HTML/site files include
  their own CSP to block automatic remote resources and scripts.
- Browser resume imports have a 16 MiB source limit. DOCX extraction checks
  actual expanded XML against a default 4 MiB budget and runs in a cancellable
  worker with a thirty-second deadline.
- Unacknowledged wording and settings edits have browser-local recovery copies.
  Successful server saves remove the copies they acknowledged. Wording recovery
  is offered explicitly on reopen. A browser profile therefore holds pending
  content as well as the launcher data directory; clearing browser storage
  removes those recovery copies, not saved store data.

## Supported versions

KeepCV is in early development. Only the latest release is supported.

The development dependency `braces` has a local pnpm patch that bounds parser
and AST-walker depth at 128 levels. The registry advisory still reports version
3.0.3 because its upstream patched release is not published. Regression tests
exercise the installed patch; it is not suppressed from dependency audit output.
