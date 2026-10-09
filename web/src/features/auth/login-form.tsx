"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CheckCircle, Info, WarningCircle } from "@phosphor-icons/react/ssr";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, fieldControlProps, PasswordInput } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ApiError, getErrorMessage } from "@/lib/api/errors";
import type { User } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const loginSchema = z.object({
  email: z.string().trim().min(1, "Vui lòng nhập email").pipe(z.email("Email không đúng định dạng")),
  password: z.string().min(1, "Vui lòng nhập mật khẩu").min(6, "Mật khẩu phải có ít nhất 6 ký tự"),
});

type LoginValues = z.infer<typeof loginSchema>;

function deadlineAfter(seconds: number): number {
  return Date.now() + seconds * 1000;
}

const REASON_NOTICE = {
  expired: { icon: Info, tone: "info", text: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục." },
  "signed-out": { icon: CheckCircle, tone: "success", text: "Bạn đã đăng xuất an toàn." },
} as const;

function useCountdown(until: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [until]);
  return until === null ? 0 : Math.max(0, Math.ceil((until - now) / 1000));
}

export function LoginForm({ next, reason }: { next: string; reason: "expired" | "signed-out" | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [isNavigating, startNavigation] = useTransition();
  const secondsLeft = useCountdown(lockedUntil);

  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onTouched",
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    let response: Response;
    try {
      response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
        credentials: "same-origin",
      });
    } catch {
      setServerError(getErrorMessage(ApiError.network()));
      return;
    }

    if (!response.ok) {
      const error = await ApiError.fromResponse(response);
      setServerError(getErrorMessage(error));
      if (error.status === 429) setLockedUntil(deadlineAfter(error.retryAfter ?? 60));
      if (error.status === 401) setFocus("password");
      return;
    }

    const { user } = (await response.json()) as { user: User };
    queryClient.clear();
    toast.success("Đăng nhập thành công", { description: `Xin chào, ${user.email}` });
    startNavigation(() => {
      router.replace(next as Route);
      router.refresh();
    });
  });

  const notice = reason && !serverError ? REASON_NOTICE[reason] : null;
  const busy = isSubmitting || isNavigating;
  const throttled = secondsLeft > 0;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {notice ? (
        <div
          role="status"
          className={cn(
            "flex items-start gap-2.5 rounded-md px-3 py-2.5 text-[13px] leading-relaxed",
            notice.tone === "info" ? "bg-info-soft text-info" : "bg-success-soft text-success",
          )}
        >
          <notice.icon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{notice.text}</span>
        </div>
      ) : null}

      <div aria-live="assertive">
        {serverError ? (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-md bg-danger-soft px-3 py-2.5 text-[13px] leading-relaxed text-danger"
          >
            <WarningCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{serverError}</span>
          </div>
        ) : null}
      </div>

      <Field id="email" label="Email" error={errors.email?.message}>
        <Input
          {...fieldControlProps("email", errors.email?.message)}
          {...register("email")}
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          placeholder="ban@congty.vn"
          className="h-10"
        />
      </Field>

      <Field id="password" label="Mật khẩu" error={errors.password?.message}>
        <PasswordInput
          {...fieldControlProps("password", errors.password?.message)}
          {...register("password")}
          autoComplete="current-password"
          placeholder="••••••••"
          className="h-10"
        />
      </Field>

      <Button type="submit" size="lg" className="mt-2 w-full" isLoading={busy} disabled={throttled}>
        {throttled ? `Thử lại sau ${secondsLeft} giây` : busy ? "Đang đăng nhập..." : "Đăng nhập"}
        {!busy && !throttled ? <ArrowRight aria-hidden /> : null}
      </Button>
    </form>
  );
}
