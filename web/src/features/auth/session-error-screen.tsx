"use client";

import { SignOut } from "@phosphor-icons/react/ssr";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";
import { signOutAndRedirect } from "@/lib/api/client";

export function SessionErrorScreen({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="flex w-full max-w-lg flex-col items-center rounded-xl bg-card pb-6 shadow-lift">
        <ErrorState error={error} onRetry={onRetry} title="Không thể tải phiên làm việc" />
        <Button variant="ghost" size="sm" onClick={() => void signOutAndRedirect("signed-out")}>
          <SignOut aria-hidden />
          Đăng nhập lại
        </Button>
      </div>
    </div>
  );
}
