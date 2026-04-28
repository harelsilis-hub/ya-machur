'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type Task = {
  id: string;
  name: string;
  completed: boolean;
  position?: number;
};

type Pet = {
  id: string;
  user_id: string;
  name: string;
  species: 'bird' | 'cat' | 'dragon' | 'robot' | 'ocean';
  status: 'active' | 'retired';
  evolution_stage: 'egg' | 'baby' | 'adult';
  current_xp: number;
  sessions_survived: number;
  created_at: string;
  retired_at?: string | null;
};

type ActiveSession = {
  taskId: string | null;
  taskName: string;
  mode: 'infinite' | 'pomodoro' | 'tamagotchi';
  phase: 'work' | 'break';
  endTime: number | null;
};

type TamagotchiSession = {
  startTime: number;
  potentialXP: number;
};

type HonorModalState = 'hidden' | 'asking' | 'focused_success' | 'broke_death' | 'retired' | 'evolved';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const XP_EGG_TO_BABY    = 300;    // 30 min focus
const XP_BABY_TO_ADULT  = 1200;   // 2 h cumulative
const XP_ADULT_TO_RETIRE = 3000;  // 5 h cumulative

const PET_SPECIES_DATA: Record<Pet['species'], Record<Pet['evolution_stage'], string>> = {
  bird: { egg: '🥚', baby: '🐣', adult: '🐔' },
  cat: { egg: '📦', baby: '🐱', adult: '🦁' },
  dragon: { egg: '💎', baby: '🦎', adult: '🐉' },
  robot: { egg: '💾', baby: '🤖', adult: '🛸' },
  ocean: { egg: '🫧', baby: '🦭', adult: '🐋' },
};

function getPetEmoji(pet: Pet | null | undefined): string {
  if (!pet) return '🥚';
  const species = pet.species || 'bird';
  return PET_SPECIES_DATA[species][pet.evolution_stage];
}

const PET_LABEL: Record<Pet['evolution_stage'], string> = {
  egg: 'Egg',
  baby: 'Baby',
  adult: 'Adult',
};

function xpToNextStage(stage: Pet['evolution_stage'], xp: number): number {
  if (stage === 'egg') return XP_EGG_TO_BABY - xp;
  if (stage === 'baby') return XP_BABY_TO_ADULT - xp;
  return XP_ADULT_TO_RETIRE - xp;
}

function formatElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// ─────────────────────────────────────────────
// Auth Page
// ─────────────────────────────────────────────

function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    if (mode === 'signup' && (!email || password.length < 6)) {
      setErrorMsg('Email is required and Password must be at least 6 characters.');
      return;
    }
    if (mode === 'signup' && password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setErrorMsg(error.message);
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setErrorMsg(error.message);
      else {
        setSuccessMsg('Account created! You can now log in.');
        setMode('login');
        setPassword('');
        setConfirmPassword('');
      }
    }
    setLoading(false);
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-6 bg-glass-scene text-white transition-all duration-1000">
      <div className="w-full max-w-sm flex flex-col items-center glass-card p-8 glow-purple-sm">
        <Image
          src="/logo.png"
          priority
          alt="Ya Machur"
          width={80}
          height={80}
          className={`mb-6 rounded-2xl transition-all duration-500 ${mode === 'signup' ? 'glow-purple' : 'glow-purple-sm'}`}
        />
        <h1 className="text-3xl font-black tracking-tight mb-2 gradient-text">Ya Machur</h1>
        <p className={`font-bold text-sm uppercase tracking-widest opacity-80 mb-8 transition-colors ${mode === 'signup' ? 'text-glass-cyan' : 'text-neutral-400'}`}>
          {mode === 'login' ? 'Login to Focus' : 'Join the Protocol'}
        </p>

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl mb-6 text-sm w-full text-center">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="bg-glass-cyan/10 border border-glass-cyan/30 text-glass-cyan p-3 rounded-xl mb-6 text-sm w-full text-center font-bold">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email Address"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full glass-input px-4 py-3"
          />
          <input
            type="password"
            placeholder={mode === 'signup' ? 'Create Password (min 6)' : 'Password'}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full glass-input px-4 py-3"
          />
          {mode === 'signup' && (
            <input
              type="password"
              placeholder="Confirm Password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full glass-input px-4 py-3"
            />
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full font-bold py-4 mt-2 rounded-xl transition-all btn-primary text-white disabled:opacity-50 uppercase tracking-widest text-sm"
          >
            {loading ? 'Processing...' : (mode === 'login' ? 'Login' : 'Create Account')}
          </button>
        </form>

        <button
          type="button"
          onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setErrorMsg(''); setSuccessMsg(''); setConfirmPassword(''); }}
          disabled={loading}
          className="mt-6 text-neutral-500 hover:text-white font-bold text-sm uppercase tracking-widest transition-colors"
        >
          {mode === 'login' ? 'Create Account' : '← Back to Login'}
        </button>
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────
// Sortable Task Item
// ─────────────────────────────────────────────

