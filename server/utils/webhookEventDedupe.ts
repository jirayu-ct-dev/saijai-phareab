// LINE webhook replay protection. LINE may redeliver events (and an attacker
// who captured a signed body could replay it); deduplicating by webhookEventId
// prevents duplicate side effects. In-memory is sufficient for the current
// single-instance deployment.
const DEDUPE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_TRACKED_EVENTS = 10_000;

const seenEventIds = new Map<string, number>();

function pruneExpired(now: number): void {
  for (const [eventId, expiresAt] of seenEventIds) {
    if (expiresAt <= now) seenEventIds.delete(eventId);
  }
  // Map preserves insertion order; drop the oldest entries if still oversized.
  while (seenEventIds.size > MAX_TRACKED_EVENTS) {
    const oldest = seenEventIds.keys().next().value;
    if (oldest === undefined) break;
    seenEventIds.delete(oldest);
  }
}

/**
 * Returns true when the event was already seen within the dedupe window,
 * and records the event otherwise.
 */
export function isDuplicateWebhookEvent(eventId: string, now: number = Date.now()): boolean {
  pruneExpired(now);
  if (seenEventIds.has(eventId)) return true;
  seenEventIds.set(eventId, now + DEDUPE_TTL_MS);
  return false;
}
