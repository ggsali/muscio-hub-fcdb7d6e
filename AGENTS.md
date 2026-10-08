# Architecture rules
- Public website visibility uses the `_site` route context and React context backed by a public read-only server function, so SSR, metadata and browser content share one setting without per-component reads.
- Shared public copy and structured-data filtering lives in `src/lib/resin-content.ts`, so every content renderer applies the same visibility rules without editing stored content.
- AI manifests and the sitemap are bundled source assets served by server routes, so disabled offerings cannot remain exposed through static public files; the sitemap generator writes only to the bundled source.
- Existing AI chat functions keep visibility state local to each request, so concurrent visitors cannot influence one another's material availability.