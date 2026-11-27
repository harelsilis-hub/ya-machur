import { NTFY_SERVER, ntfyTopic, type SessionPhase } from './session';

// Phone notifications via ntfy (https://ntfy.sh). The notification is scheduled on the
// ntfy server for the exact moment the phase ends, so it arrives even when no device
// has the app open. Each one gets a sequence id derived from its end time so it can be
// cancelled if the session is stopped or the break is skipped early.

const seqId = (endTime: number) => `end-${endTime}`;

const MESSAGES: Record<SessionPhase, { title: string; body: string; tags: string }> = {
  work: {
    title: 'Time for a break',
    body: 'Focus session done! Open Ya Machur and tap "Start break" when you are ready.',
    tags: 'coffee',
  },
  break: {
    title: 'Back to learning',
    body: 'Break is over. Open Ya Machur and tap "Start focus" to keep going.',
    tags: 'books',
  },
};

/** Schedule the "phase finished" push for `endTime` (ms). */
export async function schedulePhaseEnd(userId: string, phase: SessionPhase, endTime: number, appUrl?: string) {
  const msg = MESSAGES[phase];
  try {
    // Note: the sequence id must go in the header (not the URL path) — only then does
    // ntfy.sh honour a later DELETE for a still-scheduled message (verified empirically).
    const res = await fetch(`${NTFY_SERVER}/${ntfyTopic(userId)}`, {
      method: 'POST',
      body: msg.body,
      headers: {
        'X-Sequence-ID': seqId(endTime),
        Title: msg.title,
        Tags: msg.tags,
        Priority: 'high',
        At: String(Math.floor(endTime / 1000)),
        ...(appUrl ? { Click: appUrl } : {}),
      },
    });
    if (!res.ok) console.error('ntfy schedule failed:', res.status, await res.text().catch(() => ''));
  } catch (err) {
    console.error('ntfy schedule error:', err);
  }
}

/** Cancel a scheduled push that hasn't fired yet. */
export async function cancelPhaseEnd(userId: string, endTime: number | null | undefined) {
  if (!endTime || Number(endTime) <= Date.now()) return; // already delivered: leave it
  try {
    await fetch(`${NTFY_SERVER}/${ntfyTopic(userId)}/${seqId(Number(endTime))}`, { method: 'DELETE' });
  } catch (err) {
    console.error('ntfy cancel error:', err);
  }
}
