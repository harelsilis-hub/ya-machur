import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { isTimedMode, phaseDuration, type SessionMode, type SessionPhase } from '@/lib/session';
import { schedulePhaseEnd, cancelPhaseEnd } from '@/lib/notify';
import { upsertSettings, updateSettingsIf, CLEARED_SESSION } from '@/lib/settings';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
if (!supabaseUrl || supabaseUrl === 'https://x.supabase.co') console.error('SUPABASE ENV MISSING!');

export const dynamic = 'force-dynamic';

async function getAppState(userId: string, supabase: SupabaseClient) {
  const [{ data: tasks, error: taskError }, { data: settings, error: settingError }] = await Promise.all([
    supabase.from('tasks').select('*').eq('user_id', userId).order('position', { ascending: true }).order('created_at', { ascending: true }),
    supabase.from('settings').select('*').eq('user_id', userId).single()
  ]);

  if (taskError) console.error("Tasks fetch error:", taskError);
  if (settingError && settingError.code !== 'PGRST116') console.error("Settings fetch error:", settingError);

  let activeSession = null;
  if (settings && settings.is_active) {
    activeSession = {
      taskId: settings.active_task_id,
      taskName: settings.active_task_name,
      mode: settings.session_mode,
      phase: settings.session_phase,
      endTime: settings.session_end_time ? Number(settings.session_end_time) : null,
      focusMs: Number(settings.session_focus_ms ?? 0),
      startedAt: settings.session_started_at ? Number(settings.session_started_at) : null,
    };
  }

  return {
    tasks: tasks || [],
    activeSession,
    serverNow: Date.now(),
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
  }

  const supabase = getSupabaseServer(req);
  const state = await getAppState(userId, supabase);
  return NextResponse.json(state, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const action = body.action;
  const userId = body.userId;

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
  }

  const supabase = getSupabaseServer(req);
  const appUrl = new URL(req.url).origin;
  const loadSettings = async () =>
    (await supabase.from('settings').select('*').eq('user_id', userId).single()).data;

  if (action === 'start_session') {
    const { data: task } = await supabase.from('tasks').select('*').eq('id', body.taskId).eq('user_id', userId).single();
    if (task) {
      const mode: SessionMode = body.mode === 'pomodoro' ? 'pomodoro' : 'infinite';
      const now = Date.now();
      const endTime = isTimedMode(mode) ? now + phaseDuration(mode, 'work') : null;
      await upsertSettings(supabase, userId, {
        is_active: true,
        active_task_id: task.id,
        active_task_name: task.name,
        session_mode: mode,
        session_phase: 'work',
        session_end_time: endTime,
        session_focus_ms: 0,
        session_started_at: now,
      });
      if (endTime) await schedulePhaseEnd(userId, 'work', endTime, appUrl);
    }
  } else if (action === 'stop_session') {
    const settings = await loadSettings();
    await cancelPhaseEnd(userId, settings?.session_end_time);
    await upsertSettings(supabase, userId, CLEARED_SESSION);
  } else if (action === 'transition_timer') {
    // The running phase's clock hit zero: move to the next phase but DON'T start its
    // clock. It waits (end_time = NULL) until someone presses Start on any device.
    // The phone notification was already scheduled when the phase started.
    const settings = await loadSettings();
    const end = settings?.session_end_time ? Number(settings.session_end_time) : null;
    if (settings?.is_active && end && Date.now() >= end - 500) {
      const mode = settings.session_mode as SessionMode;
      const finishedWork = settings.session_phase === 'work';
      await updateSettingsIf(supabase, userId, {
        session_phase: finishedWork ? 'break' : 'work',
        session_end_time: null,
        ...(finishedWork ? { session_focus_ms: Number(settings.session_focus_ms ?? 0) + phaseDuration(mode, 'work') } : {}),
      }, { session_end_time: settings.session_end_time });
    }
  } else if (action === 'start_phase') {
    // User pressed Start: begin the clock of the waiting phase.
    const settings = await loadSettings();
    if (settings?.is_active && isTimedMode(settings.session_mode) && !settings.session_end_time) {
      const phase = settings.session_phase as SessionPhase;
      const endTime = Date.now() + phaseDuration(settings.session_mode as SessionMode, phase);
      const changed = await updateSettingsIf(supabase, userId, { session_end_time: endTime }, { session_end_time: null, session_phase: phase });
      if (changed) await schedulePhaseEnd(userId, phase, endTime, appUrl);
    }
  } else if (action === 'skip_break') {
    // End the break (running or waiting) and start the next focus block right away.
    const settings = await loadSettings();
    if (settings?.is_active && isTimedMode(settings.session_mode) && settings.session_phase === 'break') {
      const endTime = Date.now() + phaseDuration(settings.session_mode as SessionMode, 'work');
      const changed = await updateSettingsIf(
        supabase, userId,
        { session_phase: 'work', session_end_time: endTime },
        { session_phase: 'break', session_end_time: settings.session_end_time ?? null },
      );
      if (changed) {
        await cancelPhaseEnd(userId, settings.session_end_time);
        await schedulePhaseEnd(userId, 'work', endTime, appUrl);
      }
    }
  }

  const newState = await getAppState(userId, supabase);
  return NextResponse.json(newState);
}
