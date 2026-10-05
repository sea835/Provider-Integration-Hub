"use client";

import { ArrowLeft, KeyRound, Lock, LockOpen, Store } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { getErrorMessage, isApiError } from "@/lib/api/errors";
import { formatDateTime, formatRelative } from "@/lib/format";
import { CopyButton } from "@/features/suppliers/copy-button";
import { HUB_PUBLIC_URL } from "@/features/suppliers/constants";
import { OrdersPanel } from "@/features/suppliers/supplier-orders";
import { ApiKeyDialog } from "./api-key-dialog";
import { MERCHANT_STATUS_META } from "./constants";
import { MerchantCallbackCard } from "./merchant-callback-card";
import { useMerchant, useRotateMerchantKey, useUpdateMerchant } from "./hooks";
import { MerchantForm, toIpList } from "./merchant-form";
import { MaskedKey, MerchantStatusBadge } from "./merchant-visuals";
import type { Merchant, MerchantWithKey } from "./types";

const STORE_APIS: Array<{ method: string; path: string; label: string }> = [
  { method: "GET", path: "/v1/suppliers/{mã NCC}/packages", label: "1. Lấy danh sách gói" },
  { method: "POST", path: "/v1/packages/check", label: "2. Kiểm tra gói có đăng ký được không" },
  { method: "POST", path: "/v1/orders", label: "3. Đăng ký gói (tạo đơn)" },
  { method: "GET", path: "/v1/orders/{transCode}", label: "4. Kiểm tra trạng thái theo mã Hub" },
  { method: "GET", path: "/v1/orders?requestId=…", label: "4. Kiểm tra trạng thái theo mã của Store" },
];

function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-6 xl:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}

function AccessCard({ merchant, onRotate }: { merchant: Merchant; onRotate: () => void }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Cách Store gọi Hub</CardTitle>
          <CardDescription>
            Gửi API key trong header ở mọi lời gọi. Chi tiết từng API có ở trang tài liệu.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <dl className="grid gap-3 text-[13px]">
          <div className="grid gap-1">
            <dt className="text-xs text-muted-foreground">Địa chỉ Hub</dt>
            <dd className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 font-mono text-[12.5px] break-all">{HUB_PUBLIC_URL}</code>
              <CopyButton value={HUB_PUBLIC_URL} />
            </dd>
          </div>
          <div className="grid gap-1">
            <dt className="text-xs text-muted-foreground">Header xác thực</dt>
            <dd className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <code className="font-mono text-[12.5px]">x-api-key: </code>
                <MaskedKey last4={merchant.apiKeyLast4} />
              </span>
              <Button variant="outline" size="sm" onClick={onRotate}>
                <KeyRound aria-hidden />
                Cấp key mới
              </Button>
            </dd>
          </div>
        </dl>
        <ul className="grid gap-1.5 rounded-lg border p-3">
          {STORE_APIS.map((item) => (
            <li key={`${item.method} ${item.path}`} className="grid gap-0.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-3">
              <code className="min-w-0 font-mono text-[12.5px] break-all">
                <span className="font-semibold text-primary">{item.method}</span> {item.path}
              </code>
              <span className="text-[12.5px] text-muted-foreground sm:text-right">{item.label}</span>
            </li>
          ))}
        </ul>
        <a
          href={`${HUB_PUBLIC_URL}/docs`}
          target="_blank"
          rel="noreferrer"
          className="justify-self-start text-[13px] text-primary underline-offset-2 hover:underline"
        >
          Mở tài liệu API (Swagger)
        </a>
      </CardContent>
    </Card>
  );
}

