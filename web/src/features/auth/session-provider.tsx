"use client";

import { subject } from "@casl/ability";
import { AbilityProvider, useAbility } from "@casl/react";
import { useQuery } from "@tanstack/react-query";
import { createContext, use, useMemo, type ReactNode } from "react";
import { api } from "@/lib/api/client";
import type { AbilitiesResponse, Session, User } from "@/lib/api/types";
import { buildAbility, type AppAbility } from "@/lib/auth/ability";
import type { Policy } from "@/lib/auth/policies";
import { queryKeys } from "@/lib/query-keys";
import { SessionErrorScreen } from "./session-error-screen";

interface SessionContextValue {
  user: User;
  refresh: () => Promise<unknown>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export async function fetchSession(): Promise<Session> {
  const [user, abilities] = await Promise.all([
    api.get<User>("/auth/me"),
    api.get<AbilitiesResponse>("/authorization/me/abilities"),
  ]);
  return { user, rules: abilities.rules };
}

interface SessionProviderProps {
  initialSession: Session | null;
  fallback: ReactNode;
  children: ReactNode;
}

export function SessionProvider({ initialSession, fallback, children }: SessionProviderProps) {
  const query = useQuery({
    queryKey: queryKeys.session,
    queryFn: fetchSession,
    initialData: initialSession ?? undefined,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: true,
  });

  const rules = query.data?.rules;
  const user = query.data?.user;
  const { refetch } = query;
  const ability = useMemo(() => buildAbility(rules ?? []), [rules]);
  const value = useMemo(() => (user ? { user, refresh: refetch } : null), [user, refetch]);

  if (!value) {
    if (query.isError) return <SessionErrorScreen error={query.error} onRetry={() => void refetch()} />;
    return fallback;
  }

  return (
    <SessionContext value={value}>
      <AbilityProvider value={ability}>{children}</AbilityProvider>
    </SessionContext>
  );
}

export function useSession(): SessionContextValue {
  const context = use(SessionContext);
  if (!context) throw new Error("useSession phải được dùng bên trong SessionProvider");
  return context;
}

export function useAppAbility(): AppAbility {
  return useAbility<AppAbility>();
}

export function usePermission(policy: Policy, target?: object): boolean {
  const ability = useAppAbility();
  const [action, subjectType] = policy;
  return target ? ability.can(action, subject(subjectType, { ...target })) : ability.can(action, subjectType);
}

export function Can({
  policy,
  target,
  children,
  fallback = null,
}: {
  policy: Policy;
  target?: object;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return usePermission(policy, target) ? children : fallback;
}
