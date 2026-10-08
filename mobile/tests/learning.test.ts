import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { answerIsReady, isArabicLabel, isCorrect, scoreQuiz } from '../src/components/Quiz/scoring';
import { arabicAlphabet, letterQuiz, practiceQuestions, sampleArabicQuestions, starterLessons } from '../src/features/arabic/content';
import { advancePlan, hiddenWordIndexes, initialPlanCursor, memorizationLevels, nextMemorizationLevel, selectAyahRange } from '../src/features/memorization/logic';
import { LatestRequest } from '../src/services/quran/LatestRequest';
import { audioReducer, buildRepeatPlan, canPlayTrack, initialAudioSession } from '../src/services/audio/AudioEngine';
import type { QuizAnswer, QuizQuestion } from '../src/types/quiz';

test('Arabic school includes all 28 letters, forms, five tracing lessons and at least twenty questions', () => {
  assert.equal(arabicAlphabet.length, 28);
  assert.equal(new Set(arabicAlphabet.map(letter => letter.id)).size, 28);
  assert.equal(starterLessons.length, 5);
  assert.ok(starterLessons.every(letter => letter.tracePaths?.length));
  assert.ok(arabicAlphabet.every(letter => letter.forms.length === 4));
  assert.equal(arabicAlphabet.filter(letter => !letter.joinsNext).length, 6);
  assert.ok(sampleArabicQuestions.length >= 20);
});

test('quiz scoring retains denominator for unanswered questions and prevents incomplete completion', () => {
  const questions = letterQuiz(starterLessons[0]);
  const result = scoreQuiz(questions, { [questions[0].id]: 'alif' });
  assert.deepEqual(result, { correct: 1, total: 4, answered: 1, score: 25, complete: false });
  assert.equal(scoreQuiz([], {}).complete, false);
});

test('repeated answers and duplicate question IDs cannot create extra quiz points', () => {
  const question = letterQuiz(starterLessons[0])[0];
  const answers: Record<string, QuizAnswer> = { [question.id]: 'ba' };
  answers[question.id] = 'alif';
  answers[question.id] = 'alif';
  const result = scoreQuiz([question, question], answers);
  assert.equal(result.total, 1);
  assert.equal(result.correct, 1);
  assert.equal(result.score, 100);
});

test('all seven quiz types score deterministically and order/match reject incomplete answers', () => {
  const questions: QuizQuestion[] = [...letterQuiz(starterLessons[0]), ...practiceQuestions];
  assert.equal(new Set(questions.map(question => question.type)).size, 7);
  for (const question of questions) {
    const answer: QuizAnswer = question.type === 'match' ? Object.fromEntries(question.pairs.map(pair => [pair.id, pair.id]))
      : question.type === 'order' ? question.correctOrder : question.type === 'true-false' ? question.answer : question.correctOptionId;
    assert.ok(answerIsReady(question, answer));
    assert.ok(isCorrect(question, answer));
  }
  const match = practiceQuestions[0];
  assert.equal(answerIsReady(match, { alif: 'alif' }), false);
  assert.equal(scoreQuiz([match], { [match.id]: { alif: 'alif' } }).complete, false);
  assert.equal(isCorrect(match, { alif: 'alif', ba: 'alif', ta: 'ta' }), false);
  const order = practiceQuestions[2];
  assert.equal(isCorrect(order, ['ta', 'ba', 'alif']), false);
  assert.equal(answerIsReady(order, ['alif', 'alif', 'ta']), false);
  assert.equal(answerIsReady(order, ['unknown', 'ba', 'ta']), false);
});

test('audio never permits remote playback without parent consent, while local sources work offline', () => {
  assert.equal(canPlayTrack({ id: 'one', title: 'Ayah', uri: 'https://source.example/001001.mp3' }, false), false);
  assert.equal(canPlayTrack({ id: 'one', title: 'Ayah', uri: 'https://source.example/001001.mp3' }, true), true);
  assert.equal(canPlayTrack({ id: 'one', title: 'Ayah', uri: 'http://source.example/001001.mp3' }, true), false);
  assert.equal(canPlayTrack({ id: 'one', title: 'Ayah', uri: 'file:///app/content/001001.mp3' }, false), true);
  assert.equal(canPlayTrack({ id: 'one', title: 'Ayah', asset: 7 }, false), true);
  assert.equal(canPlayTrack(undefined, true), false);
});

