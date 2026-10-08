# Noor

A React app for individual and group Islamic learning with an AI teacher.

The Android-first **Kids Islam** application is in [`mobile/`](mobile/README.md). It provides offline Quran reading and recitation, Arabic tracing, reviewed learning content, local child profiles, and PIN-protected parent controls using Expo and React Native. Its setup, content sources, tests, server-side provider proxy, and Android build instructions are documented separately in that directory.

## Development

Requires Node.js 22 or later.

```sh
npm ci
npm run dev
```

The frontend defaults to the existing hosted backend. To use a different backend, set `VITE_API_URL` in a local `.env` file before starting Vite. This value is public frontend configuration; never put secrets in it.

```sh
npm run build
npm run preview
npm test
```

Camera and microphone access in the web classroom require HTTPS or localhost and browser permission. A parent should be nearby during web lessons. The web classroom's profiles, notes, and lesson history depend on its hosted backend. The mobile app stores profiles and progress locally and includes its own optional content proxy.

## Website teacher voice and story videos

The classroom defaults to ElevenLabs narration: **Brian** for a warm teacher voice or **George** for storytelling. Preview, replay, stop, and device-voice controls are beside the classroom stage. Narration is AI-generated. Natural voice generation failures show a device-voice fallback; a browser that blocks playback shows a button to start it. Raising a hand, opening a video, or ending class cancels narration and discards stale microphone recordings. Loading audio also pauses ordinary microphone listening.

English teaching explanations are narrated; displayed Arabic is excluded from synthetic narration. This does not generate canonical Quran recitation. Teacher text, potentially including names in its replies, is sent to ElevenLabs for synthesis; audio is kept only in page memory for replay and is cleared when the classroom closes. Do not send sensitive child information in teacher prompts.

For local development, copy `.env.example` to `.env.local` and supply provider keys. `npm run dev` serves the same voice and video handler logic as the Netlify functions. The local adapter does not emulate Netlify's platform rate limits. `npm run preview` previews static output only and does not run functions.

For Netlify, the repository's `netlify.toml` builds `dist` and bundles `netlify/functions`. Add the following secrets in the site's **Environment variables** settings with **Functions** scope, then redeploy:

| Variable | Purpose |
| --- | --- |
| `ELEVENLABS_API_KEY` | Required for natural teacher narration |
| `ELEVENLABS_TEACHER_VOICE_ID` | Optional override for Brian; the voice must be available to this account |
| `ELEVENLABS_STORY_VOICE_ID` | Optional override for George |
| `YOUTUBE_API_KEY` | Required for story discovery and fresh playback checks; enable YouTube Data API v3 |
| `YOUTUBE_ALLOWED_CHANNEL_IDS` | Optional comma-separated channel ID allowlist, enforced for both search and playback |

Provider secrets must never use a `VITE_` prefix. Keep YouTube API restrictions enabled and set account quotas/spending limits for both providers. The endpoints accept same-origin JSON POSTs, bound request text/IDs, sanitize provider errors, and use per-IP/domain Netlify rate limits. The local adult PIN controls video approvals; it does not authenticate requests to these publicly reachable functions.

When a supported story topic appears in the lesson, the classroom offers its parent-approved video. Supported topics are Nuh, Ibrahim, Musa, Yunus, Yusuf, and kindness. In **Parent video settings**, create a local video PIN, choose a story and a trusted YouTube channel, search, preview, and confirm you reviewed the video's suitability, animation, religious accuracy, and visual depictions before approving it. Only IDs, topic associations, channel IDs, and review dates are stored, with a salted PIN hash. Approvals stay in that browser and can be removed/reset there; they do not sync between devices.

Videos never load automatically. Each preview or lesson playback requires consent and a fresh server metadata check. Filters require public, embeddable, Made-for-Kids videos of up to 20 minutes; they exclude live/upcoming, age/region-restricted, and declared paid-placement videos. These metadata filters cannot establish animation or religious accuracy. Parent review remains necessary. No YouTube media is downloaded or cached, and API titles/metadata are not persisted.

YouTube playback uses its visible official privacy-enhanced player. It can display ads, recommendations, and links to YouTube; the app cannot promise ad-free viewing or remove those elements. Before offering YouTube on this child-directed website, the site owner must complete Google's child-directed client notification and follow its applicable policies. See [YouTube developer policies](https://developers.google.com/youtube/terms/developer-policies), [Made-for-Kids checks](https://developers.google.com/youtube/v3/guides/made_for_kids_status), and [privacy-enhanced embedding](https://support.google.com/youtube/answer/171780?hl=en).

The teacher, microphone recognition, and camera monitoring pause while video settings or playback are open. Closing with **Close and resume teacher** replays the last teaching turn. Closing with Escape keeps the lesson paused until **Resume teacher** is pressed. The camera preview stream remains local while monitoring is paused.
