import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTeacherVoiceHandler, VOICES } from './teacherVoice.mjs';

const req = (body, headers = {}) => new Request('https://classroom.example/.netlify/functions/teacher-voice', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://classroom.example', ...headers }, body: JSON.stringify(body),
});

test('server sends only fixed teacher voices to ElevenLabs and streams MP3', async () => {
  let args;
  const handler = createTeacherVoiceHandler({ env: name => name === 'ELEVENLABS_API_KEY' ? 'test-secret' : undefined,
    makeClient: key => { assert.equal(key, 'test-secret'); return { textToSpeech: { convert: async (...input) => {
      args = input; return new ReadableStream({ start(c) { c.enqueue(new Uint8Array([1, 2])); c.close(); } });
    } } }; },
  });
  const response = await handler(req({ text: 'Welcome to class.', voice: 'teacher' }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'audio/mpeg');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(args[0], VOICES.teacher);
  assert.equal(args[1].modelId, 'eleven_multilingual_v2');
  assert.equal(args[2].maxRetries, 0);
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [1, 2]);
});

test('missing configuration is visible and does not call the provider', async () => {
  const handler = createTeacherVoiceHandler({ env: () => undefined, makeClient: () => assert.fail('provider called') });
  const response = await handler(req({ text: 'Hello', voice: 'storyteller' }));
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /ELEVENLABS_API_KEY/);
});

test('rejects cross-site, oversized, empty and arbitrary voice requests before spending credits', async () => {
  const handler = createTeacherVoiceHandler({ env: () => 'key', makeClient: () => assert.fail('provider called') });
  assert.equal((await handler(req({ text: 'Hi', voice: 'teacher' }, { Origin: 'https://other.example' }))).status, 403);
  assert.equal((await handler(req({ text: 'Hi', voice: 'teacher' }, { Origin: '' }))).status, 403);
  assert.equal((await handler(req({ text: 'Hi', voice: 'teacher' }, { Origin: 'null' }))).status, 403);
  for (const body of [null, { text: '', voice: 'teacher' }, { text: 'x'.repeat(3501), voice: 'teacher' }, { text: 'Hi', voice: 'arbitrary' }]) {
    assert.equal((await handler(req(body))).status, 400);
  }
  assert.equal((await handler(req({ text: 'Hi', voice: 'teacher' }, { 'Content-Length': '19000' }))).status, 413);
});

test('rejects oversized body even without a declared length', async () => {
  const handler = createTeacherVoiceHandler({ env: () => 'key', makeClient: () => assert.fail('provider called') });
  assert.equal((await handler(req({ text: 'x'.repeat(19000), voice: 'teacher' }))).status, 413);
});

test('provider errors are sanitized without leaking secrets', async () => {
  const handler = createTeacherVoiceHandler({ env: () => 'secret', makeClient: () => ({ textToSpeech: { convert: async () => { throw new Error('secret'); } } }) });
  const response = await handler(req({ text: 'Hi', voice: 'teacher' }));
  assert.equal(response.status, 502);
  assert.doesNotMatch(await response.text(), /secret/);
});
