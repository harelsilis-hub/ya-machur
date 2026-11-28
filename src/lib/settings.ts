import type { SupabaseClient } from '@supabase/supabase-js';

// Columns added by supabase/migrations/20261127_session_sync.sql. If that migration
// hasn't been run yet, writes are retried without them so the app keeps working
// (cross-device XP sync is then unavailable until the columns exist).
const NEW_COLUMNS = ['session_focus_ms', 'session_started_at', 'session_paused_at'] as const;

type Fields = Record<string, unknown>;

const missingColumn = (error: { code?: string; message?: string } | null) =>
  !!error && (error.code === 'PGRST204' || /session_(focus_ms|started_at|paused_at)/.test(error.message ?? ''));

const stripNew = (f: Fields) => {
  const copy = { ...f };
  for (const c of NEW_COLUMNS) delete copy[c];
  return copy;
};

export async function upsertSettings(supabase: SupabaseClient, userId: string, fields: Fields) {
  const run = (f: Fields) => supabase.from('settings').upsert({ user_id: userId, ...f }, { onConflict: 'user_id' });
  let { error } = await run(fields);
  if (missingColumn(error)) ({ error } = await run(stripNew(fields)));
  if (error) console.error('settings upsert error:', error);
  return !error;
}

/**
 * Update the row only if it still matches `match` (optimistic concurrency, so two devices
 * firing the same transition at once apply it only once). Returns true if a row changed.
 */
export async function updateSettingsIf(supabase: SupabaseClient, userId: string, fields: Fields, match: Fields) {
  const run = async (f: Fields) => {
    let q = supabase.from('settings').update(f).eq('user_id', userId);
    for (const [k, v] of Object.entries(match)) q = v === null ? q.is(k, null) : q.eq(k, v as string | number);
    return q.select('user_id');
  };
  let { data, error } = await run(fields);
  if (missingColumn(error)) ({ data, error } = await run(stripNew(fields)));
  if (error) console.error('settings update error:', error);
  return !error && (data?.length ?? 0) > 0;
}

export const CLEARED_SESSION: Fields = {
  is_active: false,
  active_task_id: null,
  active_task_name: null,
  session_mode: null,
  session_phase: null,
  session_end_time: null,
  session_focus_ms: 0,
  session_started_at: null,
  session_paused_at: null,
};
