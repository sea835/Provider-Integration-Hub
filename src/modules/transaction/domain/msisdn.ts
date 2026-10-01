/**
 * Chuẩn hoá SĐT Việt Nam về dạng `0xxxxxxxxx` (10 số).
 * Trả về null nếu không hợp lệ (bao gồm số 11 số cũ).
 */
export function normalizeVnPhone(input: string): string | null {
  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('84')) {
    digits = `0${digits.slice(2)}`;
  } else if (!digits.startsWith('0')) {
    digits = `0${digits}`;
  }
  return /^0\d{9}$/.test(digits) ? digits : null;
}
