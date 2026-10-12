"use client";

import { CheckCircle, FloppyDisk, PaperPlaneTilt, WarningOctagon } from "@phosphor-icons/react/ssr";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Field, fieldControlProps, PasswordInput } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { Switch } from "@/components/ui/switch";
import { usePermission } from "@/features/auth/session-provider";
import { getErrorMessage } from "@/lib/api/errors";
import { POLICIES } from "@/lib/auth/policies";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TelegramSettings } from "./api";
import { useTelegramSettings, useTelegramTest, useUpdateTelegram } from "./hooks";

const ALERT_KINDS = [
  ["Số dư thấp", "Khi số dư xuống dưới ngưỡng cảnh báo sớm hoặc ngưỡng khẩn cấp, và nhắc lại theo thời gian đã đặt."],
  ["Đã nạp tiền", "Khi số dư trở lại trên ngưỡng."],
  ["Lỗi kết nối", "Khi kiểm tra số dư lỗi 3 lần liên tiếp."],
  ["Đã kết nối lại", "Lần kiểm tra thành công đầu tiên sau chuỗi lỗi."],
] as const;

function stateOf(settings: TelegramSettings): { label: string; tone: BadgeTone } {
  if (!settings.hasBotToken || !settings.chatId) return { label: "Chưa cấu hình", tone: "warning" };
  return settings.enabled ? { label: "Đang gửi cảnh báo", tone: "success" } : { label: "Đang tắt", tone: "neutral" };
}

