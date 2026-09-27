export const PROVIDER_STATUSES = ["ACTIVE", "INACTIVE", "ERROR"] as const;
export type ProviderStatus = (typeof PROVIDER_STATUSES)[number];

export const PROVIDER_AUTH_TYPES = ["API_KEY", "OAUTH2", "BASIC"] as const;
export type ProviderAuthType = (typeof PROVIDER_AUTH_TYPES)[number];

export const PROVIDER_CATEGORIES = ["CRM", "ERP", "LOGISTICS", "PAYMENT", "MESSAGING", "OTHER"] as const;
export type ProviderCategory = (typeof PROVIDER_CATEGORIES)[number];

export type SyncStatus = "SUCCESS" | "FAILED" | "RUNNING" | "NEVER";

export type ProviderLogType = "SYNC" | "CONNECTION_TEST" | "CONFIG_UPDATE";

export type ProviderLogStatus = "SUCCESS" | "FAILED" | "RUNNING";

export interface ProviderCredentialSummary {
  apiKeyLast4: string | null;
  clientId: string | null;
  username: string | null;
  hasSecret: boolean;
  updatedAt: string | null;
}

export interface Provider {
  id: string;
  code: string;
  name: string;
  category: ProviderCategory;
  description: string | null;
  baseUrl: string;
  authType: ProviderAuthType;
  status: ProviderStatus;
  timeoutMs: number;
  syncIntervalMinutes: number;
  credentials: ProviderCredentialSummary;
  lastSyncAt: string | null;
  lastSyncStatus: SyncStatus;
  lastSyncMessage: string | null;
  lastConnectionCheckAt: string | null;
  lastLatencyMs: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderLog {
  id: string;
  providerId: string;
  providerName: string;
  type: ProviderLogType;
  status: ProviderLogStatus;
  message: string;
  durationMs: number | null;
  recordsProcessed: number | null;
  triggeredBy: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface ConnectionTestResult {
  success: boolean;
  latencyMs: number;
  statusCode: number | null;
  message: string;
  checkedAt: string;
}

export interface ProviderCredentialsInput {
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  username?: string;
  password?: string;
}

export interface ProviderInput {
  code: string;
  name: string;
  category: ProviderCategory;
  description?: string;
  baseUrl: string;
  authType: ProviderAuthType;
  timeoutMs: number;
  syncIntervalMinutes: number;
  status: Exclude<ProviderStatus, "ERROR">;
  credentials?: ProviderCredentialsInput;
}

export type ProviderUpdateInput = Partial<Omit<ProviderInput, "code">>;

export interface ProviderRepository {
  list(): Promise<Provider[]>;
  get(id: string): Promise<Provider>;
  create(input: ProviderInput, actor: string): Promise<Provider>;
  update(id: string, input: ProviderUpdateInput, actor: string): Promise<Provider>;
  remove(id: string): Promise<void>;
  testConnection(id: string, actor: string): Promise<ConnectionTestResult>;
  triggerSync(id: string, actor: string): Promise<ProviderLog>;
  logs(id: string, limit?: number): Promise<ProviderLog[]>;
  recentActivity(limit?: number): Promise<ProviderLog[]>;
  resetDemoData?(): Promise<void>;
}
