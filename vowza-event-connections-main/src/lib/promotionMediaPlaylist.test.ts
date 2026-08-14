import { describe, expect, it } from 'vitest';
import { PHOTO_DURATION_MS, nextPlaylistIndex, playableMediaIds } from './promotionMediaPlaylist';

describe('homepage promotion playlists', () => {
  it('cycles a multi-video playlist back to its first item', () => {
    expect(nextPlaylistIndex(0, 3)).toBe(1);
    expect(nextPlaylistIndex(1, 3)).toBe(2);
    expect(nextPlaylistIndex(2, 3)).toBe(0);
  });

  it('keeps a single video at its only index for continuous looping', () => {
    expect(nextPlaylistIndex(0, 1)).toBe(0);
    expect(nextPlaylistIndex(9, 1)).toBe(0);
  });

  it('excludes failed assets without changing the intended photo interval', () => {
    expect(playableMediaIds([{ id: 'a' }, { id: 'b' }, { id: 'c' }], new Set(['b']))).toEqual(['a', 'c']);
    expect(PHOTO_DURATION_MS).toBe(10_000);
  });
});
