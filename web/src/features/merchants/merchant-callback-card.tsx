"use client";

import { CheckCircle2, KeyRound, Send, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, fieldControlProps } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { getErrorMessage } from "@/lib/api/errors";
import { CallbackSecretDialog } from "./callback-secret-dialog";
import { useMerchantCallbacks, useRotateCallbackSecret, useTestMerchantCallback, useUpdateMerchant } from "./hooks";
import { MaskedKey } from "./merchant-visuals";
import { StoreCallbackList } from "./store-callback-list";
import type { Merchant } from "./types";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

const HEADERS: Array<[string, string]> = [
  ["X-Hub-Event", "order.completed, order.failed, order.cancelled (hoặc ping khi gửi thử)"],
  ["X-Hub-Event-Id", "Mã duy nhất của lần báo; gửi lại vẫn giữ nguyên mã này"],
  ["X-Hub-Timestamp", "Thời điểm ký, tính bằng giây (unix)"],
  ["X-Hub-Signature", 'sha256=hex(HMAC-SHA256(khoá ký, "<timestamp>.<body thô>"))'],
];

const SAMPLE_BODY = `{
  "eventId": "0192a7b3-c4d5-7e8f-9a0b-1c2d3e4f5a6b",
  "event": "order.completed",
  "createdAt": "2026-10-05T07:10:27.888Z",
  "data": {
    "transCode": "0192a7b3-…",
    "requestId": "REQ-001",
    "status": "COMPLETED",
    "supplierCode": "ANI_PROD",
    "action": "ACTIVATE_SIM",
    "packageCode": "…",
    "phone": null,
    "serial": null,
    "delivery": { "msisdn": "…", "serial": "…", "lpa": "LPA:1$…", "qrUrl": "https://…" },
    "error": null,
    "createdAt": "…",
    "completedAt": "…"
  }
}`;

const VERIFY_SAMPLE = `const crypto = require("crypto");

app.post("/hub/callback", express.raw({ type: "application/json" }), (req, res) => {
  const timestamp = req.get("X-Hub-Timestamp");
  const expected = "sha256=" + crypto
    .createHmac("sha256", process.env.HUB_CALLBACK_SECRET)
    .update(timestamp + "." + req.body)
    .digest("hex");
  const given = req.get("X-Hub-Signature") || "";
  const fresh = Math.abs(Date.now() / 1000 - Number(timestamp)) < 300;
  const valid =
    given.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!valid || !fresh) return res.sendStatus(401);

  const callback = JSON.parse(req.body);
  saveOnce(callback.eventId, callback.data);
  res.sendStatus(200);
});`;

function urlProblem(value: string): string | undefined {
  if (!value.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return "Chỉ nhận địa chỉ http hoặc https";
    return undefined;
  } catch {
    return "Địa chỉ chưa đúng, cần đủ dạng https://ten-mien/duong-dan";
  }
}

function insecure(value: string | null): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" && !LOCAL_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

function UrlForm({ merchant }: { merchant: Merchant }) {
  const update = useUpdateMerchant(merchant.id);
  const [value, setValue] = useState(merchant.callbackUrl ?? "");
  const [error, setError] = useState<string>();
  const dirty = value.trim() !== (merchant.callbackUrl ?? "");
  const id = `callback-url-${merchant.id}`;

  const save = () => {
    const problem = urlProblem(value);
    setError(problem);
    if (problem) return;
    const next = value.trim() || null;
    if (!next && merchant.callbackEnabled) {
      setError("Tắt callback trước khi xoá địa chỉ");
      return;
    }
    update.mutate(
      { callbackUrl: next },
      {
        onSuccess: () => toast.success(next ? "Đã lưu địa chỉ callback" : "Đã xoá địa chỉ callback"),
        onError: (failure) => toast.error("Không lưu được", { description: getErrorMessage(failure) }),
      },
    );
  };

  return (
    <form
      noValidate
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <Field
        id={id}
        label="Địa chỉ nhận callback"
        error={error}
        hint={
          insecure(merchant.callbackUrl)
            ? "Đang dùng http: dữ liệu đơn đi không mã hoá. Chạy thật nên dùng https."
            : "Hub POST JSON vào đây. Chạy thật nên dùng https."
        }
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            {...fieldControlProps(id, error, "hint")}
            value={value}
            maxLength={1000}
            inputMode="url"
            placeholder="https://store.example.com/hub/callback"
            className="font-mono"
            onChange={(event) => {
              setValue(event.target.value);
              setError(undefined);
            }}
          />
          <Button type="submit" variant="outline" disabled={!dirty} isLoading={update.isPending} className="sm:w-24">
            Lưu
          </Button>
        </div>
      </Field>
    </form>
  );
}

