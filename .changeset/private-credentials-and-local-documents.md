---
"@keepcv/api": patch
"@keepcv/cli": patch
"@keepcv/db": patch
"@keepcv/interop": patch
"@keepcv/render": patch
"@keepcv/schema": patch
"@keepcv/templates": patch
"@keepcv/web": patch
---

Revoke running password sessions when credentials change, bound concurrent
sign-in attempts and request bodies, and keep private API responses out of caches.
Protect launcher data and native backups with private filesystem permissions.

Reject fetching CSS in new designs after decoding escapes, preserve older CSS
in native archives, and omit unsafe CSS when rendering with a warning. Exported
HTML and site files carry a Content Security Policy.

Bound DOCX inflation and browser source files, move Word extraction to a
cancellable worker, and update dependencies with security fixes.
