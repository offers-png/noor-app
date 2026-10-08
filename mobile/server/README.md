# Content proxy

This Node server holds Quran Foundation and Sunnah.com credentials. It returns upstream content to this app without returning OAuth tokens or credential strings. The mobile application never receives the QF client secret or Sunnah API key. Offline QF content is obtained only through Content Sync, never saved from ordinary verse endpoints.

Requires Node 22+ (built-in fetch and AbortSignal.timeout). From mobile/server:

```powershell
Copy-Item .env.example .env
# Fill QF_CLIENT_ID, QF_CLIENT_SECRET and/or SUNNAH_API_KEY in this server .env.
node --env-file=.env proxy.mjs
```

The default listener is http://127.0.0.1:8787. The same handler is deployed by `netlify/functions/content.mjs` at `/content/*` on the existing Netlify site. No actual credentials are committed. The app's mobile/.env contains only public connection configuration:

```dotenv
EXPO_PUBLIC_CONTENT_PROXY_URL=https://your-content-server.example
EXPO_PUBLIC_QF_ENV=production
```

Parent Mode → Content downloads → Content server connection can save or replace the public HTTPS URL and production/prelive environment without rebuilding the app. Saved settings take precedence over public build defaults. Checking `/health` verifies reachability and reports whether credentials are present; it does **not** prove OAuth authorization or successful live sync. Network consent is required for checks and downloads; local content remains usable when it is disabled.

For Netlify, configure `QF_CLIENT_ID`, `QF_CLIENT_SECRET`, and `QF_ENV=production` as **Functions-scoped server environment variables** and redeploy. Request approved credentials from Quran Foundation; do not enter them in a child screen, public Expo variable or connection URL. The current test APK connects to the PR #6 HTTPS deploy preview. The preview's `/health` and a real sync request confirmed that QF credentials were absent (HTTP 503); live QF integration remains unverified. After merging/deploying, parents can replace the preview URL with the production site's `/content` URL and check it.

Use production credentials and QF_ENV=production for the full canonical Quran singleton quran_core:1. Prelive credentials are useful for API development, but its limited two-surah dataset does not satisfy the complete canonical core contract and is rejected by the sync integrity check. The mobile environment must match the server environment; tokens, filters, snapshots and caches are kept separate by environment.

For Android emulator development, the host machine is normally reachable at http://10.0.2.2:8787. For a physical device use your host's local address and bind HOST=0.0.0.0 only on a trusted development network. Release connections must use HTTPS (configure a reverse proxy/platform TLS endpoint). The application does not contain cleartext network permission overrides for release builds.

Browser requests must use an exact origin in ALLOWED_ORIGINS (comma separated; default http://localhost:8081). Native mobile requests normally omit Origin and are allowed. Requests are limited to known read-only API routes, protected against arbitrary upstream URLs, and limited to 120 requests per minute per remote IP. OAuth access tokens are server-memory-only, reused before expiry, refreshed once after an upstream 401, and never logged. Upstream calls time out after 30 seconds. Configure your deployment platform's authentication, request limits and trusted proxy settings for public production traffic; the default listener is intended for local development and is not an authentication service.

Routes:

- GET /health reports environment and credential availability, without revealing values.
- GET /api/quran?environment=production&path=<URL-encoded relative /api/v4/... path> forwards supported Content API reads, sync pages and snapshots. The server fixes the upstream host from QF_ENV; callers cannot choose an upstream host.
- GET /api/hadith/collections forwards official Sunnah.com collection metadata.
- GET /api/hadith/:collection/:number forwards official Sunnah.com Arabic/English source text and grades unchanged.
- GET /api/resources/tanzil-arabic returns the original Tanzil Uthmani 1.1 download bytes.
- GET /api/resources/tanzil-transliteration returns the original English transliteration download bytes. This edition is noncommercial; the client requires confirmation before downloading and installing it.

Hosted routes use the same paths prefixed with `/content`. Publisher routes allow only these two fixed official URLs, bound the response to 3 MiB, and never rewrite publisher text. The app verifies byte hash, size, all 114 chapter counts, 6,236 ordered ayah references and the retained notice before atomic installation. It rejects changed, incomplete or damaged editions; publisher updates require source verification and a new edition hash. These independently licensed downloads do not require QF credentials and do not prove QF integration works.

Large JSON responses can use gzip when requested. The local Node server does not have Netlify's function payload cap. Oversized QF snapshots need a host capable of returning them; do not truncate data or advertise complete QF downloads when a host rejects the response. Credentialed deployment must verify the actual production core snapshot and selected resources end to end.

Parent Mode controls optional network access. Quran text, translations, words, tafsir and recitation metadata sync by published resource ID. Sync follows every returned cursor unchanged, applies snapshots/mutations, then commits all changes and the final next_sync_token in one SQLite transaction. Failed downloads retain the previous valid content and checkpoint. Canonical core snapshots must contain all 114 surahs and 6,236 ayahs. Synced translation/tafsir/recitation metadata retain publisher attribution from the corresponding resource listing. Caches refresh at least every seven days when parent-enabled connectivity permits and on restored connectivity. Recitation audio files are downloaded separately only after the parent checks reliable source byte sizes and confirms the download.

The five seeded surahs, their licensed ClearQuran translation, and 29 publisher-permitted Alafasy clips are bundled separately and work without this proxy. See src/content/fixtures/quran-SOURCES.md for text/audio rights, attribution, source URLs and integrity checksums. Adding provider credentials is required only for further provider content; server responses are never fabricated when credentials are absent.
