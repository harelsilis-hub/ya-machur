import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { data: settings } = await supabase
    .from('settings')
    .select('is_active, session_phase, session_end_time')
    .eq('id', 1)
    .single();

  if (!settings) {
    return NextResponse.json({ isActive: false }, { headers: { 'Cache-Control': 'no-store' } });
  }

  // Calculate dynamic active state based on backend end_time
  // This allows the iPhone check to perfectly align precisely without backend interval engine loop running
  let isActive = false;
  
  if (settings.session_phase === 'work') {
    if (settings.session_end_time) {
      if (Date.now() < Number(settings.session_end_time)) {
        isActive = true;
      }
    } else {
      // Infinite mode has no endTime but remains active indefinitely
      isActive = true;
    }
  }

  return NextResponse.json(
    { isActive },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } }
  );
}
