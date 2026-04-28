import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// ------------------------------------------------------------------
// XP thresholds
// ------------------------------------------------------------------
const XP_EGG_TO_BABY    = 300;    // 30 min focus
const XP_BABY_TO_ADULT  = 1200;   // 2 h cumulative
const XP_ADULT_TO_RETIRE = 3000;  // 5 h cumulative

// Fun auto-generated pet name pool
const PET_NAMES = [
  'Grumpf', 'Zibble', 'Snorkin', 'Blorp', 'Fizzwit',
  'Mungo', 'Dazzle', 'Krumble', 'Wibble', 'Splonk',
  'Frooble', 'Gizzard', 'Twitchy', 'Plork', 'Snudge',
  'Fumble', 'Crinkle', 'Bonkers', 'Razzle', 'Bloop',
];

const PET_SPECIES = ['bird', 'cat', 'dragon', 'robot', 'ocean'];

function randomPetName() {
  return PET_NAMES[Math.floor(Math.random() * PET_NAMES.length)];
}

function randomSpecies() {
  return PET_SPECIES[Math.floor(Math.random() * PET_SPECIES.length)];
}

function getEvolutionStage(xp: number): 'egg' | 'baby' | 'adult' {
  if (xp >= XP_BABY_TO_ADULT) return 'adult';
  if (xp >= XP_EGG_TO_BABY) return 'baby';
  return 'egg';
}

// ------------------------------------------------------------------
// GET — fetch the active pet (and retired hall-of-fame pets)
// ------------------------------------------------------------------
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  const supabase = getSupabaseServer(req);

  const [{ data: activePet }, { data: retiredPets }] = await Promise.all([
    supabase
      .from('pets')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from('pets')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'retired')
      .order('retired_at', { ascending: false }),
  ]);

  return NextResponse.json({
    activePet: activePet ?? null,
    retiredPets: retiredPets ?? [],
  }, { headers: { 'Cache-Control': 'no-store' } });
}

// ------------------------------------------------------------------
// POST — all mutation actions
// ------------------------------------------------------------------
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { action, userId, potentialXp, verdict, name: customName, mode } = body;

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  const supabase = getSupabaseServer(req);

  // ----------------------------------------------------------------
  // action: 'start_tamagotchi'
  // Sets is_active = true in settings (activates iPhone block).
  // Creates a new Egg if no active pet exists.
  // ----------------------------------------------------------------
  if (action === 'start_tamagotchi') {
    const isPomo = mode === 'pomodoro';
    // Activate session in settings table (this blocks the iPhone)
    await supabase.from('settings').upsert({
      user_id: userId,
      is_active: true,
      active_task_id: null,
      active_task_name: isPomo ? 'Pomodoro 50/10' : 'Tamagotchi Session',
      session_mode: isPomo ? 'tamagotchi_pomodoro' : 'tamagotchi',
      session_phase: 'work',
      session_end_time: isPomo ? Date.now() + 50 * 60 * 1000 : null,
    }, { onConflict: 'user_id' });

    // Ensure there is an active pet
    const { data: existing } = await supabase
      .from('pets')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(1)
      .single();

    // Handle Naming (Resilient to missing column)
    const petName = (typeof customName === 'string' && customName.trim()) 
      ? customName.trim() 
      : (existing?.name || randomPetName());

    if (!existing) {
      // 1. Create New Pet
      const insertData: any = { user_id: userId, name: petName, status: 'active' };
      const { data: newPet, error } = await supabase
        .from('pets')
        .insert([{ ...insertData, species: randomSpecies() }])
        .select().single();

      if (error) {
        // Fallback if species column is missing
        const { data: fallbackPet, error: fallbackError } = await supabase
          .from('pets')
          .insert([insertData])
          .select().single();
        if (fallbackError) throw fallbackError;
        return NextResponse.json({ activePet: fallbackPet, started: true });
      }
      return NextResponse.json({ activePet: newPet, started: true });
    } else if (petName !== existing.name) {
      // 2. Rename Existing Pet
      const { data: updatedPet } = await supabase
        .from('pets')
        .update({ name: petName })
        .eq('id', existing.id)
        .select().single();
      return NextResponse.json({ activePet: updatedPet || existing, started: true });
    }

    return NextResponse.json({ activePet: existing, started: true });
  }

  // ----------------------------------------------------------------
  // action: 'resolve_session'
  // verdict: 'focused' | 'broke'
  // potentialXp: number (minutes elapsed, calculated on frontend)
  // ----------------------------------------------------------------
  if (action === 'resolve_session') {
    // Always unlock the phone first
    await supabase.from('settings').upsert({
      user_id: userId,
      is_active: false,
      active_task_id: null,
      active_task_name: null,
      session_mode: null,
      session_phase: null,
      session_end_time: null,
    }, { onConflict: 'user_id' });

    // Fetch the active pet
    const { data: pet } = await supabase
      .from('pets')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(1)
      .single();

    if (!pet) {
      return NextResponse.json({ unlocked: true, error: 'No active pet found' });
    }

    if (verdict === 'focused') {
      const earnedXp = Math.max(0, Math.floor(Number(potentialXp) || 0));
      const newXp = pet.current_xp + earnedXp;
      const newStage = getEvolutionStage(newXp);
      const willRetire = newXp >= XP_ADULT_TO_RETIRE;

      if (willRetire) {
        // Retire this pet → Hall of Fame
        await supabase.from('pets').update({
          current_xp: newXp,
          evolution_stage: 'adult',
          status: 'retired',
          sessions_survived: pet.sessions_survived + 1,
          retired_at: new Date().toISOString(),
        }).eq('id', pet.id);

        // Spawn a fresh Egg
        const { data: newPet } = await supabase
          .from('pets')
          .insert([{ user_id: userId, name: randomPetName(), species: randomSpecies() }])
          .select()
          .single();

        return NextResponse.json({
          unlocked: true,
          verdict: 'focused',
          event: 'retired',
          retiredPet: { ...pet, current_xp: newXp, status: 'retired' },
          newPet,
        });
      } else {
        // Standard XP gain (possibly evolve stage)
        await supabase.from('pets').update({
          current_xp: newXp,
          evolution_stage: newStage,
          sessions_survived: pet.sessions_survived + 1,
        }).eq('id', pet.id);

        const evolved = newStage !== pet.evolution_stage;
        return NextResponse.json({
          unlocked: true,
          verdict: 'focused',
          event: evolved ? 'evolved' : 'xp_gained',
          evolvedTo: evolved ? newStage : null,
          updatedPet: { ...pet, current_xp: newXp, evolution_stage: newStage },
        });
      }
    }

    if (verdict === 'broke') {
      // RIP — permanently delete the pet
      await supabase.from('pets').delete().eq('id', pet.id);

      // Spawn a fresh Egg
      const { data: newPet } = await supabase
        .from('pets')
        .insert([{ user_id: userId, name: randomPetName(), species: randomSpecies() }])
        .select()
        .single();

      // Fetch updated hall of fame
      const { data: retiredPets } = await supabase
        .from('pets')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'retired')
        .order('retired_at', { ascending: false });

      return NextResponse.json({
        unlocked: true,
        success: true,
        activePet: newPet,
        retiredPets: retiredPets ?? []
      });
    }

    return NextResponse.json({ unlocked: true, error: 'Unknown verdict' }, { status: 400 });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
