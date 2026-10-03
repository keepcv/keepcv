---
"@keepcv/api": minor
---

Add the HTTP boundary: `createApi` over the repository port, the owned
collections and the nested routes hanging off them, the boot payload, native
export and import, intake, resume compilation and the version timeline, RFC
9457 `problem+json` errors, a generated OpenAPI document and a typed client.
`createApi` takes the port, an owner scope and an `authenticate` function, and
knows nothing about a driver or a port number.
