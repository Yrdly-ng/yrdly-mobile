import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { parsePrivateMediaReference, type PrivateMediaBucket } from '../lib/private-media';

/** Authorize attachments through Storage RLS; never persist expiring signed URLs. */
export function usePrivateMedia(values: string[], userId?: string, active = true) {
  const references = JSON.stringify([...new Set(values)].sort());
  const owner = `${userId || ''}:${active}:${references}`;
  const [resolved, setResolved] = useState<{ owner: string; urls: Record<string, string> }>({
    owner: '',
    urls: {},
  });
  useEffect(() => {
    let cancelled = false;
    setResolved({ owner, urls: {} });
    if (!userId || !active) return;
    async function refresh() {
      const next: Record<string, string> = {};
      const groups = new Map<PrivateMediaBucket, { value: string; path: string }[]>();
      for (const value of JSON.parse(references) as string[]) {
        try {
          const media = parsePrivateMediaReference(value);
          if (!media) {
            if (value.startsWith('https://')) next[value] = value;
            continue;
          }
          const group = groups.get(media.bucket) || [];
          group.push({ value, path: media.path });
          groups.set(media.bucket, group);
        } catch {
          /* Invalid references fail closed. */
        }
      }
      await Promise.all(
        [...groups].map(async ([bucket, items]) => {
          try {
            const { data, error } = await supabase.storage.from(bucket).createSignedUrls(
              items.map((item) => item.path),
              600
            );
            if (!error)
              for (let i = 0; i < items.length; i++) {
                const result = data?.[i];
                if (result?.signedUrl && !result.error) next[items[i].value] = result.signedUrl;
              }
          } catch {
            /* Membership changes and outages must not expose media. */
          }
        })
      );
      if (!cancelled) setResolved({ owner, urls: next });
    }
    void refresh();
    const timer = setInterval(
      () => {
        void refresh();
      },
      9 * 60 * 1000
    );
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [references, userId, active, owner]);
  return resolved.owner === owner ? resolved.urls : {};
}
