# Architecture rules
- Public chat inserts validate session eligibility through a boolean security-definer helper, never public session SELECT; browser persistence checks insert errors without selecting private rows back.
- Public website visibility uses the `_site` route context and React context backed by a public read-only server function, so SSR, metadata and browser content share one setting without per-component reads.
- Every public website setting key must be listed in the anon SELECT policy allowlist on `website_settings`; a missing key returns no row instead of an error, so readers silently fall back to the default value.
- Shared public copy and structured-data filtering lives in `src/lib/resin-content.ts`, so every content renderer applies the same visibility rules without editing stored content.
- AI manifests and the sitemap are bundled source assets served by server routes, so disabled offerings cannot remain exposed through static public files; the sitemap generator writes only to the bundled source.
- Existing AI chat functions keep visibility state local to each request, so concurrent visitors cannot influence one another's material availability.- City-model (Stadtmodell) STL files are generated in the visitor's browser from swisstopo heights + OSM buildings and uploaded via a signed URL before checkout, so no external generator server is needed; pricing lives in `src/lib/stadtmodell.ts` and is recomputed server-side.

- Payments run through Payrexx only: server functions in  create gateways (referenceId ), and  trusts only the transaction re-fetched from the Payrexx API, so forged webhook bodies cannot mark anything paid.
