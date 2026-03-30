import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const { userId, taskTitles } = await request.json();

    // Apple Shortcuts BUG FIX: Shortcuts notoriously concatenates lists into a single giant string with newlines when injecting into JSON!
    let parsedTitles: string[] = [];
    
    if (Array.isArray(taskTitles)) {
      parsedTitles = taskTitles;
    } else if (typeof taskTitles === 'string') {
      // Split the giant string by newlines to recover the individual list items!
      parsedTitles = taskTitles.split('\n').map((t: string) => t.trim()).filter((t: string) => t.length > 0);
      // Apple sometimes uses commas too depending on region, but \n is default.
      if (parsedTitles.length === 1 && parsedTitles[0].includes(',')) {
         parsedTitles = parsedTitles[0].split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0);
      }
    }

    if (!userId || parsedTitles.length === 0) {
      return NextResponse.json({ error: 'Invalid payload or empty list provided.' }, { status: 400 });
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

    return NextResponse.json({ success: true, message: `Successfully wiped old list and synced ${parsedTitles.length} new tasks.` });

  } catch (err: any) {
    console.error('Sync API Error:', err);
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 });
  }
}