test('audio repeat reducer counts one completion per play, waits, pauses and reaches target', () => {
  let state = audioReducer(initialAudioSession, { type: 'play' });
  state = audioReducer(state, { type: 'finish', repeat: 3 });
  assert.equal(state.phase, 'waiting');
  assert.equal(state.repetitions, 1);
  state = audioReducer(state, { type: 'finish', repeat: 3 });
  assert.equal(state.repetitions, 1);
  state = audioReducer(state, { type: 'pause' });
  assert.equal(state.phase, 'paused');
  state = audioReducer(state, { type: 'play' });
  assert.equal(state.phase, 'waiting');
  for (let index = 0; index < 2; index++) {
    state = audioReducer(state, { type: 'play' });
    state = audioReducer(state, { type: 'finish', repeat: 3 });
  }
  assert.equal(state.phase, 'complete');
  assert.equal(state.repetitions, 3);
  assert.equal(audioReducer(state, { type: 'restart' }).repetitions, 0);
  assert.equal(audioReducer(state, { type: 'move', index: 99, total: 2 }).trackIndex, 1);
});

test('unlimited repetitions remain waiting and never silently complete', () => {
  let state = initialAudioSession;
  for (let index = 0; index < 30; index++) {
    state = audioReducer(state, { type: 'play' });
    state = audioReducer(state, { type: 'finish', repeat: 'unlimited' });
    assert.equal(state.phase, 'waiting');
  }
  assert.equal(state.repetitions, 30);
});

test('continuous surah playback finishes repeats, pauses between ayahs and stops after the final ayah', () => {
  let state = initialAudioSession;
  for (let ayah = 0; ayah < 2; ayah++) {
    for (let repetition = 0; repetition < 3; repetition++) {
      state = audioReducer(state, {type:'play'});
      state = audioReducer(state, {type:'finish',repeat:3,continuous:true,total:2});
      assert.equal(state.trackIndex, ayah);
      assert.equal(state.repetitions, repetition + 1);
      assert.equal(state.phase, repetition < 2 ? 'waiting' : ayah === 0 ? 'advancing' : 'complete');
    }
    if (ayah === 0) {
      state = audioReducer(state, {type:'pause'});
      assert.equal(state.pausedFrom, 'advancing');
      const paused = state;
      assert.deepEqual(audioReducer(state, {type:'advance',total:2}), paused);
      state = audioReducer(state, {type:'play'});
      assert.equal(state.phase, 'advancing');
      state = audioReducer(state, {type:'advance',total:2});
      assert.equal(state.phase, 'loading');
      assert.equal(state.trackIndex, 1);
      assert.equal(state.repetitions, 0);
    }
  }
  assert.equal(state.phase, 'complete');
  assert.equal(audioReducer(audioReducer(initialAudioSession,{type:'play'}),{type:'finish',repeat:1,continuous:false,total:2}).phase,'complete');
});

test('unlimited repeats never advance even in continuous playback, and new tracks can pause while loading', () => {
  let state = audioReducer(initialAudioSession,{type:'play'});
  state = audioReducer(state,{type:'finish',repeat:'unlimited',continuous:true,total:2});
  assert.equal(state.phase,'waiting');
  assert.equal(state.trackIndex,0);
  state = audioReducer(audioReducer(initialAudioSession,{type:'play'}),{type:'finish',repeat:1,continuous:true,total:2});
  state = audioReducer(state,{type:'advance',total:2});
  state = audioReducer(state,{type:'pause'});
  assert.equal(state.phase,'paused');
  assert.equal(state.pausedFrom,'loading');
  assert.equal(audioReducer(state,{type:'play'}).phase,'loading');
});

