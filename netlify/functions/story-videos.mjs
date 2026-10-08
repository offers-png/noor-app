import { createStoryVideosHandler } from '../../server/storyVideos.mjs';

export default async function storyVideos(request) {
  return createStoryVideosHandler({
    env: {
      YOUTUBE_API_KEY: Netlify.env.get('YOUTUBE_API_KEY'),
      YOUTUBE_ALLOWED_CHANNEL_IDS: Netlify.env.get('YOUTUBE_ALLOWED_CHANNEL_IDS'),
    },
  })(request);
}

export const config = {
  path: '/.netlify/functions/story-videos',
  rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
