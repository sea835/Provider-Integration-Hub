import {
  conditionMatches,
  evaluate,
  render,
  renderValue,
  resolvePath,
} from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.template';

describe('Template và điều kiện của engine Tự cấu hình', () => {
  const scope = {
    order: { transCode: 'TX1', phone: '0912345678', serial: null },
    body: { code: 0, data: { items: [{ id: 'a' }, { id: 'b' }] }, message: '' },
    headers: { 'x-mk-callback-id': 'EV9' },
    http: { status: 201 },
  };

  it('đọc đường dẫn có chỉ số và tên có gạch ngang', () => {
    expect(resolvePath(scope, 'body.data.items[1].id')).toBe('b');
    expect(resolvePath(scope, 'headers.x-mk-callback-id')).toBe('EV9');
    expect(resolvePath(scope, 'body.nope.deep')).toBeUndefined();
  });

  it('|| lấy giá trị đầu tiên không rỗng, hỗ trợ chuỗi cố định', () => {
    expect(evaluate('body.message || http.status', scope)).toBe(201);
    expect(evaluate("body.event || 'ORDER_RESULT'", scope)).toBe(
      'ORDER_RESULT',
    );
  });

  it('render chuỗi và giữ kiểu khi chỉ có một biến', () => {
    expect(render('/orders/{{order.transCode}}', scope)).toBe('/orders/TX1');
    expect(render('{{order.serial}}', scope)).toBe('');
    expect(renderValue('{{body.code}}', scope)).toBe(0);
    expect(renderValue('{{order.serial}}', scope)).toBeUndefined();
  });

  it('điều kiện: 2xx, IN, NOT_IN, EXISTS', () => {
    expect(
      conditionMatches(
        { path: 'http.status', operator: 'IN', values: ['2xx'] },
        scope,
      ),
    ).toBe(true);
    expect(
      conditionMatches(
        { path: 'http.status', operator: 'IN', values: ['4xx', '500'] },
        scope,
      ),
    ).toBe(false);
    expect(
      conditionMatches(
        { path: 'body.code', operator: 'IN', values: ['0'] },
        scope,
      ),
    ).toBe(true);
    expect(
      conditionMatches(
        { path: 'body.code', operator: 'NOT_IN', values: ['0'] },
        scope,
      ),
    ).toBe(false);
    expect(
      conditionMatches(
        { path: 'body.message', operator: 'EXISTS', values: [] },
        scope,
      ),
    ).toBe(false);
  });
});
