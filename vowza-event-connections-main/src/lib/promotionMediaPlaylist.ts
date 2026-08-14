/** Timing and index rules shared by the homepage promotion playlist UI and tests. */
export const PHOTO_DURATION_MS = 10_000;

/** Returns the next item in a circular playlist; a one-item playlist stays at zero. */
export function nextPlaylistIndex(currentIndex: number, itemCount: number): number {
  if (itemCount <= 1) return 0;
  return (Math.max(0, currentIndex) + 1) % itemCount;
}

/** Filters failed assets while preserving the administrator's display order. */
export function playableMediaIds<T extends { id: string }>(items: T[], failedIds: ReadonlySet<string>): string[] {
  return items.filter((item) => !failedIds.has(item.id)).map((item) => item.id);
}
