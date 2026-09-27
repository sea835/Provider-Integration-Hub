import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { AppShellSkeleton } from "@/components/layout/app-shell-skeleton";
import { SessionProvider } from "@/features/auth/session-provider";
import { getServerSession } from "@/lib/server/get-session";

export default async function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession();
  return (
    <SessionProvider initialSession={session} fallback={<AppShellSkeleton />}>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}
