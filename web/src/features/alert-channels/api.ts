import { api } from "@/lib/api/client";

export type TelegramSource = "DATABASE" | "ENV" | "NONE";

export interface TelegramSettings {
  source: TelegramSource;
  enabled: boolean;
  chatId: string;
  hasBotToken: boolean;
  updatedAt: string | null;
}

export interface TelegramInput {
  enabled?: boolean;
  chatId?: string;
  botToken?: string;
}

export interface DeliveryResult {
  status: "SENT" | "FAILED" | "DISABLED";
  detail: string | null;
}

export function fetchTelegramSettings(signal?: AbortSignal): Promise<TelegramSettings> {
  return api.get<TelegramSettings>("/admin/alert-channels/telegram", { signal });
}

export function updateTelegramSettings(input: TelegramInput): Promise<TelegramSettings> {
  return api.put<TelegramSettings>("/admin/alert-channels/telegram", input);
}

export function sendTelegramTest(input: TelegramInput): Promise<DeliveryResult> {
  return api.post<DeliveryResult>("/admin/alert-channels/telegram/test", input);
}
