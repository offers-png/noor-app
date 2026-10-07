# Noor

A React app for individual and group Islamic learning with an AI teacher.

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

Camera and microphone access require HTTPS or localhost and browser permission. A parent should be nearby during lessons. Student profiles, notes, and lesson history depend on the backend; the repository contains the frontend only.
