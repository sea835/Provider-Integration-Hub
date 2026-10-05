import { normalizeIp } from '@common/libs/normalize-ip';

describe('normalizeIp', () => {
  it.each([
    ['::ffff:203.0.113.10', '203.0.113.10'],
    ['203.0.113.10', '203.0.113.10'],
    ['::1', '127.0.0.1'],
    ['::ffff:127.0.0.1', '127.0.0.1'],
    ['2001:db8::1', '2001:db8::1'],
    [undefined, ''],
  ])('%s → %s', (input, expected) => {
    expect(normalizeIp(input)).toBe(expected);
  });
});
