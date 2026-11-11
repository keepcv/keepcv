---
"@keepcv/cli": patch
---

Serve .mjs module workers as JavaScript so PDF import works with the launcher's
nosniff policy. Validate the MIME type and bytes of every installed worker in
release smoke tests without broadening content security policy.