export function MerchantDetailView({ id }: { id: string }) {
  const query = useMerchant(id);
  const update = useUpdateMerchant(id);
  const rotate = useRotateMerchantKey(id);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [confirmLock, setConfirmLock] = useState(false);
  const [newKey, setNewKey] = useState<MerchantWithKey | null>(null);
  const merchant = query.data;

  if (query.isPending) return <DetailSkeleton />;
  if (query.isError || !merchant) {
    const notFound = isApiError(query.error) && query.error.status === 404;
    return (
      <Card>
        {notFound ? (
          <EmptyState
            icon={Store}
            title="Không tìm thấy Store"
            description="Đường dẫn có thể không chính xác."
            action={
              <Button asChild variant="outline">
                <Link href="/merchants">
                  <ArrowLeft aria-hidden />
                  Về danh sách
                </Link>
              </Button>
            }
          />
        ) : (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        )}
      </Card>
    );
  }

  const active = merchant.status === "ACTIVE";
  const setStatus = (status: Merchant["status"]) =>
    update.mutate(
      { status },
      {
        onSuccess: () => {
          setConfirmLock(false);
          toast.success(status === "ACTIVE" ? "Đã mở lại Store" : "Đã tạm khoá Store");
        },
        onError: (error) => toast.error("Không đổi được trạng thái", { description: getErrorMessage(error) }),
      },
    );

  return (
    <div className="space-y-6">
      <Link
        href="/merchants"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Tất cả Store
      </Link>

      <header className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{merchant.name}</h1>
            <MerchantStatusBadge status={merchant.status} />
          </div>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span className="font-mono">{merchant.code}</span>
            <span aria-hidden>·</span>
            <span title={formatDateTime(merchant.createdAt)}>Tạo {formatRelative(merchant.createdAt)}</span>
          </p>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {MERCHANT_STATUS_META[merchant.status].description}.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setConfirmRotate(true)}>
            <KeyRound aria-hidden />
            Cấp key mới
          </Button>
          {active ? (
            <Button variant="outline" onClick={() => setConfirmLock(true)}>
              <Lock aria-hidden />
              Tạm khoá
            </Button>
          ) : (
            <Button onClick={() => setStatus("ACTIVE")} isLoading={update.isPending}>
              {update.isPending ? null : <LockOpen aria-hidden />}
              Mở lại
            </Button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Thông tin</CardTitle>
              <CardDescription>Đổi tên và danh sách IP được phép gọi Hub. Có hiệu lực ngay.</CardDescription>
            </div>
          </CardHeader>
          <MerchantForm
            key={merchant.updatedAt}
            id="edit-merchant"
            mode="edit"
            merchant={merchant}
            bodyClassName="px-5 pt-5 pb-1"
            onSubmit={(values) =>
              update
                .mutateAsync({ name: values.name, ipWhitelist: toIpList(values) })
                .then(() => toast.success("Đã lưu thông tin Store"))
                .catch((error: unknown) => {
                  toast.error("Không lưu được", { description: getErrorMessage(error) });
                  throw error;
                })
            }
            footer={({ isSubmitting, isDirty, reset }) => (
              <div className="flex justify-end gap-2 px-5 py-4">
                <Button type="button" variant="ghost" size="sm" onClick={reset} disabled={!isDirty || isSubmitting}>
                  Hoàn tác
                </Button>
                <Button type="submit" size="sm" disabled={!isDirty} isLoading={isSubmitting}>
                  Lưu
                </Button>
              </div>
            )}
          />
        </Card>
        <AccessCard merchant={merchant} onRotate={() => setConfirmRotate(true)} />
      </div>

      <MerchantCallbackCard merchant={merchant} />

      <Card className="overflow-hidden">
        <OrdersPanel
          filter={{ merchantId: merchant.id }}
          title="Đơn của Store này"
          emptyDescription="Đơn Store gửi bằng API key này sẽ hiện ở đây."
          showSupplier
        />
      </Card>

      <ConfirmDialog
        open={confirmRotate}
        onOpenChange={setConfirmRotate}
        title="Cấp API key mới?"
        description="Key hiện tại ngừng hoạt động ngay. Store sẽ bị từ chối cho tới khi cập nhật key mới vào hệ thống của họ."
        confirmLabel="Cấp key mới"
        tone="danger"
        isPending={rotate.isPending}
        onConfirm={() =>
          rotate.mutate(undefined, {
            onSuccess: (result) => {
              setConfirmRotate(false);
              setNewKey(result);
            },
            onError: (error) => toast.error("Không cấp được key mới", { description: getErrorMessage(error) }),
          })
        }
      />
      <ConfirmDialog
        open={confirmLock}
        onOpenChange={setConfirmLock}
        title="Tạm khoá Store?"
        description="Hub từ chối mọi lời gọi của Store này (tạo đơn, tra cứu, lấy gói). Đơn đã nhận vẫn được xử lý tiếp."
        confirmLabel="Tạm khoá"
        tone="danger"
        isPending={update.isPending}
        onConfirm={() => setStatus("INACTIVE")}
      />
      <ApiKeyDialog merchant={newKey} reason="rotated" onClose={() => setNewKey(null)} />
    </div>
  );
}
