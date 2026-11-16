/** Normalize legacy JSON/array media fields before rendering native views. */
export function mediaUrls(value: unknown): string[] {
  let items: unknown = value;
  if (typeof items === 'string') {
    const text = items.trim();
    if (!text || text.length > 100_000) return [];
    if (text.startsWith('[')) {
      try {
        items = JSON.parse(text);
      } catch {
        return [];
      }
    } else {
      items = [text];
    }
  }
  if (!Array.isArray(items)) return [];
  return Array.from(
    new Set(
      items
        .slice(0, 50)
        .filter(
          (item): item is string =>
            typeof item === 'string' &&
            item.trim().length <= 8192 &&
            /^(?:https?:\/\/|file:\/\/|content:\/\/|blob:|\/)/i.test(item.trim())
        )
        .map((item) => item.trim())
    )
  );
}
