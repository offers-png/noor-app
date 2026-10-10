# Family points, recordings, Salah and Wudu — Android 1.1.0 (5)

## Points and the $1 daily reward

| Activity | Points | Verified by |
| --- | --- | --- |
| Quran memorization (video) | 20 | Parent approves the recording |
| Dua recited from memory (video) | 15 | Parent |
| Hadith memorized and explained (video) | 15 | Parent |
| Salah practice (video) | 15 | Parent |
| Wudu demonstration (video) | 15 | Parent |
| Salah lesson (finish a prayer guide and pass its quiz) | 15 | App, once per day |
| Islamic knowledge quiz (80% or more) | 10 | App, each quiz once per day, at most 30 points per day |
| Daily revision (finish a Quran memorization practice) | 10 | App, once per day |

- 100 approved points in one day earn one $1 reward for that child and day. Never more than $1 per child per day.
- The day follows the parent's time zone (Review center → Settings). Points start again at local midnight. Earned dollars accumulate until the parent marks them paid.
- Points count toward the day the child did the activity, even when a parent approves later.
- The same item cannot be rewarded twice in a day. A parent's "Ask to try again" lets the child record one new attempt; the earlier video is deleted.
- Parents can approve with a different number of points, correct an approved entry, or add a signed adjustment with a note. A correction that drops a day below 100 points withdraws an unpaid reward. Paid rewards are never removed.
- "Mark as paid" only records that the parent paid. The app never moves money and has no payment integration.
- Every approve, reject, correct, adjust, pay, view, export and delete action re-checks the parent PIN session. Children's screens are read-only.

## Recitation videos

- Child taps **Record My Recitation** → chooses a surah, dua, hadith, prayer or wudu → camera preview (front camera) → record (up to 3 minutes) → watch → send to parent, or record again.
- The camera and microphone are only active on that screen. Leaving the screen or the app stops the recording and discards the unfinished file. Unsent recordings are deleted.
- Recording is refused when less than 200 MB is free. Empty or interrupted files are discarded.
- Videos are stored in the app's private folder (Android app-internal storage). Android sandboxing and the device's file-based encryption protect them. `allowBackup` is off, so they are not copied into cloud backups. Nothing is uploaded. The app does not add its own per-file encryption.
- Parent Mode → Review center: watch, approve, ask to try again, reject, export through the Android share sheet, delete one, delete selected, or delete all. Storage use is shown. Reviewed videos are deleted automatically after 7, 30 or 90 days, or kept until deleted. Videos still waiting for review are never auto-deleted. Deleting an unreviewed video cancels its points.
- The app does not judge pronunciation. The parent decides.

## Salah and Wudu tiles

- **Salah — Learn to Pray:** getting ready (wudu, clean place, intention, Qiblah), then each of the five prayers with the correct number of rak‘ahs. Each rak‘ah is taught step by step: takbir, qiyam, Al-Fatihah, extra surah in rak‘ahs 1–2, ruku, rising, two sujud with the sitting between, first tashahhud after rak‘ah 2 in 3- and 4-rak‘ah prayers, then the final tashahhud, salawat, closing supplication and taslim. Includes a quiz and a video practice option.
- Al-Fatihah and Al-Ikhlas use the bundled, verified Tanzil text and Alafasy recordings.
- Takbir, the words of ruku, rising and sujud, and taslim are shown in transliteration with meaning and a hadith reference. The tashahhud, salawat and the supplication between the two sujud are named with a reference, and the child is directed to their teacher. **Their Arabic text and recitation audio are not included** because no verified, licensed source was available to copy them from.
- Areas where recognised schools differ are listed without a ruling. The parent's chosen approach (teacher, Hanafi, Maliki, Shafi‘i or Hanbali) is shown to the child.
- **Wudu — Learn Purification:** ten steps with counts, following Qur'an 5:6 and Sahih al-Bukhari 159. Also covers how many times, what breaks wudu (schools differ beyond the basics), common mistakes, saving water, and an age-appropriate note on ghusl. Includes a quiz and a video demonstration. No per-limb duas are included.
- Both guides go through Parent Mode → Review educational explanations: a named qualified reviewer, the exact version, then family publication. Until then the tiles show a "learn with your parent" card, or a labelled preview when review content is on. **Please have the listed hadith references checked**; they were written from scholarly knowledge and not machine-verified against the source.

