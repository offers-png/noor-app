const API_BASE = 'https://www.googleapis.com/youtube/v3/';
const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
const CHANNEL_HANDLE = /^@[A-Za-z0-9][A-Za-z0-9._-]{1,28}[A-Za-z0-9]$/;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const MAX_RESULTS = 10;
const MAX_BODY_BYTES = 8192;
const MAX_DURATION_SECONDS = 20 * 60;
const TOPIC_QUERIES = Object.freeze({
  creation: 'How Allah created the world Islamic story for children',
  adam: 'Prophet Adam creation story animated Islamic story for children',
  nuh: 'Prophet Nuh Noah animated Islamic story for children',
  ibrahim: 'Prophet Ibrahim Abraham animated Islamic story for children',
  musa: 'Prophet Musa Moses animated Islamic story for children',
  yunus: 'Prophet Yunus Jonah animated Islamic story for children',
  yusuf: 'Prophet Yusuf Joseph animated Islamic story for children',
  kindness: 'Kindness animated Islamic story for children',
});

class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function json(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    },
  });
}

async function requestBody(request) {
  if (request.method !== 'POST') throw new RequestError(405, 'Use POST to request story videos.');
  // This browser-only endpoint is not an open cross-origin API. Parent approval
  // belongs to the UI; an Origin check is not authentication or proof of age.
  const origin = request.headers.get('Origin');
  if (!origin || origin !== new URL(request.url).origin) {
    throw new RequestError(403, 'Story videos must be requested from this website.');
  }
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new RequestError(415, 'Send a JSON story video request.');
  }
  const declaredLength = request.headers.get('Content-Length');
  if (declaredLength && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > MAX_BODY_BYTES)) {
    throw new RequestError(413, 'Story video request is too large.');
  }
  if (!request.body) throw new RequestError(400, 'Send a JSON story video request.');
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let size = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new RequestError(413, 'Story video request is too large.');
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    const body = JSON.parse(text);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid body');
    return body;
  } catch (error) {
    if (error instanceof RequestError) throw error;
    throw new RequestError(400, 'Send a valid JSON story video request.');
  } finally {
    reader.releaseLock();
  }
}

function allowedChannels(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new RequestError(503, 'The server channel list needs configuration.');
  const ids = value.trim().split(/[\s,]+/).filter(Boolean);
  if (!ids.length || ids.some(id => !CHANNEL_ID.test(id))) {
    throw new RequestError(503, 'The server channel list needs configuration.');
  }
  return new Set(ids);
}

