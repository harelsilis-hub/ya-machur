// Shared (client + server) session timing rules.
//
// A timed session (pomodoro / tamagotchi_pomodoro) is stored in the `settings` row as:
//   session_phase     'work' | 'break'
//   session_end_time  ms timestamp while the phase clock is running, NULL while it is
//                     waiting for the user to press Start (phases never auto-start).
//   session_focus_ms  focus time banked from completed work phases.
//   session_started_at  when the session began (used by open-ended tamagotchi sessions).
//   session_paused_at   ms timestamp of the pause, NULL when not paused. While paused,
//                       end_time / started_at stay as they were; on resume both are shifted
//                       forward by the paused duration.
// Every device derives its display from that row, so all devices stay in sync.

export type SessionMode = 'infinite' | 'pomodoro' | 'tamagotchi' | 'tamagotchi_pomodoro';
export type SessionPhase = 'work' | 'break';

const MIN = 60 * 1000;

export const WORK_MS: Partial<Record<SessionMode, number>> = {
  pomodoro: 25 * MIN,
  tamagotchi_pomodoro: 50 * MIN,
};

export const BREAK_MS: Partial<Record<SessionMode, number>> = {
  pomodoro: 5 * MIN,
  tamagotchi_pomodoro: 10 * MIN,
};

export const isTimedMode = (mode: string | null | undefined): boolean =>
  mode === 'pomodoro' || mode === 'tamagotchi_pomodoro';

export const phaseDuration = (mode: SessionMode, phase: SessionPhase): number =>
  (phase === 'work' ? WORK_MS[mode] : BREAK_MS[mode]) ?? 0;

/** While paused the clock is frozen at the moment of the pause. */
export const effectiveNow = (s: { pausedAt?: number | null }, now: number): number =>
  s.pausedAt ? Math.min(now, s.pausedAt) : now;

/** Total focused milliseconds of a session at time `now` (breaks and waiting don't count). */
export function focusMsAt(
  s: { mode: SessionMode; phase: SessionPhase; endTime: number | null; focusMs?: number; startedAt?: number | null; pausedAt?: number | null },
  now: number,
): number {
  now = effectiveNow(s, now);
  let ms = s.focusMs ?? 0;
  if (s.phase !== 'work') return ms;
  if (s.endTime) {
    const total = phaseDuration(s.mode, 'work');
    ms += Math.min(total, Math.max(0, total - (s.endTime - now)));
  } else if (!isTimedMode(s.mode) && s.startedAt) {
    ms += Math.max(0, now - s.startedAt);
  }
  return ms;
}

export const NTFY_SERVER = (process.env.NEXT_PUBLIC_NTFY_SERVER || 'https://ntfy.sh').replace(/\/$/, '');

/** Per-user ntfy topic the phone subscribes to. */
export const ntfyTopic = (userId: string) => `yamachur-${userId}`;
