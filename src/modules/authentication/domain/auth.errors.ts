export class InvalidCredentialsError extends Error {
  constructor(message = 'Email hoặc mật khẩu không chính xác') {
    super(message);
    this.name = 'InvalidCredentialsError';
  }
}

export class AccountBlockedError extends Error {
  constructor(message = 'Tài khoản của bạn đã bị vô hiệu hóa hoặc tạm khóa') {
    super(message);
    this.name = 'AccountBlockedError';
  }
}

export class SessionExpiredError extends Error {
  constructor(message = 'Phiên làm việc đã hết hạn hoặc đã bị thu hồi') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}
