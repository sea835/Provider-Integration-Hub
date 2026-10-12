import {
  conditionMatches,
  evaluate,
  render,
  renderValue,
  resolvePath,
} from '@modules/provider/infrastructure/http-config/http-config.template';

describe('Template và điều kiện của engine HTTP_CONFIG', () => {
  const scope = {
    vars: { partnerCode: 'PQ01', channel: '' },
    body: { code: 0, data: { items: [{ id: 'a' }, { id: 'b' }] }, message: '' },
    headers: { 'x-request-id': 'EV9' },
    http: { status: 201 },
  };

  it('đọc đường dẫn có chỉ số và tên có gạch ngang', () => {
    expect(resolvePath(scope, 'body.data.items[1].id')).toBe('b');
    expect(resolvePath(scope, 'body.data.items.0.id')).toBe('a');
    expect(resolvePath(scope, 'headers.x-request-id')).toBe('EV9');
    expect(resolvePath(scope, 'body.nope.deep')).toBeUndefined();
  });

  it('|| lấy giá trị đầu tiên không rỗng, hỗ trợ chuỗi cố định', () => {
    expect(evaluate('body.message || http.status', scope)).toBe(201);
    expect(evaluate("vars.channel || 'API'", scope)).toBe('API');
  });

  it('render chuỗi và giữ kiểu khi chỉ có một biến', () => {
    expect(render('/partners/{{vars.partnerCode}}', scope)).toBe(
      '/partners/PQ01',
    );
    expect(render('{{vars.channel}}', scope)).toBe('');
    expect(renderValue('{{body.code}}', scope)).toBe(0);
    expect(renderValue('{{vars.missing}}', scope)).toBeUndefined();
  });

  it('điều kiện: 2xx, IN, NOT_IN, EXISTS', () => {
    const matches = (path: string, operator: string, values: string[]) =>
      conditionMatches({ path, operator, values } as never, scope);
    expect(matches('http.status', 'IN', ['2xx'])).toBe(true);
    expect(matches('http.status', 'IN', ['4xx', '500'])).toBe(false);
    expect(matches('body.code', 'IN', ['0'])).toBe(true);
    expect(matches('body.code', 'NOT_IN', ['0'])).toBe(false);
    expect(matches('body.message', 'EXISTS', [])).toBe(false);
    expect(matches('body.message', 'NOT_EXISTS', [])).toBe(true);
  });
});