export function parseChannelSource(source) {
  const invalid = () => new RequestError(400, 'Use @handle (3–30 English letters, digits or internal . _ -), a basic YouTube channel link, or a UC channel ID. Remove extra URL paths and parameters.');
  if (typeof source !== 'string' || source.length > 150 || /[^\x20-\x7e]|\\/.test(source)) throw invalid();
  const value = source.trim();
  if (CHANNEL_ID.test(value)) return { id: value };
  if (CHANNEL_HANDLE.test(value)) return { handle: value };
  // Parse an exact known-host shape; never fetch the submitted URL. Keeping this
  // strict also avoids URL normalization of credentials, escapes and dot paths.
  const link = /^https:\/\/(?:www\.)?youtube\.com\/(@[^\/?#]+|channel\/[^\/?#]+)\/?$/i.exec(value);
  if (link) {
    if (CHANNEL_HANDLE.test(link[1])) return { handle: link[1] };
    const id = link[1].startsWith('channel/') ? link[1].slice('channel/'.length) : '';
    if (CHANNEL_ID.test(id)) return { id };
  }
  throw invalid();
}

function parseInput(body) {
  if (body.action === 'search') {
    if (typeof body.topic !== 'string' || !Object.hasOwn(TOPIC_QUERIES, body.topic)) {
      throw new RequestError(400, 'Choose a supported story topic.');
    }
    return { action: 'search', topic: body.topic, channelSource: parseChannelSource(body.channelId) };
  }
  if (body.action === 'validate') {
    if (!Array.isArray(body.ids) || !body.ids.length || body.ids.length > MAX_RESULTS
      || body.ids.some(id => typeof id !== 'string' || !VIDEO_ID.test(id))) {
      throw new RequestError(400, 'Provide between 1 and 10 valid YouTube video IDs.');
    }
    return { action: 'validate', ids: [...new Set(body.ids)] };
  }
  throw new RequestError(400, 'Choose search or validate for the story video request.');
}

export function durationSeconds(value) {
  if (typeof value !== 'string') return null;
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(value);
  if (!match || !match.slice(1).some(part => part !== undefined)) return null;
  const seconds = Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
  return Number.isFinite(seconds) ? seconds : null;
}

function permittedVideo(item, requestedIds, channels, searchedChannel) {
  if (!item || typeof item !== 'object' || !requestedIds.has(item.id)) return false;
  const { snippet, status, contentDetails, paidProductPlacementDetails } = item;
  if (!snippet || !status || !contentDetails) return false;
  if (status.privacyStatus !== 'public' || status.embeddable !== true || status.madeForKids !== true) return false;
  if (snippet.liveBroadcastContent !== 'none' || !CHANNEL_ID.test(snippet.channelId ?? '')) return false;
  if ((searchedChannel && snippet.channelId !== searchedChannel) || (channels && !channels.has(snippet.channelId))) return false;
  if (typeof snippet.title !== 'string' || !snippet.title.length || snippet.title.length > 100
    || typeof snippet.channelTitle !== 'string' || !snippet.channelTitle.length || snippet.channelTitle.length > 250) return false;
  if (contentDetails.contentRating?.ytRating === 'ytAgeRestricted') return false;
  // No country is inferred from a child's device. Exclude region-limited videos
  // rather than assume a parent's country from the network address.
  if (contentDetails.regionRestriction) return false;
  // YouTube documents an omitted declaration as false. This is creator-declared
  // placement metadata, not a promise that YouTube will not serve advertising.
  if (paidProductPlacementDetails?.hasPaidProductPlacement === true) return false;
  if (paidProductPlacementDetails?.hasPaidProductPlacement !== undefined
    && typeof paidProductPlacementDetails.hasPaidProductPlacement !== 'boolean') return false;
  const seconds = durationSeconds(contentDetails.duration);
  return seconds !== null && seconds > 0 && seconds <= MAX_DURATION_SECONDS;
}

/** No video bytes, descriptions, child data, arbitrary upstream URLs, or API cache. */
export function createStoryVideosHandler({ env = process.env, fetcher = fetch, now = Date.now } = {}) {
  return async request => {
    try {
      const input = parseInput(await requestBody(request));
      const channels = allowedChannels(env.YOUTUBE_ALLOWED_CHANNEL_IDS);
      let searchedChannel = input.channelSource?.id;
      if (input.action === 'search' && searchedChannel && channels && !channels.has(searchedChannel)) {
        throw new RequestError(403, 'This channel is not in the website’s approved channel list.');
      }
      if (typeof env.YOUTUBE_API_KEY !== 'string' || !env.YOUTUBE_API_KEY.trim()) {
        throw new RequestError(503, 'Story video discovery is not connected. Add YOUTUBE_API_KEY to the server environment.');
      }
      const signal = AbortSignal.timeout(12000);
      async function youtube(resource, params) {
        const url = new URL(resource, API_BASE);
        url.search = new URLSearchParams(params).toString();
        try {
          const response = await fetcher(url.href, {
            headers: { 'x-goog-api-key': env.YOUTUBE_API_KEY.trim(), Accept: 'application/json' },
            redirect: 'error',
            signal,
          });
          if (!response.ok) throw new Error('Upstream request failed');
          const body = await response.json();
          if (!body || !Array.isArray(body.items)) throw new Error('Invalid upstream response');
          return body.items;
        } catch {
          throw new RequestError(502, 'YouTube could not check story videos. Try again later or check the server key and quota.');
        }
      }

      let ids = input.ids;
      if (input.action === 'search') {
        if (!searchedChannel) {
          const matches = await youtube('channels', { part: 'id', forHandle: input.channelSource.handle });
          if (!matches.length) throw new RequestError(404, 'This YouTube handle was not found. Check the handle or paste a basic channel link.');
          if (matches.length !== 1 || typeof matches[0]?.id !== 'string' || !CHANNEL_ID.test(matches[0].id)) {
            throw new RequestError(502, 'YouTube did not return a valid channel. Please try again later.');
          }
          searchedChannel = matches[0].id;
        }
        if (channels && !channels.has(searchedChannel)) {
          throw new RequestError(403, 'This channel is not in the website’s approved channel list.');
        }
        const results = await youtube('search', {
          part: 'snippet', type: 'video', safeSearch: 'strict',
          videoEmbeddable: 'true', videoSyndicated: 'true',
          maxResults: String(MAX_RESULTS), relevanceLanguage: 'en',
          channelId: searchedChannel, q: TOPIC_QUERIES[input.topic],
        });
        ids = [...new Set(results.slice(0, MAX_RESULTS)
          .filter(item => item?.id?.kind === 'youtube#video' && VIDEO_ID.test(item.id.videoId ?? ''))
          .map(item => item.id.videoId))];
      }
      if (!ids.length) return json(200, { videos: [] });
      const metadata = await youtube('videos', {
        part: 'snippet,status,contentDetails,paidProductPlacementDetails',
        // videos.list does not support maxResults together with its id filter.
        id: ids.join(','),
      });
      const requestedIds = new Set(ids);
      const byId = new Map(metadata.filter(item => permittedVideo(item, requestedIds, channels, searchedChannel))
        .map(item => [item.id, item]));
      const checkedAt = new Date(now()).toISOString();
      const videos = ids.filter(id => byId.has(id)).map(id => {
        const item = byId.get(id);
        return {
          id, title: item.snippet.title, channelTitle: item.snippet.channelTitle,
          channelId: item.snippet.channelId, durationSeconds: durationSeconds(item.contentDetails.duration), checkedAt,
        };
      });
      return json(200, { videos });
    } catch (error) {
      if (error instanceof RequestError) return json(error.status, { error: error.message }, error.status === 405 ? { Allow: 'POST' } : {});
      return json(500, { error: 'Story videos could not be checked. Please try again later.' });
    }
  };
}
