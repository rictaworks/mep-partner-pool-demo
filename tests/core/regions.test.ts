import { expect, it } from 'vitest';
import { REGIONS, expandRegions, coversRegion } from '../../src/core/regions';
it('defines 70 unique regions with 49 Tokyo and 19 Kanagawa municipalities', () => {
  expect(REGIONS).toHaveLength(70);
  expect(new Set(REGIONS.map(r => r.code)).size).toBe(70);
  expect(REGIONS.filter(r => r.pref === '東京都' && !r.isWholePref)).toHaveLength(49);
  expect(REGIONS.filter(r => r.pref === '神奈川県' && !r.isWholePref)).toHaveLength(19);
  expect(expandRegions(['13-all'])).toHaveLength(49);
  expect(expandRegions(['14-all'])).toHaveLength(19);
  expect(expandRegions(['13-all', '13101'])).toHaveLength(49);
  expect(coversRegion(['13-all'], '14100')).toBe(false);
  expect(coversRegion(['13-all'], '13101')).toBe(true);
});
