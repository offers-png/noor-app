# Mobile content delivery — Android 1.0.3 (4)

## What changed in 1.0.3

The screenshots that prompted this update ("Configure EXPO_PUBLIC_CONTENT_PROXY_URL", "Lessons awaiting review", "A licensed transliteration has not been downloaded", "A reviewed explanation is not available") come from the original 1.0.0 build. Those messages were removed in 1.0.1/1.0.2. Install a build made from this version to see the current behaviour.

| Feature | 1.0.3 behaviour | Status |
| --- | --- | --- |
| Content server | EAS `preview`/`production` builds default to `https://issa-uzair.netlify.app/content` (the production `content` function on `main`). Parents can still replace it. A saved address takes precedence, so a device that saved the old `deploy-preview-6` address should switch to this one. | Deployed function confirmed through the Netlify API. HTTP reachability not checked from the build environment (egress blocked). |
| Recitation for all 114 surahs | No Quran Foundation account needed. Parent picks a surah → **Check download size** (proxy returns the verified Al Quran Cloud `ar.alafasy` list; the app checks exact file sizes with HEAD or a one-byte range request) → **Confirm** → native download with free-space check, progress, cancellation, resume and size verification → reader plays from the device offline. Remove per surah. Lists refresh weekly. | Proxy → storage → size → transfer → reader tested in-process with real SQLite and the real proxy handler. **Live publisher/CDN and on-device download not verified.** |
| Quran Foundation audio, tafsir, translations | Unchanged pipeline, now grouped under "Quran Foundation resources (optional)". | Needs approved `QF_CLIENT_ID`/`QF_CLIENT_SECRET` on the server. **Not verified end to end.** |
| Tafsir for children | Labeled "Explanation (tafsir)", explained as different from translation, shown two paragraphs at a time without changing wording. | No credential-free authorized English tafsir exists (see below). |
| Duas and lessons | 9 new review-gated drafts: 4 Qur'anic duas (2:201, 17:24, 20:114, 25:74), Five prayers through the day, Getting ready to pray, Six things we believe in, Greeting with Salam, Kindness to parents. All ship `needs_review` and stay hidden in normal Kids Mode until a parent records a named qualified reviewer and publishes. | Tested. **Requires your qualified reviewer before children see them.** |
| Arabic | Numbers 1–10 module with quiz; five more simple words. | Tested. |

Qur'anic dua Arabic and transliteration are exact excerpts of the Tanzil files; a test compares them with the original publisher bytes. Their English line is an original **simple-meaning summary**, labeled "not a translation of the Qur'an", and is part of what the reviewer approves. The transliteration remains under Tanzil's noncommercial terms.

