import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { userId, taskTitles } = await request.json();

    // Apple Shortcuts BUG FIX: If there is only ONE reminder, Shortcuts sends it as a raw string instead of an Array!
    let parsedTitles = taskTitles;
    if (typeof taskTitles === 'string') {
      parsedTitles = [taskTitles];
    }

    if (!userId || !Array.isArray(parsedTitles)) {
      return NextResponse.json({ error: 'Invalid payload. Requires userId string and taskTitles array (or single string).' }, { status: 400 });
    }

    // 1. Clear existing tasks for the user strictly (destructive sync as requested)
    const { error: deleteError } = await supabase
      .from('tasks')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Delete error during sync:', deleteError);
      return NextResponse.json({ error: 'Failed to clear existing tasks', details: deleteError.message }, { status: 500 });
    }

    // 2. Insert new tasks mapping the array index accurately to keep order UI
    if (parsedTitles.length > 0) {
      const tasksToInsert = parsedTitles.map((title: string, index: number) => ({
        name: title,
        user_id: userId,
        position: index,
        completed: false
      }));

      const { error: insertError } = await supabase
        .from('tasks')
        .insert(tasksToInsert);

      if (insertError) {
        console.error('Insert error during sync:', insertError);
        return NextResponse.json({ error: 'Failed to insert new tasks' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, message: `Successfully wiped old list and synced ${taskTitles.length} new tasks.` });

  } catch (err: any) {
    console.error('Sync API Error:', err);
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 });
  }
}
