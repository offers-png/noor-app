# Published meaning and notes

Publisher/source: QuranEnc.com, **English Translation - Rowwad Translation Center**, edition `english_rwwad`, version **1.0.19**, verified and downloaded **2026-10-08**. The publisher's current English catalog supplied the edition identity, description, version and update timestamp: https://quranenc.com/api/v1/translations/list/en . Publisher description is retained verbatim in `quran-meaning.json` and the original catalog response. The translation is attributed by the publisher to Rowwad Translation Center, in cooperation with the Rabwah Dawah Association, the Islamic Content Service Association in Languages, and IslamHouse.com.

Official API documentation and republication terms: https://quranenc.com/en/home/api . Official browse source: https://quranenc.com/en/browse/english_rwwad . The publisher permits downloading and republishing, subject to unchanged content, publisher/source attribution, version number, retaining transcript information, reporting any notes on the translation to the source, updating from the latest publisher version, and excluding inappropriate advertisements. This is publisher permission, not a Creative Commons claim. No separate permission or app-qualified religious review is claimed.

The fixture includes each **complete** meaning string and all supplied footnotes for the same 29 ayahs in surahs 1, 107, 112, 113 and 114. These strings are copied directly from the official response fields `translation` and `footnotes`; they are not combined, abridged, modernized, translated or explained by a model. All 29 ayahs have a meaning; **12** have a separate publisher note. Empty notes remain empty. The UI labels the layer **Published meaning and notes**, distinct from optional downloaded tafsir and original app teaching drafts. Neither the app's local review screen nor an entered reviewer attestation creates or approves these publisher strings.

The exact official response bytes are retained under `quran-meaning-source/`:

- https://quranenc.com/api/v1/translation/sura/english_rwwad/1
- https://quranenc.com/api/v1/translation/sura/english_rwwad/107
- https://quranenc.com/api/v1/translation/sura/english_rwwad/112
- https://quranenc.com/api/v1/translation/sura/english_rwwad/113
- https://quranenc.com/api/v1/translation/sura/english_rwwad/114

`quran-meaning.json` retains the entire catalog metadata record, source notice, permission URL, original response checksums, and retained terms checksum. `quran-meaning-source/publisher-terms.html` contains only the exact publisher republication terms excerpt, with fetch date/source added separately; it is evidence and is never executed or displayed to children. Regression tests independently parse the original response bytes and compare every verse identity, complete meaning and note with the fixture and reader repository.

Maintenance: check the official catalog before each content release and whenever the publisher reports a correction. If the edition's version changes, obtain the latest official complete responses, regenerate the fixture by copying only the original fields, retain the new metadata/bytes/checksums, and run identity/string-preservation tests before publishing a replacement APK. Do not silently edit a publisher string. The current APK's offline copy is version 1.0.19; no automated QuranEnc update is implemented or advertised.
