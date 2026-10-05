import { Condition } from '@modules/provider-adapter/infrastructure/adapters/http-config/http-config.types';

/**
 * Template chỉ thay giá trị, không chạy code: `{{order.transCode}}`, `{{body.code || http.status}}`,
 * `{{body.event || 'ORDER_RESULT'}}`. Đường dẫn hỗ trợ `a.b`, `items[0].id`, `headers.x-api-key`.
 */
const PLACEHOLDER = /\{\{\s*([^{}]+?)\s*\}\}/g;
const WHOLE_PLACEHOLDER = /^\{\{\s*([^{}]+?)\s*\}\}$/;
const HTTP_CLASS = /^([1-5])xx$/i;

export type Scope = Record<string, unknown>;

function segments(path: string): string[] {
  return path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .map((part) => part.trim())
    .filter(Boolean);
}

export function resolvePath(root: unknown, path: string): unknown {
  let current: unknown = root;
  for (const key of segments(path)) {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) {
      current = /^\d+$/.test(key) ? current[Number(key)] : undefined;
    } else if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return current;
}

export function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

/** `a || b || 'literal'`: lấy giá trị đầu tiên không rỗng. */
export function evaluate(expression: string, scope: Scope): unknown {
  for (const raw of expression.split('||')) {
    const part = raw.trim();
    if (!part) continue;
    const literal = /^'(.*)'$/.exec(part) ?? /^"(.*)"$/.exec(part);
    const value = literal ? literal[1] : resolvePath(scope, part);
    if (!isEmpty(value)) return value;
  }
  return undefined;
}

const EACH = '[*].';

function isLiteral(part: string): boolean {
  return /^'.*'$/.test(part) || /^".*"$/.test(part);
}

/**
 * Đường dẫn đọc trong MỘT đơn/gói. `[*]` nghĩa là "từng phần tử của danh sách":
 * `data.items[*].status` đọc `status` của mỗi đơn, phần `data.items[*].` chỉ để ghi rõ đơn nằm ở đâu.
 */
export function itemExpression(expression: string): string {
  return expression
    .split('||')
    .map((raw) => {
      const part = raw.trim();
      if (isLiteral(part)) return part;
      const at = part.lastIndexOf(EACH);
      return at >= 0 ? part.slice(at + EACH.length) : part;
    })
    .join(' || ');
}

/** `data.items[*].status` → `data.items`: danh sách chứa các phần tử. */
export function listAnchor(expression: string): string | null {
  for (const raw of expression.split('||')) {
    const part = raw.trim();
    if (isLiteral(part)) continue;
    const at = part.lastIndexOf(EACH);
    if (at >= 0) return part.slice(0, at);
  }
  return null;
}

export function evaluateItem(expression: string, item: unknown): unknown {
  return evaluate(itemExpression(expression), (item ?? {}) as Scope);
}

export function asString(value: unknown): string {
  if (isEmpty(value)) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

export function render(
  template: string,
  scope: Scope,
  encode: (value: string) => string = (value) => value,
): string {
  return template.replace(PLACEHOLDER, (_match, expression: string) =>
    encode(asString(evaluate(expression, scope))),
  );
}

/** Template chỉ gồm một biến thì giữ nguyên kiểu giá trị (null, số...). */
export function renderValue(template: string, scope: Scope): unknown {
  const whole = WHOLE_PLACEHOLDER.exec(template.trim());
  return whole ? evaluate(whole[1], scope) : render(template, scope);
}

function matchesValue(actual: unknown, expected: string): boolean {
  const httpClass = HTTP_CLASS.exec(expected.trim());
  if (httpClass && typeof actual === 'number') {
    return Math.floor(actual / 100) === Number(httpClass[1]);
  }
  return asString(actual) === expected.trim();
}

export function conditionMatches(condition: Condition, scope: Scope): boolean {
  const actual = evaluate(condition.path, scope);
  switch (condition.operator) {
    case 'EXISTS':
      return !isEmpty(actual);
    case 'NOT_EXISTS':
      return isEmpty(actual);
    case 'IN':
      return condition.values.some((value) => matchesValue(actual, value));
    case 'NOT_IN':
      return !condition.values.some((value) => matchesValue(actual, value));
  }
}

export function allMatch(conditions: Condition[], scope: Scope): boolean {
  return conditions.every((condition) => conditionMatches(condition, scope));
}

export function anyMatch(conditions: Condition[], scope: Scope): boolean {
  return conditions.some((condition) => conditionMatches(condition, scope));
}

/** Đặt giá trị theo đường dẫn `a.b.c` để dựng body JSON lồng nhau. */
export function setPath(
  target: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const keys = segments(path);
  let current = target;
  keys.forEach((key, index) => {
    if (index === keys.length - 1) {
      current[key] = value;
      return;
    }
    const next = current[key];
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  });
}