function TelegramForm({ settings, readOnly }: { settings: TelegramSettings; readOnly: boolean }) {
  const save = useUpdateTelegram();
  const test = useTelegramTest();
  const [enabled, setEnabled] = useState(settings.enabled);
  const [chatId, setChatId] = useState(settings.chatId);
  const [botToken, setBotToken] = useState("");
  const state = stateOf(settings);
  const fromEnv = settings.source === "ENV";
  const dirty = enabled !== settings.enabled || chatId.trim() !== settings.chatId || botToken !== "";
  const tokenHint = fromEnv
    ? "Đang dùng token từ biến môi trường. Nhập token tại đây để lưu trên hệ thống."
    : settings.hasBotToken
      ? "Đã có token. Để trống để giữ nguyên."
      : "Lấy từ @BotFather, có dạng 123456789:AA...";

  const onSave = () =>
    save.mutate(
      { enabled, chatId: chatId.trim(), botToken },
      {
        onSuccess: () => {
          setBotToken("");
          toast.success("Đã lưu kênh Telegram");
        },
      },
    );

  const result = test.data;
  const testError = test.error ? getErrorMessage(test.error) : null;

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2.5">
            Telegram
            <Badge tone={state.tone}>{state.label}</Badge>
          </CardTitle>
          <CardDescription>
            Mọi cảnh báo gửi vào một nhóm hoặc kênh Telegram.
            {settings.updatedAt ? ` Cập nhật ${formatRelative(settings.updatedAt)}.` : ""}
          </CardDescription>
        </div>
        <label className="flex items-center gap-2 text-[13px] font-medium">
          <Switch checked={enabled} onCheckedChange={setEnabled} disabled={readOnly || save.isPending} />
          Gửi cảnh báo
        </label>
      </div>

      {fromEnv ? (
        <p className="mt-4 rounded-lg bg-info-soft px-3 py-2.5 text-[13px] leading-relaxed text-foreground/85">
          Đang dùng <code className="font-mono text-xs">TELEGRAM_BOT_TOKEN</code> và{" "}
          <code className="font-mono text-xs">TELEGRAM_CHAT_ID</code> từ biến môi trường. Sau khi lưu tại đây, hệ thống
          dùng giá trị trên trang này thay cho biến môi trường.
        </p>
      ) : null}

      <div className="mt-4 grid gap-4">
        <Field id="telegram-token" label="Bot token" hint={tokenHint}>
          <PasswordInput
            {...fieldControlProps("telegram-token", undefined, tokenHint)}
            value={botToken}
            onChange={(event) => setBotToken(event.target.value)}
            placeholder={settings.hasBotToken ? "••••••••" : "123456789:AA..."}
            autoComplete="new-password"
            spellCheck={false}
            disabled={readOnly || save.isPending}
            className="font-mono text-[13px]"
          />
        </Field>
        <Field
          id="telegram-chat"
          label="Chat ID"
          hint="Id của nhóm hoặc kênh nhận tin, ví dụ -1001234567890 hoặc @ten_kenh."
        >
          <Input
            {...fieldControlProps("telegram-chat", undefined, "hint")}
            value={chatId}
            onChange={(event) => setChatId(event.target.value)}
            placeholder="-1001234567890"
            autoComplete="off"
            spellCheck={false}
            disabled={readOnly || save.isPending}
            className="font-mono text-[13px]"
          />
        </Field>
      </div>

      {readOnly ? null : (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button disabled={!dirty} isLoading={save.isPending} onClick={onSave}>
            {save.isPending ? null : <FloppyDisk aria-hidden />}
            Lưu
          </Button>
          <Button
            variant="outline"
            isLoading={test.isPending}
            onClick={() => test.mutate({ chatId: chatId.trim(), botToken })}
          >
            {test.isPending ? null : <PaperPlaneTilt aria-hidden />}
            Gửi tin thử
          </Button>
          <p className="text-xs text-muted-foreground">Tin thử dùng giá trị đang nhập, chưa cần lưu.</p>
        </div>
      )}

      <div aria-live="polite">
        {result || testError ? (
          <div
            role={result?.status === "SENT" ? "status" : "alert"}
            className={cn(
              "mt-4 flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-[13px] leading-relaxed",
              result?.status === "SENT" ? "bg-success-soft" : "bg-danger-soft",
            )}
          >
            {result?.status === "SENT" ? (
              <CheckCircle className="mt-0.5 size-4 shrink-0 text-success" weight="fill" aria-hidden />
            ) : (
              <WarningOctagon className="mt-0.5 size-4 shrink-0 text-danger" weight="fill" aria-hidden />
            )}
            <p>
              {result?.status === "SENT"
                ? "Đã gửi tin thử. Kiểm tra nhóm Telegram của bạn."
                : (result?.detail ?? testError ?? "Không gửi được tin thử.")}
            </p>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export function TelegramView() {
  const { data, isPending, isError, error, refetch } = useTelegramSettings();
  const canUpdate = usePermission(POLICIES.alertChannels.update);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Giám sát số dư"
        title="Kênh thông báo"
        description="Nơi nhận cảnh báo số dư thấp, tin phục hồi và lỗi kết nối tới đối tác."
      />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        {isPending ? (
          <Skeleton className="h-80 w-full rounded-xl" />
        ) : isError ? (
          <Card>
            <ErrorState error={error} onRetry={() => void refetch()} />
          </Card>
        ) : (
          <TelegramForm key={`${data.source}-${data.updatedAt ?? ""}`} settings={data} readOnly={!canUpdate} />
        )}

        <div className="grid gap-4">
          <Card className="p-4 sm:p-5">
            <CardTitle>Cách lấy bot token và Chat ID</CardTitle>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-[13px] leading-relaxed text-muted-foreground">
              <li>
                Trên Telegram, nhắn <span className="font-medium text-foreground">@BotFather</span>, gõ{" "}
                <code className="font-mono text-xs">/newbot</code> để tạo bot và nhận token.
              </li>
              <li>Thêm bot vào nhóm sẽ nhận cảnh báo.</li>
              <li>
                Gửi một tin bất kỳ trong nhóm, rồi mở{" "}
                <code className="font-mono text-xs break-all">api.telegram.org/bot&lt;token&gt;/getUpdates</code> để xem{" "}
                <code className="font-mono text-xs">chat.id</code>. Id của nhóm thường là số âm.
              </li>
              <li>Dán token và Chat ID vào đây, bấm Gửi tin thử, rồi Lưu.</li>
            </ol>
          </Card>
          <Card className="p-4 sm:p-5">
            <CardTitle>Những tin sẽ được gửi</CardTitle>
            <dl className="mt-3 grid gap-2.5 text-[13px] leading-relaxed">
              {ALERT_KINDS.map(([name, text]) => (
                <div key={name}>
                  <dt className="font-medium">{name}</dt>
                  <dd className="text-muted-foreground">{text}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
