"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";
import { signOutAndRedirect } from "@/lib/api/client";

export function SessionErrorScreen({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4">
      <ErrorState error={error} onRetry={onRetry} title="Không thể tải phiên làm việc" />
      <Button variant="ghost" size="sm" onClick={() => void signOutAndRedirect("signed-out")}>
        <LogOut aria-hidden />
        Đăng nhập lại
      </Button>
    </div>
  );
}
