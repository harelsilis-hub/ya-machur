'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type Task = {
  id: string;
  name: string;
  completed: boolean;
  position?: number;
};

// --- AUTH PAGE SUB-COMPONENT ---
function AuthPage({ onAuthSuccess }: { onAuthSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setErrorMsg(error.message);
    else onAuthSuccess();
    setLoading(false);
  };

  const handleSignup = async () => {
    setLoading(true);
    setErrorMsg('');
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setErrorMsg(error.message);
    else alert("Success! Check your email to verify your account or directly login if auto-confirm is enabled.");
    setLoading(false);
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-6 bg-bg-deep text-white transition-all duration-1000">
      <div className="w-full max-w-sm flex flex-col items-center">
        <Image src="/logo.png" alt="Ya Machur" width={80} height={80} className="mb-6 rounded-2xl shadow-[0_0_20px_rgba(255,255,255,0.1)]" />
        <h1 className="text-3xl font-black tracking-tight mb-2">Ya Machur</h1>
        <p className="text-brand-neon font-bold text-sm uppercase tracking-widest opacity-80 mb-8">Login to Focus</p>
        
        {errorMsg && <div className="bg-red-500/10 border border-red-500 text-red-500 p-3 rounded-xl mb-6 text-sm w-full text-center">{errorMsg}</div>}

        <form onSubmit={handleLogin} className="w-full flex flex-col gap-4">
          <input type="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-neutral-900 border-2 border-neutral-800 focus:border-neutral-600 rounded-xl px-4 py-3 outline-none" />
          <input type="password" placeholder="Password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-neutral-900 border-2 border-neutral-800 focus:border-neutral-600 rounded-xl px-4 py-3 outline-none" />
          
          <button type="submit" disabled={loading} className="w-full bg-white text-black font-bold py-3 mt-2 rounded-xl hover:scale-[1.02] transition-transform">
            {loading ? 'Processing...' : 'Login'}
          </button>
        </form>
        <button type="button" onClick={handleSignup} disabled={loading} className="mt-4 text-neutral-500 hover:text-white font-bold text-sm uppercase tracking-widest transition-colors tracking-widest">
          Create Account
        </button>
      </div>
    </main>
  );
}

// Sortable Component Wrapper for Tasks
function SortableTaskItem({ task, action }: { task: Task; action: any }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 2 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={`group bg-neutral-900 border-l-4 border-brand-neon p-4 md:p-5 rounded-r-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-colors ${isDragging ? 'opacity-90 shadow-[0_0_30px_rgba(255,255,255,0.1)] scale-[1.02]' : 'hover:bg-neutral-800'}`}>
      <div className="flex items-center gap-3 w-full min-w-0">
        <button {...attributes} {...listeners} className="cursor-grab hover:text-white text-neutral-600 p-2 touch-none shrink-0" title="Drag to reorder">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 4h2v2H4zM4 9h2v2H4zM8 4h2v2H8zM8 9h2v2H8zM12 4h2v2h-2zM12 9h2v2h-2z" />
          </svg>
        </button>
        <span className="text-xl font-bold truncate pr-3">{task.name}</span>
      </div>
      <div className="flex items-center gap-2 md:gap-3 shrink-0 self-end md:self-auto">
        <button onClick={() => action({ action: 'start_session', taskId: task.id, mode: 'pomodoro' })} className="bg-brand-crimson/10 text-brand-crimson hover:bg-brand-crimson hover:text-white px-3 md:px-4 py-2 rounded-lg font-bold text-xs md:text-sm uppercase transition-colors tracking-wider whitespace-nowrap">
          Pomodoro
        </button>
        <button onClick={() => action({ action: 'start_session', taskId: task.id, mode: 'infinite' })} className="bg-neutral-800 text-white hover:bg-white hover:text-black px-3 md:px-4 py-2 rounded-lg font-bold text-xs md:text-sm uppercase transition-colors tracking-wider whitespace-nowrap">
          &infin; Focus
        </button>
        <button onClick={() => action({ action: 'toggle_task', taskId: task.id })} className="text-neutral-500 hover:text-brand-neon transition-colors p-2 text-2xl leading-none px-3" title="Mark Done">
          ✓
        </button>
        <button onClick={() => action({ action: 'delete_task', taskId: task.id })} className="text-neutral-600 hover:text-red-500 transition-colors p-2 text-2xl leading-none px-3" title="Delete">
          &times;
        </button>
      </div>
    </div>
  );
}