## Hadith and Dua library

- Parent Mode → **Hadith & Dua library (Sunnah.com)**: choose a collection (Bukhari, Muslim, Riyad as-Salihin and others) and a number, or use a suggested reference. The app fetches the exact Arabic, English and grading through the content server. The parent reads it, picks a child-friendly topic (parents, mothers, kindness, honesty, prayer, cleanliness, generosity, patience, manners; or a dua occasion) and confirms. Records are stored unchanged and work offline.
- Children see them under Hadith or Duas, with source and grading, save, practice, a quiz built only from the record's own details, and Record My Recitation. Duas from Sunnah.com are labelled hadith-based. Qur'anic duas stay labelled "from the Qur'an".
- **Requires `SUNNAH_API_KEY` on the content server** (Netlify Functions environment variable, then redeploy). Without it, lookups show a clear message. Transliteration is not supplied by this source. Child-friendly explanations still go through the review workflow.

## Tests and limits

Automated: separate child records; point values; approval-only crediting; duplicates; daily caps; the $1 limit; midnight reset in a chosen time zone; late approvals; retry, reject and corrections; paid history kept; payouts; PIN guards; recording save, duplicate discard, retry replacement, retention, deletion and low storage; the prayer rak‘ah and tashahhud structure; verified Qur'an keys; wudu order; guide review gating; Android permission configuration; and Sunnah.com through the proxy with the key kept server-side.

Not verified here: camera capture, playback and permission prompts on a real phone (no Android device in this environment), live Sunnah.com, and religious accuracy review of the guides. These need on-device testing, a Sunnah.com key and your qualified reviewer.

## Keeping the phone in Kids Islam — 1.2.0 (6)

Parent Mode → **Lock the phone to Kids Islam**. When it is on, the app locks the screen whenever it opens or Kids Mode starts. Your child can use every lesson but cannot go to other apps. **Let the phone leave the app** (behind your PIN) pauses the lock until you tap Enter Kids Mode again.

Two levels, both using Android's lock task mode:

1. **App pinning (any Android phone).** Turn on Settings → App pinning, and its "Ask for PIN before unpinning". The first time, Android asks to pin; tap Pin or Got it. Leaving then needs the button gesture *and* the phone's lock-screen PIN, so use a phone PIN your child does not know. If your child declines the pin prompt, Home shows "Keep Kids Islam on screen".
2. **Dedicated device mode (complete lock).** Only your Kids Islam parent PIN can release it; Home, Recents and notifications are hidden. This needs a one-time setup with a computer:
   1. Install the Kids Islam APK.
   2. Remove every account from the phone (Settings → Accounts), or use a freshly reset phone without signing in. Android allows this only on phones without accounts.
   3. Turn on Developer options and USB debugging. Connect the phone to a computer with Android platform-tools.
   4. Run `adb shell dpm set-device-owner com.noor.kidsislam/expo.modules.kidslock.KidsLockAdminReceiver`
   5. Open Parent Mode and turn on the lock.
   To undo: Parent Mode → Turn off dedicated device mode. Until then Android will not let you uninstall the app.

While locked, the power button still works. Incoming calls and notifications may be hidden. Exporting a video or opening phone Settings needs you to release the lock first.

## Story videos (YouTube)

- Parent Mode → **Story videos (YouTube)**: pick a topic, such as How Allah created the world, Prophet Adam, Nuh, Ibrahim, Musa, Yunus, Yusuf or Kindness. Enter a YouTube channel you trust (@handle or channel link) and search. The content server returns only public, embeddable, Made for Kids, non-live videos of up to 20 minutes, using the website's existing checks. Watch a video, confirm, and approve it.
- The child's **Story Videos** tile lists approved videos by topic. Before each play the video is checked again with YouTube. It plays inside the app on YouTube's privacy-enhanced player. Tapping through to YouTube is blocked, so the lock is not broken.
- Needs internet and **`YOUTUBE_API_KEY`** on the content server (Netlify Functions variable, then redeploy). `YOUTUBE_ALLOWED_CHANNEL_IDS` optionally restricts channels. YouTube may still show ads. The checks cannot judge religious accuracy or whether prophets are pictured; that is the parent's review.
