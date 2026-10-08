# Android sourced content update — 1.0.1 (2)

Verified October 8, 2026. APK runtime source commit: `c9996d0ff88d15f37f00d2d88cc4167e76b58f2b`.

## Result

Normal Kids Mode now offers five Dua readings and three Hadith readings offline, including source Arabic, published English, references, and separately attributed Dua transliteration. Children can save Hadith and record reading practice. These catalogs do not require enabling development review content.

The 29 seeded ayahs across Al-Fatihah, Al-Ma’un, Al-Ikhlas, Al-Falaq, and An-Nas include unchanged Tanzil English verse transliteration and QuranEnc Rowwad published meanings, edition `english_rwwad` version `1.0.19`. Twelve ayahs have publisher notes. The UI labels these as published meaning and notes, separately from licensed tafsir. It does not invent word alignment, religious commentary, or review approval.

Existing SQLite Quran payloads receive the new display layers when read, without replacing their canonical Arabic or previously stored English. Source readings use independent bookmark and practice records. Original teaching explanations and quizzes retain their publication/review gates.

## Source evidence and permissions

- [Sunnah.com reproduction permission](https://sunnah.com/about#reproduction) covers individual teaching selections. The app retains each selection’s reference and attribution; it does not redistribute whole collections. Dua transliteration credits remain separate where its source differs from the Arabic/English source.
- [Tanzil translation terms](https://tanzil.net/trans/) apply to [English transliteration](https://tanzil.net/trans/en.transliteration). This edition permits **noncommercial use**. This is an educational test APK. Commercial distribution requires translator/publisher permission or a replacement with appropriate rights. The Arabic text’s separate license does not grant those rights.
- [QuranEnc API and publisher terms](https://quranenc.com/en/home/api) permit unchanged republication with attribution, version identification, and maintained updates. Check the [publisher catalog](https://quranenc.com/api/v1/translations/list/en) at each content release and when corrections are published. Automatic edition updates are not implemented.

Exact publisher responses, notices, edition metadata and checksums are retained under `src/content/fixtures/`. See `quran-SOURCES.md` and `quran-meaning-SOURCES.md` there for the full record. Published source material is distinct from the app’s original teaching content; a source license does not attest to qualified review of app-authored explanations.

## Automated and build validation

- Full mobile suite: **76 tests passed**. Coverage includes exact source identity/text, immutable canonical data, safe transliteration markup presentation, existing SQLite payload fallback, synced-core fallback, normal Kids Mode access, review gates, bookmarks and child progress isolation.
- ESLint and TypeScript checks passed on the final runtime code.
- Android Hermes export passed; native Metro bundled 1,532 modules.
- Native release build succeeded. Android release lint checks passed. The generated native checkout’s changed runtime files and `app.json` matched the APK source commit.
- GitHub Actions `check` and `verify` workflows passed for that commit.

## Native upgrade acceptance

Test device: headless Pixel_6 emulator, Android 13/API 33, x86_64. The original 1.0.0 APK was installed first, and a local parent PIN, child profile, Quran bookmark and Quran reading practice were created. Its Duas and Hadith screens reproduced the empty sections reported by the user.

The new APK was installed with `adb install -r`, without uninstalling or clearing data. Parent network access and development review content stayed **off** throughout.

| Check | Observed result |
| --- | --- |
| Existing local parent PIN and child | Original PIN still opened Parent Mode; Yusuf’s profile and avatar remained. |
| Duas | Five source readings visible; Before eating displayed joined Arabic, published Latin transliteration, English and reference. Reading practice saved. |
| Hadith | Three source readings visible; Intentions displayed Arabic, English, narrator and reference. Bookmark and practice saved. Saved count remained 1 after restart. |
| Quran | Al-Fatihah 1:1 displayed transliteration and attributed Rowwad published meaning/version. Al-Ikhlas 112:1 displayed its supplied publisher notes. |
| Existing bookmark | Original Quran bookmark 112:1 remained accessible after installation. |
| Progress after force-stop/relaunch | The original Quran practice plus the new Before eating Dua and Intentions Hadith practice remained, each with one practice. |
| Source rendering | Arabic shaping and diacritics rendered correctly; supported Tanzil bold/underline formatting rendered without raw HTML. |
| Parent settings | Network access and development review content remained disabled after the upgrade. |

This run verifies installed UI, persistence, and source access on the emulator. Physical-device listening quality and accessibility testing were not performed in this content update. The APK manifest contains no camera, microphone or location permissions.

## APK artifact

- File: `kids-islam-content-update.apk`
- Package: `com.noor.kidsislam`
- Version: `1.0.1`; Android version code: `2`
- ABIs: ARM64 and x86_64; minimum Android 7/API 24
- Size: `75,766,949` bytes
- SHA-256: `DD6E799FFA6AA9A53E1DC47C68437FEED70AB5719C0065451A74359922657A03`
- Signing certificate SHA-256: `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`

The certificate matches the original test APK; `apksigner verify` passed. It is a development/test certificate, not a production Play Store signing identity. Install the update over the existing app to retain local data. Uninstalling the app or clearing its storage deletes that data.

Build command in the short generated native checkout, with Android SDK and Java configured:

```powershell
.\gradlew.bat app:assembleRelease '-PreactNativeArchitectures=arm64-v8a,x86_64' --max-workers=1 -x lint -x test
```

Build/test logs and UI screenshot/XML evidence are retained in the task workspace. This release record does not replace the broader first-install acceptance record for 1.0.0.
