import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { loadEnv } from 'vite';

const ENDPOINTS = new Map([
  ['/.netlify/functions/teacher-voice', { kind: 'voice', bodyLimit: 18000 }],
  ['/.netlify/functions/story-videos', { kind: 'stories', bodyLimit: 8192 }],
]);
const ENV_NAMES = [
  'ELEVENLABS_API_KEY', 'ELEVENLABS_TEACHER_VOICE_ID', 'ELEVENLABS_STORY_VOICE_ID',
  'YOUTUBE_API_KEY', 'YOUTUBE_ALLOWED_CHANNEL_IDS',
];
// URL imports keep the provider SDK out of Vite's bundled configuration too.
const VOICE_MODULE = new URL('./teacherVoice.mjs', import.meta.url).href;
const STORIES_MODULE = new URL('./storyVideos.mjs', import.meta.url).href;

function sendError(response, status, message) {
  if (response.destroyed || response.writableEnded) return;
  if (response.headersSent) { response.destroy(); return; }
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify({ error: message }));
}

/** Bounded, backpressured input; cancellation drains instead of destroying the response socket. */
function requestBody(incoming, limit, onTooLarge) {
  const iterator = incoming.iterator({ destroyOnReturn: false });
  let bytes = 0;
  let canceled = false;
  const release = () => {
    canceled = true;
    void iterator.return().catch(() => {});
    incoming.resume();
  };
  return new ReadableStream({
    async pull(controller) {
      try {
        const { value, done } = await iterator.next();
        if (canceled) return;
        if (done) { controller.close(); return; }
        bytes += value.byteLength;
        if (bytes > limit) {
          onTooLarge();
          controller.error(new Error('Request body exceeds the local function limit.'));
          release();
          return;
        }
        controller.enqueue(value);
      } catch (error) {
        if (!canceled) controller.error(error);
      }
    },
    cancel: release,
  });
}

/**
 * Local development only: run the production handler factories at their normal URLs.
 * This adapter does not emulate Netlify's platform rate limits or other services.
 * Private keys are loaded inside configureServer, never put into client defines/env.
 */
export function devFunctionsPlugin() {
  return {
    name: 'vite-plugin-noor-local-functions',
    apply: 'serve',
    configureServer(server) {
      const files = server.config.envDir === false
        ? {} : loadEnv(server.config.mode, server.config.envDir || server.config.root, '');
      const env = Object.fromEntries(ENV_NAMES.map(name => [name, process.env[name] ?? files[name]]));
      const handlers = new Map();
      const getHandler = kind => {
        if (!handlers.has(kind)) {
          const promise = kind === 'voice'
            ? import(VOICE_MODULE).then(({ createTeacherVoiceHandler }) => createTeacherVoiceHandler({ env: name => env[name] }))
            : import(STORIES_MODULE).then(({ createStoryVideosHandler }) => createStoryVideosHandler({ env }));
          handlers.set(kind, promise);
          // A transient module-load failure should not poison the entire dev session.
          void promise.catch(() => { if (handlers.get(kind) === promise) handlers.delete(kind); });
        }
        return handlers.get(kind);
      };

      server.middlewares.use(async (incoming, outgoing, next) => {
        // Match only these two paths; leave assets and SPA routing to Vite.
        const path = incoming.url?.split('?')[0];
        const endpoint = ENDPOINTS.get(path);
        if (!endpoint) { next(); return; }
        const declared = incoming.headers['content-length'];
        if (declared !== undefined && (!/^\d+$/.test(declared) || Number(declared) > endpoint.bodyLimit)) {
          incoming.resume();
          sendError(outgoing, 413, 'Local function request is too large.');
          return;
        }

        const abort = new AbortController();
        const disconnect = () => { if (!outgoing.writableEnded) abort.abort(); };
        incoming.once('aborted', disconnect);
        outgoing.once('close', disconnect);
        let webRequest;
        let tooLarge = false;
        try {
          const headers = new Headers();
          for (let i = 0; i < incoming.rawHeaders.length; i += 2) {
            headers.append(incoming.rawHeaders[i], incoming.rawHeaders[i + 1]);
          }
          const protocol = incoming.socket.encrypted ? 'https' : 'http';
          const url = new URL(incoming.url, `${protocol}://${incoming.headers.host}`);
          const method = incoming.method || 'GET';
          const body = method === 'GET' || method === 'HEAD' ? undefined
            : requestBody(incoming, endpoint.bodyLimit, () => { tooLarge = true; });
          if (!body) incoming.resume();
          webRequest = new Request(url, { method, headers, body, duplex: 'half', signal: abort.signal });
          const handler = await getHandler(endpoint.kind);
          const response = await handler(webRequest);
          if (tooLarge) { sendError(outgoing, 413, 'Local function request is too large.'); return; }
          if (abort.signal.aborted || outgoing.destroyed) {
            await response.body?.cancel();
            return;
          }
          outgoing.statusCode = response.status;
          response.headers.forEach((value, name) => outgoing.setHeader(name, value));
          if (response.body) await pipeline(Readable.fromWeb(response.body), outgoing, { signal: abort.signal });
          else outgoing.end();
        } catch {
          if (!abort.signal.aborted) {
            sendError(outgoing, tooLarge ? 413 : 500, tooLarge
              ? 'Local function request is too large.' : 'The local function could not run. Restart the development server and try again.');
          }
        } finally {
          incoming.off('aborted', disconnect);
          outgoing.off('close', disconnect);
          // Handlers release their reader locks; unread bodies must not hold the socket.
          if (webRequest?.body && !webRequest.body.locked) void webRequest.body.cancel().catch(() => {});
        }
      });
    },
  };
}
