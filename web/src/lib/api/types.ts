export const SYSTEM_ROLES = ["ADMIN", "MANAGER", "USER"] as const;

export type SystemRole = (typeof SYSTEM_ROLES)[number];

export interface User {
  id: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  metadata: Record<string, unknown> | null;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
}

export interface Role {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Permission {
  id: string;
  action: string;
  subject: string;
  conditions?: Record<string, unknown> | null;
  description?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export type PackedRule = [string, string | null, ...unknown[]];

export interface AbilitiesResponse {
  rules: PackedRule[];
}

export interface Session {
  user: User;
  rules: PackedRule[];
}

export interface LivenessResponse {
  status: "ok";
  uptimeSeconds: number;
  timestamp: string;
}

export interface DependencyCheck {
  status: "up" | "down";
  latencyMs: number;
}

export interface ReadinessResponse {
  status: "ok";
  checks: { database: DependencyCheck };
  timestamp: string;
}

export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  details?: unknown;
  timestamp?: string;
  path?: string;
  requestId?: string;
}