Recitation rights: [Al Quran Cloud terms](https://alquran.cloud/terms-and-conditions), section IV: recitations "may stream, embed and download them for personal and educational use", may be bundled into a commercial product, reciters keep copyright and may request removal. Section III asks clients to cache. The retained copy is `src/content/fixtures/quran-audio-license.html`.

---

## Previous release notes (1.0.2)

This update preserves the Expo Router/SQLite architecture, design, PIN controls, profiles, bookmarks, progress, and five existing offline surahs. No API secret is accepted or bundled in the mobile app.

## Implemented behavior

| Feature | Behavior and remaining prerequisite |
| --- | --- |
| Content connection | Shared existing Node proxy and Netlify `/content` function. Parent can save an HTTPS URL/environment and check the server. Health reports configuration only, never proof of live QF authorization. |
| Full offline Quran text | Parent downloads official Tanzil Arabic (1.1) and optional English transliteration, accepts the publisher requirements, then confirms installation. The importer verifies exact edition hashes/bytes, all 114 surahs/6,236 ordered ayahs, UTF-8, and notices. Missing-only Arabic fallback preserves the five existing source copies. |
| Quran audio | Five bundled surahs retain their 29 permitted Alafasy clips. Optional QF reciter catalog → Content Sync metadata → per-surah source size estimate → confirmation → native download. Free-space checks, byte progress, cancellation, timeouts, partial retry and actual file/size validation prevent broken caches from being advertised as offline. Live QF authorization and selected media remain credential-dependent. |
| Parent publication | 13 source-backed education drafts can be edited, assigned ages, reviewed, and published locally after parent-entered reviewer attestation plus explicit family suitability and source-use confirmations. Exact version/content fingerprint required. Edits or withdrawal revoke publication. No draft ships approved. |
| Tafsir | Separate English tafsir catalog and authorized Content Sync import, with author/language/coverage validation. Native paragraph/inline formatting and adjustable text preserve the publisher wording; read-together guidance supports children. Rowwad published meanings/notes and ordinary translations remain distinct. Live tafsir requires approved QF server credentials and a currently published authorized English source. |

## Reviewable content scope

Five Dua practice lessons; three Hadith teaching lessons; Five Pillars; six illustrated Wudu steps; nine introductory Salah steps; and source-referenced Nuh and Yunus story structures. The Salah material is guided prayer recognition/introduction, **not** a complete teaching sequence for rakah cycles, all recitations, or legal/school-specific details. All 13 religious teaching drafts require real review and family publication. Source libraries retain five Dua and three Hadith selections independently. Arabic includes 28 letters, five starter lessons, letter forms/joining, reading marks, simple words, tracing and quizzes, with age-based adult guidance.

The application records what the parent attests; it cannot authenticate reviewer qualifications or grant source rights. Unknown restricted content packs do not become publishable merely by checking a box. No religious explanation, verse, Hadith, or translation was generated for this update.

## Licensing and attribution

- [Tanzil Arabic text terms](https://tanzil.net/docs/Text_License): CC BY 3.0, verbatim text, named source/link and original copyright notice. Downloaded Uthmani 1.1: 1,370,878 bytes; SHA-256 `bf4f57b968d03f4131c070b1e285da9be0e0a108a21c910e872801ca273312c8`.
- [Tanzil transliteration terms](https://tanzil.net/trans/): **noncommercial use only**; other use requires translator/publisher permission. Edition September 6, 2010: 1,044,894 bytes; SHA-256 `8c20d95e484534e921cd2e0d2546aab7f5300090c0bd76697095b3ca1db1e01d`. The original markup and notice remain stored. Arabic text's license does not grant commercial transliteration rights.
- [Quran Foundation Content Sync/storage rules](https://api-docs.quran.foundation/docs/tutorials/faq/): obtain authorized offline copies through Content Sync, preserve attribution, apply updates at least every seven days when reachable, and promptly after restored connectivity. Unknown/unpublished resources and incomplete snapshots cannot be advertised as ready. Server credentials/permission are required.
- Existing QuranEnc Rowwad 1.0.19 meanings and notes retain their separate unchanged-text/publisher/version conditions. They are not silently substituted for tafsir. Existing Sunnah and bundled audio attributions remain intact; see the fixture source records.

Publisher files are retained verbatim and source metadata/consent are stored with installed editions. Changed publisher editions are rejected until their content/permissions are reverified. Parent About sources exposes notices; child screens have no external links or developer credential messages.

## Verification and live limits

On October 8, 2026, 113 mobile tests passed, along with ESLint and TypeScript. Coverage includes real SQLite persistence and isolation, immutable canonical text, full publisher imports, source byte identity, damaged/partial/changed editions, review/version/fingerprint/age gates, grouped tafsir coverage and safe markup, sync races and rollback, interrupted audio transfers, disk shortage, parent consent revocation during SQL writes, and removed/truncated local recordings. Injected provider/file-transfer tests are labeled as tests; they are not live Quran Foundation evidence.

The actual Node proxy and HTTPS Netlify PR #6 preview returned both full Tanzil files byte-for-byte identical to the publisher, with the hashes above. Hosted `/content/health` reported `quranConfigured:false`; an actual hosted QF recitation sync request returned **503** because server credentials were missing. **Quran Foundation live authentication, snapshots, optional audio download/playback, and English tafsir are not verified end to end.** They need approved server credentials and authorized published resources. Large real QF snapshots also need verification against the chosen host's payload limits; use the existing Node server on a suitable host when necessary.

Native APK build and installed acceptance results are recorded below when complete. Previous native acceptance does not prove the new download workflow.

## Parent setup

1. Install the update over the existing test app to retain local data.
2. Open Parent Mode → Content downloads. The test build uses `https://deploy-preview-6--issa-uzair.netlify.app/content`; it can be replaced with your own HTTPS backend. Save and check the connection after enabling optional network access.
3. Under Publisher text, select Arabic or transliteration, read/accept its conditions, download and verify the displayed amount, then confirm offline installation. Repeat for the second edition as desired.
4. For QF audio/tafsir, provision approved `QF_CLIENT_ID` and `QF_CLIENT_SECRET` on the server only. On Netlify use Functions-scoped environment variables and redeploy. `QF_ENV=production` is required for the full canonical core. Never paste these values into public Expo variables or the app.
5. Choose an available reciter or English tafsir from actual metadata, sync it, check actual coverage/sizes, and explicitly confirm audio files. A failed sync leaves prior offline content intact.
6. Review teaching in Parent Mode → Review educational explanations. Save ages/edits, request review, record a real named reviewer attestation, then separately approve and publish for your family. Drafts stay hidden in normal Kids Mode until this is done.
