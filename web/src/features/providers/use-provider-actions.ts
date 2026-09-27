"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api/errors";
import { useTestConnection, useTriggerSync } from "./hooks";
import type { Provider, SyncStatus } from "./types";

export function useProviderActions(provider: Pick<Provider, "id" | "name" | "status" | "lastSyncStatus">) {
  const testConnection = useTestConnection();
  const triggerSync = useTriggerSync();

  const test = () =>
    testConnection.mutate(provider.id, {
      onSuccess: (result) => {
        if (result.success) {
          toast.success("Kết nối thành công", { description: `${provider.name} phản hồi sau ${result.latencyMs} ms` });
        } else {
          toast.error("Kết nối thất bại", { description: result.message });
        }
      },
      onError: (error) => toast.error("Không thể kiểm tra kết nối", { description: getErrorMessage(error) }),
    });

  const sync = () =>
    triggerSync.mutate(provider.id, {
      onSuccess: () => toast.info("Đã bắt đầu đồng bộ", { description: `${provider.name} đang được đồng bộ dữ liệu.` }),
    });

  return {
    test,
    sync,
    isTesting: testConnection.isPending,
    isSyncing: triggerSync.isPending || provider.lastSyncStatus === "RUNNING",
    canSync: provider.status !== "INACTIVE",
    lastTest: testConnection.data,
  };
}

export function useSyncCompletionToasts(providers: Provider[] | undefined) {
  const previous = useRef(new Map<string, SyncStatus>());

  useEffect(() => {
    if (!providers) return;
    for (const provider of providers) {
      const before = previous.current.get(provider.id);
      if (before === "RUNNING" && provider.lastSyncStatus === "SUCCESS") {
        toast.success(`Đồng bộ hoàn tất: ${provider.name}`, { description: provider.lastSyncMessage ?? undefined });
      }
      if (before === "RUNNING" && provider.lastSyncStatus === "FAILED") {
        toast.error(`Đồng bộ thất bại: ${provider.name}`, { description: provider.lastSyncMessage ?? undefined });
      }
      previous.current.set(provider.id, provider.lastSyncStatus);
    }
  }, [providers]);
}
