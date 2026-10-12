"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { fetchTelegramSettings, sendTelegramTest, updateTelegramSettings, type TelegramSettings } from "./api";

export function useTelegramSettings() {
  return useQuery({
    queryKey: queryKeys.alertChannels.telegram,
    queryFn: ({ signal }) => fetchTelegramSettings(signal),
  });
}

export function useUpdateTelegram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateTelegramSettings,
    onSuccess: (settings) => queryClient.setQueryData<TelegramSettings>(queryKeys.alertChannels.telegram, settings),
  });
}

export function useTelegramTest() {
  return useMutation({ mutationFn: sendTelegramTest, meta: { silent: true } });
}
