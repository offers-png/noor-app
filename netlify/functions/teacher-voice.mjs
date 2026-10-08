import { createTeacherVoiceHandler } from '../../server/teacherVoice.mjs';

export default createTeacherVoiceHandler({ env: name => Netlify.env.get(name) });

export const config = {
  path: '/.netlify/functions/teacher-voice',
  rateLimit: { action: 'rate_limit', aggregateBy: ['domain', 'ip'], windowSize: 60, windowLimit: 20 },
};
