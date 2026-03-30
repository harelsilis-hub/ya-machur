import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
if (!supabaseUrl || supabaseUrl === 'https://x.supabase.co') console.error('SUPABASE ENV MISSING!');

export const dynamic = 'force-dynamic';

const POMODORO_WORK_MS = 25 * 60 * 1000; 
const POMODORO_BREAK_MS = 5 * 60 * 1000;
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://ntfy.sh/yamachur-alerts';

function sendWebhook(message: string) {
  fetch(WEBHOOK_URL, {
    method: 'POST',
    body: message,
    headers: { 'Title': 'Ya Machur', 'Priority': 'high' }
  }).catch(err => console.error("Webhook error:", err));
}

async function getAppState(userId: string) {
  const [{ data: tasks, error: taskError }, { data: settings, error: settingError }] = await Promise.all([
    supabase.from('tasks').select('*').eq('user_id', userId).order('position', { ascending: true }).order('created_at', { ascending: true }),
    supabase.from('settings').select('*').eq('user_id', userId).single()
  ]);

  if (taskError) console.error("Tasks fetch error:", taskError);
  if (settingError && settingError.code !== 'PGRST116') console.error("Settings fetch error:", settingError);

  let activeSession = null;
  if (settings && settings.active_task_id && settings.is_active) {
    activeSession = {
      taskId: settings.active_task_id,
      taskName: settings.active_task_name,
      mode: settings.session_mode,
      phase: settings.session_phase,
      endTime: settings.session_end_time ? Number(settings.session_end_time) : null
    };
  }

  return {
    tasks: tasks || [],
    activeSession
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  
  if (!userId) {
    return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
  }

  const state = await getAppState(userId);
  return NextResponse.json(state);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const action = body.action;
  const userId = body.userId;

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
  }

  if (action === 'start_session') {
    const { data: task } = await supabase.from('tasks').select('*').eq('id', body.taskId).eq('user_id', userId).single();
    if (task) {
      const { error } = await supabase.from('settings').upsert({
        user_id: userId,
        is_active: true,
        active_task_id: task.id,
        active_task_name: task.name,
        session_mode: body.mode,
        session_phase: 'work',
        session_end_time: body.mode === 'pomodoro' ? Date.now() + POMODORO_WORK_MS : null
      });
      if (error) console.error("Session UPSERT Error:", error);
    }
  } else if (action === 'stop_session') {
    await supabase.from('settings').upsert({
      user_id: userId,
      is_active: false,
      active_task_id: null,
      active_task_name: null,
      session_mode: null,
      session_phase: null,
      session_end_time: null
    });
  } else if (action === 'transition_timer') {
    const { data: settings } = await supabase.from('settings').select('*').eq('user_id', userId).single();
    
    if (settings && settings.session_end_time && Date.now() >= Number(settings.session_end_time) - 500) {
      if (settings.session_phase === 'work') {
        const nextTime = Date.now() + POMODORO_BREAK_MS;
        await supabase.from('settings').update({
          session_phase: 'break',
          session_end_time: nextTime
        }).eq('user_id', userId);
        sendWebhook(`Pomodoro finished! 5-minute break started for: ${settings.active_task_name}`);
      } else if (settings.session_phase === 'break') {
        const nextTime = Date.now() + POMODORO_WORK_MS;
        await supabase.from('settings').update({
          session_phase: 'work',
          session_end_time: nextTime
        }).eq('user_id', userId);
        sendWebhook(`Break is over! Time to get back to work on: ${settings.active_task_name}`);
      }
    }
  }

  const newState = await getAppState(userId);
  return NextResponse.json(newState);
}
