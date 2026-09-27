"use client";

import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, useTheme } from "next-themes";
import { useState, type ReactNode } from "react";
import { toast, Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getErrorMessage, isApiError } from "@/lib/api/errors";

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: { silent?: boolean };
  }
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    mutationCache: new MutationCache({
      onError: (error, _variables, _result, mutation) => {
        if (mutation.meta?.silent) return;
        toast.error(getErrorMessage(error));
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (isApiError(error) && error.status >= 400 && error.status < 500) return false;
          return failureCount < 2;
        },
      },
    },
  });
}

function AppToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="top-right"
      richColors
      closeButton
      duration={4500}
      offset={{ top: 76, right: 20 }}
      mobileOffset={{ top: 72, left: 12, right: 12 }}
      toastOptions={{ classNames: { toast: "font-sans !rounded-xl !shadow-lift" } }}
    />
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={250}>
          {children}
          <AppToaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
