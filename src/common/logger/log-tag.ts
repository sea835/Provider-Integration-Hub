/**
 * Tag đầu tiên của mỗi dòng log = layer theo Hexagonal.
 * Quy ước: [LAYER][BoundedContext][Component]
 *   [APP][User][UserService]
 *   [INFRA][User][UserRepository]
 *   [HTTP][User][UserController]
 *
 * Domain layer KHÔNG log trực tiếp: domain thuần, trả về kết quả / ném domain error
 * / phát domain event, việc log thuộc về application layer.
 */
export const LogLayer = {
    APPLICATION: 'APP',
    INFRASTRUCTURE: 'INFRA',
    PRESENTATION: 'HTTP',
    SYSTEM: 'SYS',
} as const;

export type LogLayer = (typeof LogLayer)[keyof typeof LogLayer];
