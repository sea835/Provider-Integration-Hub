/** Bỏ các key có giá trị undefined để không ghi đè dữ liệu cũ khi update. */
export function omitUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as Partial<T>;
}