function TestPanel({ merchant }: { merchant: Merchant }) {
  const test = useTestMerchantCallback(merchant.id);
  const ready = Boolean(merchant.callbackUrl && merchant.hasCallbackSecret);
  const result = test.data;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium">Gửi thử</p>
          <p className="text-[13px] text-muted-foreground">
            Gửi sự kiện <code className="font-mono">ping</code> có ký tới địa chỉ trên, kể cả khi chưa bật.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={!ready}
          isLoading={test.isPending}
          onClick={() =>
            test.mutate(undefined, {
              onError: (error) => toast.error("Không gửi thử được", { description: getErrorMessage(error) }),
            })
          }
        >
          {test.isPending ? null : <Send aria-hidden />}
          Gửi thử
        </Button>
      </div>
      {result ? (
        <div
          role="status"
          className={
            result.ok
              ? "grid gap-1.5 rounded-lg bg-success-soft p-3 text-[13px] text-success"
              : "grid gap-1.5 rounded-lg bg-danger-soft p-3 text-[13px] text-danger"
          }
        >
          <p className="flex flex-wrap items-center gap-2 font-medium">
            {result.ok ? <CheckCircle2 className="size-4" aria-hidden /> : <XCircle className="size-4" aria-hidden />}
            {result.ok ? "Store đã nhận" : "Store chưa nhận được"}
            <span className="font-mono text-[12px] font-normal">
              {result.httpStatus ? `HTTP ${result.httpStatus} · ` : ""}
              {result.durationMs} ms
            </span>
          </p>
          {result.error ? <p className="break-words">{result.error}</p> : null}
          {result.response ? (
            <pre className="max-h-32 scrollbar-thin overflow-auto rounded-md bg-card/70 px-2.5 py-1.5 font-mono text-[11.5px] whitespace-pre-wrap text-foreground">
              {result.response}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function StoreGuide() {
  return (
    <details className="group rounded-lg border">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium select-none hover:bg-subtle/60">
        Store nhận và xác thực callback thế nào
      </summary>
      <div className="grid gap-4 border-t px-4 py-4 text-[13px]">
        <ul className="grid list-disc gap-1.5 pl-5 text-muted-foreground">
          <li>Hub gửi khi đơn chốt thành công, thất bại hoặc bị huỷ. Đơn đang xử lý không gửi.</li>
          <li>
            Store trả HTTP 2xx trong 10 giây là xong. Trả mã khác hoặc quá giờ thì Hub gửi lại sau 10s, 30s, 1 phút, 5
            phút… tối đa 11 lần trong khoảng 13 giờ.
          </li>
          <li>
            Có thể nhận trùng (gửi lại, vận hành bấm gửi lại): lưu theo <code className="font-mono">eventId</code>, gặp
            lại thì bỏ qua nhưng vẫn trả 200.
          </li>
          <li>
            Phần <code className="font-mono">data</code> giống hệt kết quả của{" "}
            <code className="font-mono">GET /v1/orders/&#123;transCode&#125;</code>.
          </li>
          <li>Kiểm tra chữ ký trên body thô (chưa parse JSON) và bỏ qua callback ký quá 5 phút.</li>
        </ul>
        <div className="grid gap-1.5">
          <p className="font-medium">Header</p>
          <dl className="grid gap-1.5 rounded-md border p-3">
            {HEADERS.map(([name, meaning]) => (
              <div key={name} className="grid gap-0.5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-3">
                <dt className="font-mono text-[12.5px]">{name}</dt>
                <dd className="text-muted-foreground">{meaning}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="grid gap-1.5">
          <p className="font-medium">Body</p>
          <pre className="max-h-72 scrollbar-thin overflow-auto rounded-md border bg-subtle px-3 py-2 font-mono text-[12px]">
            {SAMPLE_BODY}
          </pre>
        </div>
        <div className="grid gap-1.5">
          <p className="font-medium">Ví dụ xác thực (Node.js, Express)</p>
          <pre className="max-h-80 scrollbar-thin overflow-auto rounded-md border bg-subtle px-3 py-2 font-mono text-[12px]">
            {VERIFY_SAMPLE}
          </pre>
        </div>
      </div>
    </details>
  );
}

export function MerchantCallbackCard({ merchant }: { merchant: Merchant }) {
  const update = useUpdateMerchant(merchant.id);
  const rotate = useRotateCallbackSecret(merchant.id);
  const callbacks = useMerchantCallbacks(merchant.id);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [secret, setSecret] = useState<{ value: string; rotated: boolean } | null>(null);
  const missing = !merchant.callbackUrl
    ? "Nhập địa chỉ nhận callback"
    : !merchant.hasCallbackSecret
      ? "Tạo khoá ký"
      : null;

  const toggle = (enabled: boolean) =>
    update.mutate(
      { callbackEnabled: enabled },
      {
        onSuccess: () => toast.success(enabled ? "Đã bật callback về Store" : "Đã tắt callback về Store"),
        onError: (error) => toast.error("Không đổi được", { description: getErrorMessage(error) }),
      },
    );

  const createSecret = () => {
    const rotated = merchant.hasCallbackSecret;
    rotate.mutate(undefined, {
      onSuccess: (result) => {
        setConfirmRotate(false);
        setSecret({ value: result.callbackSecret, rotated });
      },
      onError: (error) => toast.error("Không tạo được khoá ký", { description: getErrorMessage(error) }),
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 basis-80">
          <CardTitle className="flex flex-wrap items-center gap-2">
            Báo kết quả đơn về Store
            <Badge tone={merchant.callbackEnabled ? "success" : "neutral"}>
              {merchant.callbackEnabled ? "Đang bật" : "Tắt"}
            </Badge>
          </CardTitle>
          <CardDescription>
            Đơn chốt xong, Hub tự POST kết quả về Store (có ký), không cần Store hỏi lại. Store vẫn tra cứu đơn được như
            bình thường.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2.5">
          <Switch
            id={`callback-enabled-${merchant.id}`}
            checked={merchant.callbackEnabled}
            disabled={update.isPending || (!merchant.callbackEnabled && missing !== null)}
            onCheckedChange={toggle}
            aria-describedby={missing ? `callback-missing-${merchant.id}` : undefined}
          />
          <label htmlFor={`callback-enabled-${merchant.id}`} className="text-sm font-medium">
            Gửi callback
          </label>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6">
        {missing && !merchant.callbackEnabled ? (
          <p
            id={`callback-missing-${merchant.id}`}
            className="rounded-md bg-subtle px-3 py-2 text-[13px] text-muted-foreground"
          >
            Để bật: {missing.toLowerCase()} rồi gửi thử cho chắc.
          </p>
        ) : null}
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="grid content-start gap-5">
            <UrlForm key={merchant.callbackUrl ?? ""} merchant={merchant} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-medium">Khoá ký</p>
                <p className="text-[13px] text-muted-foreground">
                  {merchant.hasCallbackSecret && merchant.callbackSecretLast4 ? (
                    <>
                      Đang dùng <MaskedKey last4={merchant.callbackSecretLast4} />
                    </>
                  ) : (
                    "Chưa có. Tạo xong gửi cho Store để họ kiểm tra chữ ký."
                  )}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                isLoading={rotate.isPending && !confirmRotate}
                onClick={() => (merchant.hasCallbackSecret ? setConfirmRotate(true) : createSecret())}
              >
                {rotate.isPending && !confirmRotate ? null : <KeyRound aria-hidden />}
                {merchant.hasCallbackSecret ? "Đổi khoá ký" : "Tạo khoá ký"}
              </Button>
            </div>
            <TestPanel merchant={merchant} />
          </div>
          <div className="grid content-start gap-3">
            <p className="text-sm font-medium">Callback gần đây</p>
            <StoreCallbackList
              callbacks={callbacks.data}
              isPending={callbacks.isPending}
              error={callbacks.isError ? callbacks.error : null}
              onRetry={() => void callbacks.refetch()}
              showTransCode
              emptyText="Chưa có callback nào. Đơn của Store chốt xong sẽ hiện ở đây."
            />
          </div>
        </div>
        <StoreGuide />
      </CardContent>

      <ConfirmDialog
        open={confirmRotate}
        onOpenChange={setConfirmRotate}
        title="Đổi khoá ký callback?"
        description="Khoá hiện tại ngừng dùng ngay. Callback sau đó ký bằng khoá mới, Store phải cập nhật khoá mới thì mới xác thực được."
        confirmLabel="Đổi khoá ký"
        tone="danger"
        isPending={rotate.isPending}
        onConfirm={createSecret}
      />
      <CallbackSecretDialog
        secret={secret?.value ?? null}
        rotated={secret?.rotated ?? false}
        onClose={() => setSecret(null)}
      />
    </Card>
  );
}
