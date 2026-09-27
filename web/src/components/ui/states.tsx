import { AlertOctagon, RotateCw, ShieldOff, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { getErrorMessage, isApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import { Button } from "./button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <span className="relative mb-4 flex size-12 items-center justify-center rounded-xl border bg-card shadow-soft">
        <Icon className="size-5 text-muted-foreground" aria-hidden />
      </span>
      <h3 className="text-[15px] font-semibold">{title}</h3>
      {description ? <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  title = "Không tải được dữ liệu",
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
  className?: string;
}) {
  const requestId = isApiError(error) ? error.requestId : undefined;
  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <span className="mb-4 flex size-12 items-center justify-center rounded-xl bg-danger-soft">
        <AlertOctagon className="size-5 text-danger" aria-hidden />
      </span>
      <h3 className="text-[15px] font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{getErrorMessage(error)}</p>
      {requestId ? (
        <p className="mt-2 font-mono text-[11px] text-muted-foreground/80">
          Mã yêu cầu: <span className="select-all">{requestId}</span>
        </p>
      ) : null}
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-5" onClick={onRetry}>
          <RotateCw aria-hidden />
          Thử lại
        </Button>
      ) : null}
    </div>
  );
}

export function ForbiddenState({ description }: { description?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <span className="mb-5 flex size-14 items-center justify-center rounded-2xl border bg-card shadow-soft">
        <ShieldOff className="size-6 text-muted-foreground" aria-hidden />
      </span>
      <h1 className="text-xl font-semibold">Bạn không có quyền truy cập trang này</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {description ??
          "Tài khoản của bạn chưa được cấp quyền cần thiết. Hãy liên hệ quản trị viên nếu bạn cho rằng đây là nhầm lẫn."}
      </p>
    </div>
  );
}
