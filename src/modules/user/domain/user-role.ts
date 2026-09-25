export const Role = {
  ADMIN: 'ADMIN',
  USER: 'USER',
  MANAGER: 'MANAGER',
} as const;

export type RoleType = (typeof Role)[keyof typeof Role];

export const ROLE_VALUES = Object.values(Role);
