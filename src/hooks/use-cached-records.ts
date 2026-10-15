import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAuth } from './use-supabase-auth';
import { localCache } from '@/lib/offline/local-cache';

/** Public metadata only; prices/availability must always be rechecked by checkout. */
export function useCachedRecords<T extends { id: string }>(namespace: string, key: string) {
  const { user } = useAuth();
  const [records, setRecords] = useState<T[]>([]);
  const [isCached, setIsCached] = useState(false);
  const [recordIdentity, setRecordIdentity] = useState('');
  const owner = user?.id;
  const identity = `${user?.id || ''}:${namespace}:${key}`;
  const currentIdentity = useRef(identity);
  useLayoutEffect(() => {
    currentIdentity.current = identity;
  }, [identity]);
  const revision = useRef(0);
  useEffect(() => {
    const started = ++revision.current;
    setRecords([]);
    setIsCached(false);
    setRecordIdentity(identity);
    if (!user?.id) return;
    void localCache.read<T[]>(user.id, namespace, key).then((entry) => {
      if (entry && currentIdentity.current === identity && revision.current === started) {
        setRecords(entry.value);
        setIsCached(true);
      }
    });
  }, [identity, user?.id, namespace, key]);
  const setFromServer = useCallback(
    (rows: T[]) => {
      if (currentIdentity.current !== identity) return;
      revision.current++;
      const unique = Array.from(new Map(rows.map((row) => [row.id, row])).values());
      setRecords(unique);
      setIsCached(false);
      setRecordIdentity(identity);
      if (owner) void localCache.write(owner, namespace, key, unique);
    },
    [identity, owner, namespace, key]
  );
  return [
    recordIdentity === identity ? records : [],
    setFromServer,
    recordIdentity === identity && isCached,
  ] as const;
}