test('native lock-screen resume keeps repeat counts and can finish the continuous sequence', () => {
  let state = audioReducer(initialAudioSession,{type:'play'});
  state = audioReducer(state,{type:'finish',repeat:3,continuous:true,total:2});
  state = audioReducer(state,{type:'pause'});
  state = audioReducer(state,{type:'native-play'});
  assert.equal(state.phase,'playing');
  assert.equal(state.repetitions,1);
  state = audioReducer(state,{type:'finish',repeat:3,continuous:true,total:2});
  assert.equal(state.repetitions,2);
  assert.equal(state.phase,'waiting');
  const completed = {...initialAudioSession,phase:'complete' as const,repetitions:3};
  assert.equal(audioReducer(completed,{type:'native-play'}).repetitions,0);
});

test('range repeat plan plays ayahs individually then together with pauses', () => {
  const plan = buildRepeatPlan(['107:1', '107:2'], 5, 3, 2);
  assert.deepEqual(plan.map(step => [step.trackIds, step.repetitions, step.pauseMs]), [
    [['107:1'], 5, 2000], [['107:2'], 5, 2000], [['107:1', '107:2'], 3, 2000],
  ]);
  let cursor = initialPlanCursor;
  const heard: string[] = [];
  while (!cursor.finished) {
    heard.push(plan[cursor.step].trackIds[cursor.track]);
    cursor = advancePlan(plan, cursor);
  }
  assert.deepEqual(heard, [...Array(5).fill('107:1'), ...Array(5).fill('107:2'), '107:1', '107:2', '107:1', '107:2', '107:1', '107:2']);
  assert.deepEqual(advancePlan(plan, cursor), cursor);
  assert.deepEqual(buildRepeatPlan([], 5), []);
  assert.equal(buildRepeatPlan(['1'], 3, 3, -10)[0].pauseMs, 0);
});

test('memorization levels stop at complete and masks do not mutate sourced Arabic', () => {
  assert.deepEqual(memorizationLevels, ['listen', 'read', 'repeat', 'hide', 'recite', 'complete']);
  assert.equal(nextMemorizationLevel('recite'), 'complete');
  assert.equal(nextMemorizationLevel('complete'), 'complete');
  const original = 'أَلف بَاء تَاء';
  const words = original.split(' ');
  assert.deepEqual(hiddenWordIndexes(words.length, 1), [0]);
  assert.deepEqual(hiddenWordIndexes(words.length, 2), [0, 1]);
  assert.deepEqual(hiddenWordIndexes(words.length, 3), [0, 1, 2]);
  assert.equal(words.join(' '), original);
});

test('Arabic-only quiz choices use Arabic rendering without switching English labels to RTL', () => {
  assert.equal(isArabicLabel('ب'), true);
  assert.equal(isArabicLabel('بَ ✓'), true);
  assert.equal(isArabicLabel('Ba'), false);
  assert.equal(isArabicLabel('Choose ب'), false);
});

test('ayah range selection preserves order and source objects, rejects missing starts and bounds ranges', () => {
  const ayahs = Array.from({length: 15}, (_, index) => ({key: `1:${index + 1}`, canonicalText: `Source fixture ${index + 1}`}));
  const range = selectAyahRange(ayahs, '1:2', '1:4');
  assert.deepEqual(range.map(ayah => ayah.key), ['1:2', '1:3', '1:4']);
  assert.equal(range[0], ayahs[1]);
  assert.equal(range[2].canonicalText, ayahs[3].canonicalText);
  assert.equal(selectAyahRange(ayahs, '1:1', '1:15').length, 10);
  assert.deepEqual(selectAyahRange(ayahs, '1:4', '1:2'), [ayahs[3]]);
  assert.deepEqual(selectAyahRange(ayahs, '1:2', 'unknown'), [ayahs[1]]);
  assert.deepEqual(selectAyahRange(ayahs, 'unknown', '1:2'), []);
});

test('late Quran chapter requests cannot replace newer selections or return after reader exit', () => {
  const guard = new LatestRequest();
  const first = guard.begin();
  const second = guard.begin();
  assert.equal(guard.isCurrent(first), false);
  assert.equal(guard.isCurrent(second), true);
  guard.cancel();
  assert.equal(guard.isCurrent(second), false);
});
