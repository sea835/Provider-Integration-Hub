import {
  isFreshTimestamp,
  safeEqual,
  signCallback,
  signedPathOf,
  signRequest,
} from '@modules/provider-adapter/infrastructure/adapters/hub-standard/hub-standard.signature';

const SECRET = 'sk_sandbox_9f2c4e7a';
const TIMESTAMP = '1790906400';
const TRANS_CODE = 'TX0192a7b3c4d57e8f9a0b1c2d3e4f5a6b';

describe('Chữ ký Quy chuẩn API NCC v1 (vector trong tài liệu)', () => {
  it('POST /orders', () => {
    const body = `{"requestId":"${TRANS_CODE}","action":"BUY_DATA","packageCode":"MD7","msisdn":"0914780285","serial":null}`;
    expect(signRequest(SECRET, TIMESTAMP, 'POST', '/hub/v1/orders', body)).toBe(
      '7f0cdbd78f9290ee06ca58a3417edcb3a6b53b8dde3d886af41136f0c893c06e',
    );
  });

  it('GET /orders/{requestId} với body rỗng', () => {
    expect(
      signRequest(SECRET, TIMESTAMP, 'GET', `/hub/v1/orders/${TRANS_CODE}`, ''),
    ).toBe('8cd17375fd91631b7c8d946f2c426ebad1c093309ed48c832a8d4019d7a86934');
  });

  it('callback', () => {
    const body = `{"eventId":"EV-20261002-000123","order":{"requestId":"${TRANS_CODE}","orderId":"NCC-778812","status":"SUCCESS"}}`;
    expect(signCallback('cb_sandbox_51d0a8e3', TIMESTAMP, body)).toBe(
      '51a2ad189d33ed117a48b334f62d4896946093ffc615935b211d17689a7dd530',
    );
  });

  it('path ký gồm tiền tố base URL và query, bỏ scheme và host', () => {
    expect(signedPathOf('https://api.ncc.vn/hub/v1/orders?x=1')).toBe(
      '/hub/v1/orders?x=1',
    );
  });

  it('timestamp lệch quá 300 giây bị từ chối', () => {
    const now = Number(TIMESTAMP) * 1000;
    expect(isFreshTimestamp(TIMESTAMP, now + 299_000)).toBe(true);
    expect(isFreshTimestamp(TIMESTAMP, now + 301_000)).toBe(false);
    expect(isFreshTimestamp('abc', now)).toBe(false);
  });

  it('safeEqual so được chuỗi khác độ dài mà không throw', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});
