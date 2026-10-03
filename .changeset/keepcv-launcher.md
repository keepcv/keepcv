---
"keepcv": minor
---

Add the launcher. `serve` opens the store, runs pending migrations and serves
the API and the web app on one origin, with the launch token in the URL
fragment; `render`, `status`, `backup`, `restore` and `set-password` round it
out. `--auth token`, `--auth password` and `--auth proxy` all answer one owner,
and binding off loopback refuses `token`. The built web app ships inside the
package, so an install carries its own interface.
