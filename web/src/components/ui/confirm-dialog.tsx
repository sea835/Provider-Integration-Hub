"use client";

import { AlertTriangle } from "lucide-react";
import { AlertDialog as AlertDialogPrimitive } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  tone?: "danger" | "default";
  isPending?: boolean;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  tone = "default",
  isPending = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={(next) => (isPending ? undefined : onOpenChange(next))}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <AlertDialogPrimitive.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border bg-popover shadow-lift duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95">
          <div className="flex gap-4 px-6 pt-6 pb-5">
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-full",
                tone === "danger" ? "bg-danger-soft text-danger" : "bg-primary-soft text-primary",
              )}
              aria-hidden
            >
              <AlertTriangle className="size-5" />
            </span>
            <div className="min-w-0 space-y-1.5">
              <AlertDialogPrimitive.Title className="text-base font-semibold">{title}</AlertDialogPrimitive.Title>
              <AlertDialogPrimitive.Description className="text-sm text-muted-foreground">
                {description}
              </AlertDialogPrimitive.Description>
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 border-t bg-subtle px-6 py-4 sm:flex-row sm:justify-end">
            <AlertDialogPrimitive.Cancel asChild>
              <Button variant="outline" disabled={isPending}>
                Hủy
              </Button>
            </AlertDialogPrimitive.Cancel>
            <Button variant={tone === "danger" ? "destructive" : "default"} isLoading={isPending} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
