import type { Database } from '../database/types';

/**
 * Parent-approved YouTube story videos. The content server applies the same checks as the website:
 * public, embeddable, Made for Kids, not live, at most 20 minutes, and an optional channel allow-list.
 * Those checks cannot judge religious accuracy or how prophets are shown, so every video needs a
 * parent's own approval before a child sees it.
 */
export const STORY_TOPICS = {
  creation: 'How Allah created the world', adam: 'Prophet Adam', nuh: 'Prophet Nuh (Noah)', ibrahim: 'Prophet Ibrahim (Abraham)',
  musa: 'Prophet Musa (Moses)', yunus: 'Prophet Yunus (Jonah)', yusuf: 'Prophet Yusuf (Joseph)', kindness: 'Kindness',
} as const;
export type StoryTopic = keyof typeof STORY_TOPICS;
export interface CheckedVideo { id: string; title: string; channelTitle: string; channelId: string; durationSeconds: number; checkedAt: string }
export interface ApprovedVideo extends CheckedVideo { topic: StoryTopic; approvedAt: string }
const KEY = 'story-videos:v1';
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

function guard(parentAllowed: () => boolean) { if (!parentAllowed()) throw new Error('Enter your parent PIN to continue.'); }
function validVideo(value: unknown): value is CheckedVideo {
  const v = value as CheckedVideo;
  return !!v && VIDEO_ID.test(v.id) && typeof v.title === 'string' && typeof v.channelTitle === 'string' && /^UC[A-Za-z0-9_-]{22}$/.test(v.channelId) && Number.isFinite(v.durationSeconds);
}

async function call(proxyUrl: string, query: Record<string, string>, networkAllowed: () => boolean, fetcher: typeof fetch): Promise<CheckedVideo[]> {
  if (!networkAllowed()) throw new Error('Turn on optional network access in Parent Mode to use story videos.');
  let response: Response;
  try { response = await fetcher(`${proxyUrl.replace(/\/+$/, '')}/api/videos?${new URLSearchParams(query)}`); }
  catch { throw new Error('The video service could not be reached. Check the internet connection.'); }
  let body: { videos?: unknown[]; message?: string };
  try { body = await response.json(); } catch { throw new Error('The video service returned an unreadable answer.'); }
  if (!response.ok) throw new Error(response.status === 503 ? 'Story videos need a YouTube API key on your content server (YOUTUBE_API_KEY).' : response.status === 404 && !body.message ? 'This content server does not support videos yet. Redeploy it.' : body.message ?? 'Videos could not be checked.');
  if (!Array.isArray(body.videos)) throw new Error('The video service returned an unexpected answer.');
  return body.videos.filter(validVideo);
}
export function searchStoryVideos(proxyUrl: string, topic: StoryTopic, channel: string, networkAllowed: () => boolean, fetcher: typeof fetch = fetch) {
  if (!(topic in STORY_TOPICS)) throw new Error('Choose a story topic.');
  if (!channel.trim()) throw new Error('Enter a trusted YouTube channel, such as @ChannelName.');
  return call(proxyUrl, { action: 'search', topic, channel: channel.trim() }, networkAllowed, fetcher);
}
/** Fresh check before each playback: a video that became private, unembeddable or not Made for Kids is not played. */
export async function stillPermitted(proxyUrl: string, id: string, networkAllowed: () => boolean, fetcher: typeof fetch = fetch): Promise<boolean> {
  if (!VIDEO_ID.test(id)) return false;
  return (await call(proxyUrl, { action: 'validate', ids: id }, networkAllowed, fetcher)).some(video => video.id === id);
}

export class StoryVideoLibrary {
  constructor(private readonly db: Database, private readonly now: () => Date = () => new Date()) {}
  async list(): Promise<ApprovedVideo[]> {
    const row = await this.db.getFirstAsync<{ value_json: string }>('SELECT value_json FROM app_settings WHERE key=?', KEY);
    if (!row) return [];
    try { return (JSON.parse(row.value_json) as ApprovedVideo[]).filter(video => validVideo(video) && video.topic in STORY_TOPICS); } catch { return []; }
  }
  async approve(video: CheckedVideo, topic: StoryTopic, confirmation: { watchedAndSuitable: boolean }, parentAllowed: () => boolean): Promise<void> {
    guard(parentAllowed);
    if (confirmation.watchedAndSuitable !== true) throw new Error('Watch the whole video and confirm it is suitable first.');
    if (!validVideo(video) || !(topic in STORY_TOPICS)) throw new Error('Only checked videos can be approved.');
    const next = [...(await this.list()).filter(item => item.id !== video.id), { ...video, topic, approvedAt: this.now().toISOString() }];
    await this.db.runAsync('INSERT OR REPLACE INTO app_settings(key,value_json) VALUES (?,?)', KEY, JSON.stringify(next));
  }
  async remove(id: string, parentAllowed: () => boolean): Promise<void> {
    guard(parentAllowed);
    await this.db.runAsync('INSERT OR REPLACE INTO app_settings(key,value_json) VALUES (?,?)', KEY, JSON.stringify((await this.list()).filter(item => item.id !== id)));
  }
}

/** Embedded player page. Uses YouTube's privacy-enhanced domain; related videos stay on the same channel. */
export function playerHtml(id: string): string {
  if (!VIDEO_ID.test(id)) throw new Error('Invalid video.');
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%;background:#000}iframe{border:0;width:100%;height:100%}</style></head><body><iframe src="https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0&modestbranding=1" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></body></html>`;
}
/** Only the player page and its embedded frames may load; links out to YouTube or elsewhere are blocked. */
export function allowPlayerNavigation(request: { url: string; isTopFrame?: boolean }, baseUrl: string): boolean {
  if (request.isTopFrame === false) return true;
  return request.url === 'about:blank' || request.url.startsWith(baseUrl);
}