function SortableTaskItem({ task, action }: { task: Task; action: (p: { action: string; taskId?: string; mode?: string }) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 2 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group glass-card p-4 md:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all duration-300 ${isDragging ? 'opacity-90 glow-purple scale-[1.02]' : 'glass-card-hover'}`}
    >
      <div className="flex items-center gap-3 w-full min-w-0">
        <button {...attributes} {...listeners} className="cursor-grab hover:text-white text-neutral-500 p-2 touch-none shrink-0" title="Drag to reorder">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 4h2v2H4zM4 9h2v2H4zM8 4h2v2H8zM8 9h2v2H8zM12 4h2v2h-2zM12 9h2v2h-2z" />
          </svg>
        </button>
        <span className="text-lg font-semibold truncate pr-3 text-white/90">{task.name}</span>
      </div>
      <div className="flex items-center gap-2 md:gap-3 shrink-0 self-end md:self-auto">
        <button onClick={() => action({ action: 'toggle_task', taskId: task.id })} className="text-glass-cyan hover:text-white transition-colors p-2 text-2xl leading-none px-3 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]" title="Mark Done">✓</button>
        <button onClick={() => action({ action: 'delete_task', taskId: task.id })} className="text-neutral-500 hover:text-red-400 transition-colors p-2 text-2xl leading-none px-3" title="Delete">&times;</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// XP Progress Bar
// ─────────────────────────────────────────────

function XPBar({ pet, potentialXp = 0 }: { pet?: Pet | null; potentialXp?: number }) {
  const displayXp = (pet?.current_xp ?? 0) + potentialXp;
  const stage = pet?.evolution_stage ?? 'egg';

  let barMax: number, barMin: number, label: string;
  if (stage === 'egg') { barMin = 0; barMax = XP_EGG_TO_BABY; label = `Evolve at ${XP_EGG_TO_BABY} XP`; }
  else if (stage === 'baby') { barMin = XP_EGG_TO_BABY; barMax = XP_BABY_TO_ADULT; label = `Evolve at ${XP_BABY_TO_ADULT} XP`; }
  else { barMin = XP_BABY_TO_ADULT; barMax = XP_ADULT_TO_RETIRE; label = `Retire at ${XP_ADULT_TO_RETIRE} XP`; }

  const pct = Math.min(100, Math.max(0, ((displayXp - barMin) / (barMax - barMin)) * 100));

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-neutral-400 font-bold uppercase tracking-widest mb-2">
        <span>{displayXp.toLocaleString()} XP total</span>
        <span>{label}</span>
      </div>
      <div className="xp-bar-track w-full">
        <div
          className="xp-bar-fill"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Pet Card (Hall of Fame)
// ─────────────────────────────────────────────

function PetHallCard({ pet }: { pet: Pet }) {
  return (
    <div className="glass-card p-4 flex flex-col items-center gap-2 text-center glass-card-hover">
      <div className="text-4xl mb-1">🏆</div>
      <div className="text-2xl drop-shadow-[0_0_15px_rgba(255,215,0,0.5)]">{getPetEmoji(pet)}</div>
      <div className="font-black text-sm">{pet.name}</div>
      <div className="text-xs text-neutral-400">{pet.current_xp.toLocaleString()} XP · {pet.sessions_survived} sessions</div>
      <div className="text-xs text-yellow-500/80 font-bold uppercase tracking-widest">Retired</div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Honor Modal
// ─────────────────────────────────────────────

function HonorModal({
  modalState,
  potentialXP,
  activePet,
  onFocused,
  onBroke,
  resolving,
}: {
  modalState: HonorModalState;
  potentialXP: number;
  activePet: Pet | null;
  onFocused: () => void;
  onBroke: () => void;
  resolving: boolean;
}) {
  if (modalState === 'hidden') return null;

  if (modalState === 'broke_death') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black screen-death select-none">
        <div className="animate-grave-drop text-center space-y-4">
          <div className="text-8xl md:text-[10rem]">🪦</div>
          <div className="font-black text-2xl md:text-4xl text-neutral-400 tracking-tight">
            {activePet?.name ?? 'Your Pet'} has fallen.
          </div>
          <div className="text-neutral-600 text-sm uppercase tracking-widest font-bold">
            A new egg is hatching...
          </div>
        </div>
      </div>
    );
  }

  if (modalState === 'evolved') {
    const stage = activePet?.evolution_stage ?? 'baby';
    const emoji = getPetEmoji(activePet);
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm select-none text-center">
        <div className="animate-evolve space-y-6">
          <div className="text-8xl md:text-[10rem]">{emoji}</div>
          <div className="font-black text-3xl md:text-5xl text-brand-neon uppercase">EVOLVED!</div>
          <div className="text-neutral-400 font-bold uppercase tracking-widest px-4">
            {activePet?.name} is now a {PET_LABEL[stage as Pet['evolution_stage']]}
          </div>
        </div>
      </div>
    );
  }

  if (modalState === 'retired') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm select-none">
        <div className="animate-evolve text-center space-y-6">
          <div className="text-8xl md:text-[10rem]">🏆</div>
          <div className="font-black text-3xl md:text-5xl text-yellow-400">HALL OF FAME!</div>
          <div className="text-neutral-300 font-bold text-xl">{activePet?.name} has been immortalized.</div>
          <div className="text-neutral-500 text-sm uppercase tracking-widest">A new egg awaits...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-6 select-none">
      <div className="animate-modal-in w-full max-w-md glass-card-purple p-8 md:p-10 flex flex-col items-center gap-8 glow-purple">
        <div className="text-center space-y-3">
          <div className="text-6xl animate-pet-idle glow-pet">{getPetEmoji(activePet)}</div>
          <div className="font-black text-sm uppercase tracking-widest text-neutral-400">{activePet?.name}</div>
          <div className="gradient-text font-black text-4xl">+{potentialXP.toLocaleString()} XP</div>
          <div className="text-neutral-400 text-xs uppercase tracking-widest">Potential earned</div>
        </div>

        <div className="text-center">
          <h2 className="text-xl md:text-2xl font-black leading-tight">
            Hand on heart:<br />
            <span className="text-white">Did you actually focus,</span><br />
            <span className="text-neutral-400">or did you waste time?</span>
          </h2>
        </div>

        <div className="w-full flex flex-col gap-4">
          <button
            id="honor-focused-btn"
            onClick={onFocused}
            disabled={resolving}
            className="w-full py-5 rounded-2xl font-black text-xl btn-primary text-white disabled:opacity-50"
          >
            {resolving ? 'Saving...' : '✓ I Focused'}
          </button>
          <button
            id="honor-broke-btn"
            onClick={onBroke}
            disabled={resolving}
            className="w-full py-5 rounded-2xl font-black text-xl btn-danger disabled:opacity-50"
          >
            {resolving ? '...' : '✗ I Broke'}
          </button>
        </div>

        <p className="text-xs text-neutral-700 italic text-center">
          No one is watching. But your pet knows.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Home Page
// ─────────────────────────────────────────────

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState(true);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  const [activePet, setActivePet] = useState<Pet | null>(null);
  const [retiredPets, setRetiredPets] = useState<Pet[]>([]);
  const [tamagotchiSession, setTamagotchiSession] = useState<TamagotchiSession | null>(null);
  const [modalState, setModalState] = useState<HonorModalState>('hidden');
  const [resolving, setResolving] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [happyKey, setHappyKey] = useState(0); 
  const [showHallOfFame, setShowHallOfFame] = useState(false);
  const [customPetName, setCustomPetName] = useState('');

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

  const apiFetch = async (url: string, options: RequestInit = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
  };

  const fetchState = useCallback(async () => {
    if (!user) return;
    try {
      const [taskRes, petRes] = await Promise.all([
        apiFetch(`/api/task?userId=${user.id}`),
        apiFetch(`/api/pet?userId=${user.id}`),
      ]);

      if (taskRes.ok) {
        const data = await taskRes.json();
        if (!tamagotchiSession) setActiveSession(data.activeSession);
      }

      if (petRes.ok) {
        const data = await petRes.json();
        setActivePet(data.activePet);
        setRetiredPets(data.retiredPets ?? []);
      }

      const { data: latestTasks, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('position', { ascending: true });

      if (!error && latestTasks) setTasks(latestTasks);
    } catch (e) {
      console.error('Fetch State Error:', e);
    } finally {
      setLoading(false);
    }
  }, [user, tamagotchiSession]);

  useEffect(() => {
    if (user) {
      fetchState();
      const interval = setInterval(fetchState, 3000);
      return () => clearInterval(interval);
    }
  }, [user, fetchState]);

  const stateRef = useRef({ tasks, activeSession });
  useEffect(() => { stateRef.current = { tasks, activeSession }; }, [tasks, activeSession]);

  const transitioningRef = useRef(false);

  useEffect(() => {
    if (activeSession?.mode === 'tamagotchi' && !tamagotchiSession) {
      const startTime = activeSession.endTime || Date.now();
      setTamagotchiSession({
        startTime,
        potentialXP: Math.floor(Math.max(0, Date.now() - startTime) / 6000)
      });
    }
  }, [activeSession, tamagotchiSession]);

  useEffect(() => {
    const timerInterval = setInterval(() => {
      const currentNow = Date.now();
      setNow(currentNow);

      setTamagotchiSession(prev => {
        if (!prev) return prev;
        const elapsed = Math.max(0, currentNow - prev.startTime);
        const newXP = Math.floor(elapsed / 6000); 
        if (newXP > prev.potentialXP) setHappyKey(k => k + 1); 
        return { ...prev, potentialXP: newXP };
      });

      const session = stateRef.current?.activeSession;
      if (session?.endTime && currentNow >= session.endTime && !transitioningRef.current && user) {
        transitioningRef.current = true;
        apiFetch('/api/task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'transition_timer', userId: user.id }),
        }).then(res => res.json()).then(data => {
          setActiveSession(data.activeSession);
        }).finally(() => { transitioningRef.current = false; });
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
      setTasks(newTasks);
      const payload = newTasks.map((t, i) => ({ id: t.id, user_id: user.id, position: i, name: t.name, completed: t.completed }));
      await supabase.from('tasks').upsert(payload, { onConflict: 'id' });
    }
  };

  const action = async (payload: { action: string; taskId?: string; mode?: string }) => {
    if (!user) return;
    setLoading(true);
    try {
      if (['start_session', 'stop_session', 'transition_timer'].includes(payload.action)) {
        await apiFetch('/api/task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, userId: user.id }),
        });
      }
      if (payload.action === 'toggle_task' && payload.taskId) {
        const target = tasks.find(t => t.id === payload.taskId);
        if (target) {
          setTasks(prev => prev.map(t => t.id === payload.taskId ? { ...t, completed: !t.completed } : t));
          await supabase.from('tasks').update({ completed: !target.completed }).eq('id', payload.taskId).eq('user_id', user.id);
        }
      } else if (payload.action === 'delete_task' && payload.taskId) {
        setTasks(prev => prev.filter(t => t.id !== payload.taskId));
        await supabase.from('tasks').delete().eq('id', payload.taskId).eq('user_id', user.id);
      }
      await fetchState();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleStartTamagotchi = async (mode: 'infinite' | 'pomodoro' = 'infinite') => {
    if (!user || tamagotchiSession) return;
    setLoading(true);
    try {
      const nameToSave = customPetName.trim();
      const res = await apiFetch('/api/pet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start_tamagotchi', userId: user.id, name: nameToSave, mode }),
      });
      const data = await res.json();
      if (data.activePet) setActivePet(data.activePet);
      setCustomPetName(''); 
      setTamagotchiSession({ startTime: Date.now(), potentialXP: 0 });
      setActiveSession({
        taskId: null,
        taskName: mode === 'pomodoro' ? 'Pomodoro 50/10' : 'Tamagotchi Session',
        mode: mode === 'pomodoro' ? 'tamagotchi_pomodoro' : 'tamagotchi',
        phase: 'work',
        endTime: mode === 'pomodoro' ? Date.now() + 50 * 60 * 1000 : null,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestStop = () => { if (tamagotchiSession) setModalState('asking'); };

  const handleVerdict = async (verdict: 'focused' | 'broke') => {
    if (!user || !tamagotchiSession || resolving) return;
    setResolving(true);
    const potentialXp = tamagotchiSession.potentialXP;
    try {
      const res = await apiFetch('/api/pet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve_session', userId: user.id, verdict, potentialXp }),
      });
      const data = await res.json();
      setTamagotchiSession(null);
      setActiveSession(null);
      if (verdict === 'broke') {
        setModalState('broke_death');
        if (data.newPet) setActivePet(data.newPet);
        setTimeout(() => { setModalState('hidden'); setShakeKey(k => k + 1); }, 3000);
      } else {
        if (data.event === 'retired' || data.event === 'evolved') {
          if (data.newPet || data.updatedPet) setActivePet(data.newPet || data.updatedPet);
          setModalState(data.event as HonorModalState);
          setTimeout(() => setModalState('hidden'), 3500);
        } else {
          if (data.updatedPet) setActivePet(data.updatedPet);
          setModalState('hidden');
        }
        fetchState();
      }
    } catch (e) {
      console.error(e);
      setModalState('hidden');
    } finally {
      setResolving(false);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !user) return;
    const newTaskName = inputText.trim();
    setInputText('');
    setLoading(true);
    const nextPos = tasks.length;
    const { data: newTasks } = await supabase.from('tasks').insert([{ name: newTaskName, position: nextPos, user_id: user.id }]).select();
    if (newTasks) setTasks(prev => [...prev, newTasks[0]]);
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

  const handleLogout = async () => { await supabase.auth.signOut(); };

  if (authChecking) return <main className="flex min-h-screen items-center justify-center bg-bg-deep text-white"><div className="animate-pulse opacity-50 uppercase tracking-widest">Connecting...</div></main>;
  if (!user) return <AuthPage />;

  const isPomodoro = activeSession?.mode === 'pomodoro';
  const isBreak = activeSession?.phase === 'break';
  const isTamagotchi = activeSession?.mode === 'tamagotchi' || activeSession?.mode === 'tamagotchi_pomodoro';
  const elapsedSeconds = tamagotchiSession ? Math.floor((now - tamagotchiSession.startTime) / 1000) : 0;

  return (
    <>
      <HonorModal modalState={modalState} potentialXP={tamagotchiSession?.potentialXP ?? 0} activePet={activePet} onFocused={() => handleVerdict('focused')} onBroke={() => handleVerdict('broke')} resolving={resolving} />

      <main className={`flex min-h-screen items-center justify-center px-6 py-12 transition-all duration-1000 overflow-y-auto ${
        isTamagotchi ? 'bg-glass-scene text-white' : activeSession ? (isBreak ? 'bg-white text-black' : 'bg-black text-white') : 'bg-glass-scene text-white'
      }`}>

        {activeSession && isTamagotchi && !tamagotchiSession && (
          <div className="flex flex-col items-center gap-6 animate-pulse">
            <div className="text-8xl glow-pet">🥚</div>
            <div className="font-black text-sm uppercase tracking-widest text-neutral-400">Initializing Protocol...</div>
          </div>
        )}

        {!activeSession && (
          <div className="w-full max-w-3xl transform scale-100 opacity-100 transition-all">
            <div className="mb-10 text-center flex flex-col items-center">
              <div className="flex items-center gap-4 mb-3">
                <Image src="/logo.png" priority alt="Logo" width={64} height={64} className="rounded-2xl glow-purple-sm" />
                <h1 className="text-4xl md:text-5xl font-black tracking-tight opacity-90 gradient-text">Ya Machur</h1>
              </div>
              <div className="flex items-center justify-center gap-3">
                <p className="gradient-text-green font-bold text-sm uppercase tracking-widest opacity-80">Dashboard</p>
                <Link href="/setup" className="btn-secondary px-3 py-1 rounded-md text-xs font-bold uppercase transition-colors">Setup</Link>
                <button onClick={handleLogout} className="btn-danger px-3 py-1 rounded-md text-xs font-bold uppercase transition-colors">Logout</button>
              </div>
            </div>

            {activePet && (
              <div key={shakeKey} className={`mb-8 glass-card-purple p-6 flex flex-col items-center gap-4 glow-purple-sm ${shakeKey > 0 ? 'animate-shake' : ''}`}>
                <div className="flex items-center gap-4 w-full text-center sm:text-left">
                  <div className="animate-pet-float text-5xl shrink-0 mx-auto sm:mx-0 glow-pet">{getPetEmoji(activePet)}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                      <span className="font-black text-lg">{activePet.name}</span>
                      <button onClick={() => setCustomPetName(activePet.name)} className="text-neutral-500 hover:text-glass-cyan transition-colors">
                         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                      </button>
                      <span className="text-xs glass-card px-2 py-0.5 rounded-full uppercase tracking-widest font-bold text-neutral-300">{PET_LABEL[activePet.evolution_stage]}</span>
                    </div>
                    <div className="text-sm text-neutral-400">{activePet.sessions_survived} survived · {activePet.current_xp.toLocaleString()} XP</div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                    <button onClick={() => handleStartTamagotchi('infinite')} disabled={loading} className="shrink-0 btn-primary px-5 py-3 rounded-xl text-sm uppercase tracking-widest font-bold text-white">Start Session</button>
                    <button onClick={() => handleStartTamagotchi('pomodoro')} disabled={loading} className="shrink-0 btn-secondary px-5 py-3 rounded-xl text-sm uppercase tracking-widest font-bold">Pomodoro 50/10</button>
                  </div>
                </div>
                {customPetName && (
                   <div className="w-full flex gap-2 mt-4 glass-card p-2 rounded-xl">
                     <input value={customPetName} onChange={(e) => setCustomPetName(e.target.value)} placeholder="Enter name..." className="flex-1 bg-transparent border-b-2 border-white/10 px-2 py-1 text-sm outline-none focus:border-glass-purple font-bold text-white shadow-none" />
                     <button onClick={() => handleStartTamagotchi('infinite')} className="text-xs font-black text-glass-cyan uppercase tracking-widest px-2 hover:opacity-70">Save</button>
                     <button onClick={() => setCustomPetName('')} className="text-xs font-bold text-neutral-400 uppercase tracking-widest px-2 hover:opacity-70">Cancel</button>
                   </div>
                )}
                <XPBar pet={activePet} />
              </div>
            )}

            {!activePet && !loading && (
              <div className="mb-8 glass-card border-dashed border-white/20 p-8 flex flex-col items-center gap-6 text-center glow-purple-sm">
                <div className="text-6xl animate-pet-float glow-pet">🥚</div>
                <div className="font-black text-xl mb-1 text-white">Your mystery egg is waiting.<br/><span className="text-neutral-400 text-sm font-normal">What shall we name it?</span></div>
                <input type="text" maxLength={15} placeholder="Enter Name..." value={customPetName} onChange={(e) => setCustomPetName(e.target.value)} className="w-full max-w-[200px] glass-input text-center font-bold text-lg px-2 py-2" />
                <div className="flex flex-col sm:flex-row gap-4">
                  <button onClick={() => handleStartTamagotchi('infinite')} disabled={loading} className="btn-primary text-white font-black px-8 py-4 rounded-xl uppercase tracking-widest text-sm">Hatch {customPetName.trim() || 'My Egg'}</button>
                  <button onClick={() => handleStartTamagotchi('pomodoro')} disabled={loading} className="btn-secondary font-black px-8 py-4 rounded-xl uppercase tracking-widest text-sm">Pomodoro 50/10</button>
                </div>
              </div>
            )}

            <form onSubmit={handleAddTask} className="flex gap-4 mb-10 w-full">
              <input type="text" required value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="What must be done?" className="flex-1 glass-input px-4 py-4 text-xl" autoComplete="off" />
              <button type="submit" disabled={!inputText.trim() || loading} className="btn-primary text-white font-bold px-8 rounded-xl uppercase tracking-widest text-sm">Add</button>
            </form>

            <div className="space-y-8">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <div className="space-y-4">
                  <SortableContext items={tasks.filter(t => !t.completed).map(t => t.id)} strategy={verticalListSortingStrategy}>
                    {tasks.filter(t => !t.completed).map(task => <SortableTaskItem key={task.id} task={task} action={action} />)}
                  </SortableContext>
                  {tasks.filter(t => !t.completed).length === 0 && <div className="text-center text-neutral-400 py-10 italic glass-card border-dashed">Nothing to do. Add a task above.</div>}
                </div>
              </DndContext>
              {tasks.filter(t => t.completed).length > 0 && (
                <div className="pt-6 border-t border-white/10">
                  <h3 className="text-neutral-400 font-bold uppercase tracking-widest text-sm mb-4">Completed</h3>
                  <div className="space-y-3">
                    {tasks.filter(t => t.completed).map(task => (
                      <div key={task.id} className="group glass-card p-4 flex items-center justify-between opacity-60 hover:opacity-100 transition-opacity">
                        <span className="text-lg font-medium line-through text-neutral-400 truncate">{task.name}</span>
                        <div className="flex gap-3"><button onClick={() => action({ action: 'toggle_task', taskId: task.id })} className="text-glass-cyan hover:text-white transition-colors text-xs font-bold uppercase">Undo</button><button onClick={() => action({ action: 'delete_task', taskId: task.id })} className="text-neutral-500 hover:text-red-400 text-xl leading-none">&times;</button></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {retiredPets.length > 0 && (
              <div className="mt-12 pt-8 border-t border-white/10">
                <button onClick={() => setShowHallOfFame(h => !h)} className="flex items-center gap-3 mb-6 text-neutral-400 hover:text-yellow-400 transition-colors group"><span className="text-2xl drop-shadow-md">🏆</span><h3 className="font-black uppercase tracking-widest text-sm">Hall of Fame ({retiredPets.length})</h3></button>
                {showHallOfFame && <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">{retiredPets.map(pet => <PetHallCard key={pet.id} pet={pet} />)}</div>}
              </div>
            )}
          </div>
        )}

        {isTamagotchi && tamagotchiSession && !isBreak && (
          <div className="w-full max-w-lg text-center space-y-10">
            <div className="relative flex items-center justify-center py-6">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-48 h-48 rounded-full border-4 border-glass-purple/30 animate-focus-aura opacity-0" />
                <div className="absolute w-64 h-64 rounded-full border-2 border-glass-cyan/20 animate-focus-aura delay-1000 opacity-0" />
              </div>
              <div className="absolute inset-0 pointer-events-none">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="absolute animate-sparkle opacity-0 text-glass-cyan/60 text-xl" style={{ left: `${20 + Math.random() * 60}%`, top: `${40 + Math.random() * 40}%`, animationDelay: `${i * 0.7}s` }}>✨</div>
                ))}
              </div>
              <div key={happyKey} className={`text-[7rem] md:text-[10rem] leading-none relative z-10 transition-all duration-300 glow-pet ${happyKey > 0 ? 'animate-happy-jump' : 'animate-pet-float'}`}>
                {getPetEmoji(activePet)}
              </div>
            </div>
            <div className={`font-black text-lg uppercase tracking-widest transition-all duration-300 ${happyKey > 0 ? 'gradient-text scale-110' : 'text-neutral-300'}`}>
              {activePet?.name ?? 'Unnamed'}
            </div>
            <div className="space-y-2">
              <div className="font-black tabular-nums text-5xl md:text-7xl tracking-tighter text-white drop-shadow-lg">
                {activeSession?.mode === 'tamagotchi_pomodoro' && activeSession.phase === 'work'
                  ? calculateTimeLeft(activeSession.endTime)
                  : formatElapsed(elapsedSeconds)}
              </div>
              <div className="gradient-text font-black text-2xl md:text-3xl">+{tamagotchiSession.potentialXP.toLocaleString()} XP</div>
              <div className="text-xs text-neutral-400 uppercase tracking-widest font-bold">Potential earned</div>
            </div>
            <div className="px-4 w-full max-w-xs mx-auto"><XPBar pet={activePet} potentialXp={tamagotchiSession.potentialXP} /></div>
            <button onClick={handleRequestStop} disabled={resolving} className="w-full btn-primary font-black text-xl px-12 py-5 rounded-2xl text-white"><span className="relative z-10">End Session</span></button>
          </div>
        )}

        {activeSession && (isBreak || !isTamagotchi) && (
          <div className="w-full max-w-5xl text-center space-y-12">
            {isBreak ? (
              <div className="space-y-8"><h2 className="font-black text-6xl md:text-8xl gradient-text-green animate-pulse drop-shadow-lg">BREAK TIME!<br/>GO TO SCROLL</h2><div className="tabular-nums font-black text-6xl md:text-8xl text-white/90">{calculateTimeLeft(activeSession.endTime)}</div></div>
            ) : (
              <><div><div className="font-bold uppercase tracking-[0.4em] text-sm mb-8 animate-pulse text-glass-pink">{isPomodoro ? 'Pomodoro Work Phase' : 'Infinite Focus'}</div><h2 className="font-black text-4xl md:text-6xl text-white">{activeSession.taskName}</h2></div>
                {isPomodoro && <div className="tabular-nums font-black py-8 text-[6rem] md:text-[12rem] text-white drop-shadow-lg">{calculateTimeLeft(activeSession.endTime)}</div>}
              </>
            )}
            <div className="flex flex-col items-center gap-8 pt-8">
              <button onClick={isTamagotchi ? handleRequestStop : () => action({ action: 'stop_session' })} className={`font-black text-xl md:text-3xl px-12 py-6 rounded-2xl transition-all ${isBreak ? 'btn-secondary' : 'btn-danger'}`}><span className="relative z-10">{isBreak && isTamagotchi ? 'End Session' : isBreak ? 'Skip Break' : "I'M DONE"}</span></button>
              {!isBreak && <button onClick={() => action({ action: 'stop_session' })} className="text-neutral-500 hover:text-white transition-colors text-sm font-medium uppercase tracking-widest">Cancel Task</button>}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
