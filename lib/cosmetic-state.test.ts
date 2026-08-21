import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROFILE_COSMETICS,
  equipBundle,
  equipCosmetic,
  normalizeCosmeticState,
} from './cosmetic-state';

describe('cosmetic state', () => {
  it('normalizes missing ownership data into a stable shared state', () => {
    expect(normalizeCosmeticState(undefined)).toEqual(DEFAULT_PROFILE_COSMETICS);
  });

  it('lets a bundle claim ownership and equip its mapped cosmetics', () => {
    const state = equipBundle(
      {
        owned: ['void-rift', 'prism'],
        equipped: { banner: 'void-rift', frame: 'prism', effect: 'none', badge: 'none', cardStyle: 'violet', bundle: '' },
      },
      'cyber'
    );

    expect(state.owned.includes('void-rift')).toBe(true);
    expect(state.equipped.bundle).toBe('cyber');
    expect(state.equipped.banner).toBe('void-rift');
    expect(state.equipped.frame).toBe('prism');
  });

  it('keeps item ownership and equipped status in sync for a single cosmetic', () => {
    const state = equipCosmetic(
      {
        owned: ['void-rift'],
        equipped: { banner: 'void-rift', frame: 'prism', effect: 'none', badge: 'none', cardStyle: 'violet', bundle: '' },
      },
      'banner',
      'nebula-pulse'
    );

    expect(state.owned.includes('nebula-pulse')).toBe(true);
    expect(state.equipped.banner).toBe('nebula-pulse');
  });
});