type ActiveSession = {
  taskId: string | null;
  taskName: string;
  mode: 'infinite' | 'pomodoro';
  phase: 'work' | 'break';
  endTime: number | null;
};

type AppState = {
  tasks: Task[];
  activeSession: ActiveSession | null;
};

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState(true);
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Custom timer logic for frontend
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthChecking(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchState = async () => {
    if (!user) return;
    try {
      // 1. Fetch backend settings state for active session tracking
      const res = await fetch(`/api/task?userId=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setActiveSession(data.activeSession);
      }
      
      // 2. Fetch all existing tasks tightly from Supabase DB on load directly
      const { data: latestTasks, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('position', { ascending: true }) // First ordering by custom drag-drop array
        .order('created_at', { ascending: true }); // Appends naturally backwards for logical chronologics
        
      if (!error && latestTasks) {
        setTasks(latestTasks);
      }
    } catch (e) {
      console.error("Fetch State Error:", e);
    } finally {
      if (loading) setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchState();
      // Poll the backend settings frequently to detect break transitions accurately
      const interval = setInterval(fetchState, 1000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const stateRef = useRef({ tasks, activeSession });
  useEffect(() => {
    stateRef.current = { tasks, activeSession };
  }, [tasks, activeSession]);

  const transitioningRef = useRef(false);

  useEffect(() => {
    // 1-second ticks for visual countdown and backend trigger engine
    const timerInterval = setInterval(() => {
      const currentNow = Date.now();
      setNow(currentNow);
      
      const session = stateRef.current?.activeSession;
      if (session?.endTime && currentNow >= session.endTime && !transitioningRef.current && user) {
        transitioningRef.current = true;
        fetch('/api/task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'transition_timer', userId: user.id }),
        }).then(res => res.json()).then(data => {
          setActiveSession(data.activeSession);
        }).finally(() => {
          transitioningRef.current = false;
        });
      }
    }, 1000);
    return () => clearInterval(timerInterval);
  }, [user]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    if (!user) return;
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = tasks.findIndex(t => t.id === active.id);
      const newIndex = tasks.findIndex(t => t.id === over.id);
      
      const newTasks = arrayMove(tasks, oldIndex, newIndex);
      const updatedTasks = newTasks.map((t, index) => ({ ...t, position: index }));
      
      // Immediate UI positional shift
      setTasks(updatedTasks);
      
      // Silent Deep DB shift Upsert
      const payload = updatedTasks.map(t => ({ id: t.id, user_id: user.id, position: t.position, name: t.name, completed: t.completed }));
      const { error } = await supabase.from('tasks').upsert(payload, { onConflict: 'id' });
      if (error) console.error("Reorder Failed:", error);
    }
  };

  const prevPhaseRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const currentPhase = activeSession?.phase;
    const prevPhase = prevPhaseRef.current;
    
    if (currentPhase !== prevPhase) {
      if ((currentPhase === 'break' && prevPhase === 'work') || (currentPhase === 'work' && prevPhase === 'break')) {
        const isBreakStart = currentPhase === 'break';
        const title = isBreakStart ? 'Time is up!' : 'Break is over!';
        const body = isBreakStart ? 'Stop working and take a break.' : 'Back to work!';
        
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(title, { body });
        }
        
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.play().catch(e => console.error("Audio blocked:", e));
      }
    }
    prevPhaseRef.current = currentPhase;
  }, [activeSession?.phase]);

  const action = async (payload: { action: string, taskId?: string, mode?: string }) => {
    if (!user) return;
    setLoading(true);
    try {
      // Backend handling for Sessions
      if (['start_session', 'stop_session', 'transition_timer'].includes(payload.action)) {
        await fetch('/api/task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, userId: user.id }),
        });
      }

      // Direct Supabase handling for Tasks
      if (payload.action === 'toggle_task' && payload.taskId) {
        const target = tasks.find(t => t.id === payload.taskId);
        if (target) {
          // Optimistic UI update
          setTasks(prev => prev.map(t => t.id === payload.taskId ? { ...t, completed: !t.completed } : t));
          const { error } = await supabase.from('tasks').update({ completed: !target.completed }).eq('id', payload.taskId).eq('user_id', user.id);
          if (error) {
             console.error("TOGGLE ERORR:", error);
             alert(`Database Update Failed: ${error.message || 'Check if "completed" column exists!'}`);
          }
        }
      } else if (payload.action === 'delete_task' && payload.taskId) {
        setTasks(prev => prev.filter(t => t.id !== payload.taskId)); // Optimistic delete
        const { error } = await supabase.from('tasks').delete().eq('id', payload.taskId).eq('user_id', user.id);
        if (error) {
             console.error("DELETE ERORR:", error);
             alert(`Database Delete Failed: ${error.message}`);
        }
      }
      
      // Resynchronize backend engine cleanly
      await fetchState();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !user) return;
    
    const newTaskName = inputText.trim();
    setInputText('');
    setLoading(true);
    
    // Automatically shove position dynamically
    const nextPosition = tasks.length > 0 ? Math.max(...tasks.map(t => typeof t.position === 'number' ? t.position : 0)) + 1 : 0;
    
    // Direct Database Insert
    const { data: newTasks, error } = await supabase
      .from('tasks')
      .insert([{ name: newTaskName, position: nextPosition, user_id: user.id }])
      .select();
      
    if (error) {
      console.error("FAILED TO INSERT TASK.");
      console.dir(error);
      alert(`Supabase Database blocked the insert: ${error.message || 'Check if "user_id" column exists in DB!'}`);
    }
    if (!error && newTasks && newTasks.length > 0) {
      // Immediate UI update, append to BOTTOM!
      setTasks(prev => [...prev, newTasks[0]]);
    }
    
    setLoading(false);
  };

  const calculateTimeLeft = (endTime: number | null) => {
    if (!endTime) return '';
    const diff = endTime - now;
    if (diff <= 0) return '00:00';
    const totalSeconds = Math.floor(diff / 1000);
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (authChecking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg-deep text-white">
        <div className="animate-pulse opacity-50 font-medium tracking-widest uppercase">Connecting to Cloud...</div>
      </main>
    );
  }

  if (!user) {
    return <AuthPage onAuthSuccess={() => fetchState()} />;
  }

  if (loading && tasks.length === 0 && !activeSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg-deep text-white">
        <div className="animate-pulse opacity-50 font-medium tracking-widest uppercase">Initializing Vault...</div>
      </main>
    );
  }

  const isPomodoro = activeSession?.mode === 'pomodoro';
  const isBreak = activeSession?.phase === 'break';
  // Determine aggressive background color dynamically
  const bgColor = activeSession 
    ? (isBreak ? 'bg-white text-black' : 'bg-black text-white') 
    : 'bg-bg-deep text-white';

  return (
    <main className={`flex min-h-screen items-center justify-center px-6 py-12 transition-all duration-1000 overflow-y-auto ${bgColor}`}>
      {!activeSession ? (
        <div className="w-full max-w-3xl transform scale-100 opacity-100 transition-all">
          <div className="mb-10 text-center flex flex-col items-center">
            <div className="flex items-center gap-4 mb-3">
              <Image src="/logo.png" alt="Ya Machur Logo" width={64} height={64} className="rounded-2xl shadow-[0_0_15px_rgba(255,255,255,0.1)] pointer-events-none" />
              <h1 className="text-4xl md:text-5xl font-black tracking-tight opacity-90">Ya Machur</h1>
            </div>
            <div className="flex items-center justify-center gap-3">
              <p className="text-brand-neon font-bold text-sm uppercase tracking-widest opacity-80">Dashboard &bull; Free to Scroll</p>
              <Link href="/setup" className="bg-neutral-800 text-white hover:bg-white hover:text-black px-3 py-1 rounded-md text-xs font-bold uppercase transition-colors tracking-widest">
                Setup
              </Link>
              <button onClick={handleLogout} className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white px-3 py-1 rounded-md text-xs font-bold uppercase transition-colors tracking-widest">
                Logout
              </button>
            </div>
          </div>
          
          <form onSubmit={handleAddTask} className="flex gap-4 mb-10 w-full">
            <input
              type="text"
              required
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="What must be done?"
              className="flex-1 bg-neutral-900 border-2 border-neutral-800 focus:border-neutral-600 rounded-xl px-4 md:px-6 py-4 text-lg md:text-xl outline-none transition-all placeholder:text-neutral-600 focus:ring-4 focus:ring-brand-neon/10"
              autoComplete="off"
            />
            <button 
              type="submit"
              disabled={!inputText.trim() || loading}
              className="bg-white text-black font-bold px-6 md:px-8 rounded-xl hover:scale-[1.03] active:scale-95 transition-all outline-none shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_20px_rgba(255,255,255,0.2)] disabled:opacity-50"
            >
              Add
            </button>
          </form>

          <div className="space-y-8">
            {/* Active Tasks */}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <div className="space-y-4">
                <SortableContext items={tasks.filter(t => !t.completed).map(t => t.id)} strategy={verticalListSortingStrategy}>
                  {tasks.filter(t => !t.completed).map(task => (
                    <SortableTaskItem key={task.id} task={task} action={action} />
                  ))}
                </SortableContext>
                {tasks.filter(t => !t.completed).length === 0 && (
                  <div className="text-center text-neutral-600 py-10 italic border-2 border-dashed border-neutral-800 rounded-xl font-medium tracking-wide">Nothing to do. Add a task above.</div>
                )}
              </div>
            </DndContext>

            {/* Completed Tasks */}
            {tasks.filter(t => t.completed).length > 0 && (
              <div className="pt-6 border-t border-neutral-800">
                <h3 className="text-neutral-500 font-bold uppercase tracking-widest text-sm mb-4">Completed</h3>
                <div className="space-y-3">
                  {tasks.filter(t => t.completed).map(task => (
                    <div key={task.id} className="group bg-neutral-950/50 p-4 rounded-xl flex items-center justify-between opacity-50 hover:opacity-100 transition-opacity">
                      <span className="text-lg font-medium line-through text-neutral-500 truncate pr-4">{task.name}</span>
                      <div className="flex items-center gap-3 shrink-0">
                        <button onClick={() => action({ action: 'toggle_task', taskId: task.id })} className="text-neutral-500 hover:text-white transition-colors text-xs uppercase font-bold tracking-widest px-2">
                          Undo
                        </button>
                        <button onClick={() => action({ action: 'delete_task', taskId: task.id })} className="text-neutral-600 hover:text-red-500 transition-colors text-xl leading-none px-2">
                          &times;
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="w-full max-w-5xl text-center space-y-12 transform scale-100 opacity-100 transition-all">
          {isBreak ? (
            <div className="space-y-8">
              <h2 className="font-black tracking-tighter leading-tight break-words px-4 text-6xl md:text-8xl text-green-500 animate-pulse">
                BREAK TIME!<br/>GO TO SCROLL
              </h2>
              <div className="tabular-nums font-black tracking-tighter text-6xl md:text-8xl opacity-80">
                {calculateTimeLeft(activeSession.endTime)}
              </div>
            </div>
          ) : (
            <>
              <div>
                <div className="font-bold uppercase tracking-[0.4em] text-sm md:text-md mb-8 animate-pulse text-brand-crimson">
                  {isPomodoro ? 'Pomodoro Work Phase' : 'Infinite Focus'}
                </div>
                
                <h2 className="font-black tracking-tighter leading-tight break-words px-4 text-4xl md:text-6xl text-white">
                  {activeSession.taskName}
                </h2>
              </div>
              
              {isPomodoro && (
                <div className="tabular-nums font-black tracking-tighter leading-none py-8 text-[6rem] md:text-[12rem] text-white">
                  {calculateTimeLeft(activeSession.endTime)}
                </div>
              )}
            </>
          )}

          <div className="flex flex-col items-center gap-8 pt-8">
            <button 
              onClick={() => action({ action: 'stop_session' })}
              disabled={loading}
              className={`group relative inline-flex items-center justify-center font-black text-xl md:text-3xl px-12 py-6 rounded-3xl hover:scale-105 active:scale-95 transition-all overflow-hidden ${
                isBreak 
                  ? 'bg-neutral-200 hover:bg-neutral-300 text-black shadow-[0_0_40px_rgba(0,0,0,0.1)]' 
                  : 'bg-brand-crimson hover:bg-red-600 text-white shadow-[0_0_40px_rgba(255,7,58,0.4)]'
              }`}
            >
              <span className="relative z-10 transition-transform group-hover:scale-110 duration-300">
                {isBreak ? "Skip Break" : "I'M DONE"}
              </span>
              <div className="absolute inset-0 h-full w-full bg-white/20 scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300"></div>
            </button>
            
            {!isBreak && (
              <button 
                onClick={() => action({ action: 'stop_session' })}
                disabled={loading}
                className="text-neutral-600 hover:text-white transition-colors text-sm font-medium uppercase tracking-widest"
              >
                Cancel Task
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
