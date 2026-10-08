export type RepeatCount = 1 | 3 | 5 | 10 | 'unlimited';
export interface AudioTrack { id: string; title: string; uri?: string; asset?: number; sourceLabel?: string }
export type PlaybackPhase = 'idle' | 'playing' | 'paused' | 'waiting' | 'advancing' | 'loading' | 'complete' | 'error';
export interface AudioSession { phase: PlaybackPhase; trackIndex: number; repetitions: number; error?: string; pausedFrom?: 'waiting' | 'advancing' | 'loading' }
export const initialAudioSession: AudioSession = { phase: 'idle', trackIndex: 0, repetitions: 0 };

export type AudioAction =
  | { type: 'play' }
  | { type: 'native-play' }
  | { type: 'pause' }
  | { type: 'finish'; repeat: RepeatCount; continuous?: boolean; total?: number }
  | { type: 'advance'; total: number }
  | { type: 'restart' }
  | { type: 'move'; index: number; total: number }
  | { type: 'error'; message: string };

export function audioReducer(state: AudioSession, action: AudioAction): AudioSession {
  switch (action.type) {
    case 'play': return { ...state, phase: state.phase === 'paused' && state.pausedFrom ? state.pausedFrom : 'playing', pausedFrom: undefined, error: undefined };
    case 'native-play': return { ...state, phase: 'playing', pausedFrom: undefined, error: undefined,
      repetitions: state.phase === 'complete' ? 0 : state.repetitions };
    case 'pause': return { ...state, phase: 'paused', pausedFrom: state.phase === 'waiting' || state.phase === 'advancing' || state.phase === 'loading' ? state.phase : state.pausedFrom };
    case 'restart': return { ...state, phase: 'playing', pausedFrom: undefined, repetitions: 0, error: undefined };
    case 'move': return { phase: 'idle', trackIndex: Math.max(0, Math.min(action.total - 1, action.index)), repetitions: 0 };
    case 'error': return { ...state, phase: 'error', pausedFrom: undefined, error: action.message };
    case 'advance': {
      if (state.phase !== 'advancing') return state;
      if (state.trackIndex + 1 >= action.total) return { ...state, phase: 'complete' };
      return { phase: 'loading', trackIndex: state.trackIndex + 1, repetitions: 0 };
    }
    case 'finish': {
      // A repeated native completion event must not count the same playback twice.
      if (state.phase !== 'playing') return state;
      const repetitions = state.repetitions + 1;
      const needsRepeat = action.repeat === 'unlimited' || repetitions < action.repeat;
      return { ...state, repetitions, pausedFrom: undefined,
        phase: needsRepeat ? 'waiting' : action.continuous && state.trackIndex + 1 < (action.total ?? 1) ? 'advancing' : 'complete' };
    }
  }
}

/** No remote source is passed to the native player before parental opt-in. */
export function canPlayTrack(track: AudioTrack | undefined, networkAllowed: boolean): boolean {
  if (!track) return false;
  if (typeof track.asset === 'number') return true;
  if (!track.uri) return false;
  if (/^(file|content|asset):\/\//i.test(track.uri)) return true;
  return networkAllowed && /^https:\/\//i.test(track.uri);
}

export interface RepeatPlanStep { trackIds: string[]; repetitions: Exclude<RepeatCount, 'unlimited'>; pauseMs: number }

/** Grouped steps model "ayah 1 x 5, ayah 2 x 5, ayah 1–2 x 3" without altering audio. */
export function buildRepeatPlan(trackIds: string[], repetitions: 1 | 3 | 5 | 10, groupRepeats = 3, pauseSeconds = 2): RepeatPlanStep[] {
  const unique = [...new Set(trackIds)];
  if (!unique.length) return [];
  const pauseMs = Math.max(0, Math.min(30, pauseSeconds)) * 1000;
  const steps: RepeatPlanStep[] = unique.map(id => ({ trackIds: [id], repetitions, pauseMs }));
  if (unique.length > 1) steps.push({ trackIds: unique, repetitions: ([1, 3, 5, 10].includes(groupRepeats) ? groupRepeats : 3) as 1 | 3 | 5 | 10, pauseMs });
  return steps;
}
