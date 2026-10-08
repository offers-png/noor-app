import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

export const VOICES = {
  teacher: 'nPczCjzI2devNBz1zQrb',
  storyteller: 'JBFqnCBsd6RMkjVDRZzb',
};

const json = (error, status) => Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });

export function createTeacherVoiceHandler({ env, makeClient = key => new ElevenLabsClient({ apiKey: key }) }) {
  return async request => {
    if (request.method !== 'POST') return json('Use POST.', 405);
    const origin = request.headers.get('origin');
    if (origin !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') {
      return json('Use the classroom website to request narration.', 403);
    }
    if (!request.headers.get('content-type')?.startsWith('application/json')) return json('Send JSON.', 415);
    if (Number(request.headers.get('content-length')) > 18000) return json('Narration is too long.', 413);
    let body;
    try {
      const reader = request.body?.getReader();
      const decoder = new TextDecoder();
      let raw = '', bytes = 0;
      if (!reader) return json('Invalid narration request.', 400);
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > 18000) { await reader.cancel(); return json('Narration is too long.', 413); }
          raw += decoder.decode(value, { stream: true });
        }
        raw += decoder.decode();
      } finally { reader.releaseLock(); }
      body = JSON.parse(raw);
    } catch { return json('Invalid narration request.', 400); }
    if (!body || typeof body.text !== 'string' || !body.text.trim() || body.text.length > 3500 || !Object.hasOwn(VOICES, body.voice)) {
      return json('Choose a teacher voice and a lesson of up to 3,500 characters.', 400);
    }
    const key = env('ELEVENLABS_API_KEY');
    if (!key) return json('Natural voice needs ELEVENLABS_API_KEY in the site’s Functions environment. The device voice is available meanwhile.', 503);
    const voiceId = env(body.voice === 'teacher' ? 'ELEVENLABS_TEACHER_VOICE_ID' : 'ELEVENLABS_STORY_VOICE_ID') || VOICES[body.voice];
    try {
      const audio = await makeClient(key).textToSpeech.convert(voiceId, {
        text: body.text.trim(),
        modelId: 'eleven_multilingual_v2',
        outputFormat: 'mp3_44100_128',
        voiceSettings: { stability: 0.5, similarityBoost: 0.75, style: 0.15, useSpeakerBoost: true, speed: 0.95 },
      }, { timeoutInSeconds: 40, maxRetries: 0, abortSignal: request.signal });
      return new Response(audio, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
    } catch {
      return json('Natural voice is temporarily unavailable. Check the ElevenLabs key, voice access and account credits.', 502);
    }
  };
}
