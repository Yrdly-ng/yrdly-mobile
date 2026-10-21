import type { SupabaseClient } from '@supabase/supabase-js';

let subscriptionGeneration = 0;

export function createMessagesChannel(client: Pick<SupabaseClient, 'channel'>, topic: string) {
  // Supabase reuses channels by topic. Each effect setup needs its own channel
  // so overlapping screens and pending cleanup cannot reuse a subscribed one.
  subscriptionGeneration += 1;
  return client.channel(`${topic}-${subscriptionGeneration}`);
}
