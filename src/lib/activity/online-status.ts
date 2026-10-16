export const ONLINE_STATUS_MAX_AGE_MS = 90_000;

export function isUserOnline(
  isOnline: boolean | null | undefined,
  lastSeen: string | null | undefined,
  now = Date.now()
): boolean {
  if (!isOnline || !lastSeen) return false;

  const lastSeenAt = Date.parse(lastSeen);
  const age = now - lastSeenAt;
  return Number.isFinite(lastSeenAt) && age >= 0 && age <= ONLINE_STATUS_MAX_AGE_MS;
}
