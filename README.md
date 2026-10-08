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
node --test src/api.test.js
```

Camera and microphone access in the web classroom require HTTPS or localhost and browser permission. A parent should be nearby during web lessons. The web classroom's profiles, notes, and lesson history depend on its hosted backend. The mobile app stores profiles and progress locally and includes its own optional content proxy.
