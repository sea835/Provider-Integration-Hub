/**
 * Chạy một khối nghiệp vụ trong một DB transaction.
 * Gọi lồng nhau thì dùng lại transaction bên ngoài.
 */
export abstract class TransactionRunnerPort {
  abstract run<T>(fn: () => Promise<T>): Promise<T>;
}
