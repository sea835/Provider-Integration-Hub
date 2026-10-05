"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { useAdapterTypes, useCreateSupplier } from "./hooks";
import { SupplierForm, toCreateInput } from "./supplier-form";

export function CreateSupplierDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const adapters = useAdapterTypes();
  const createSupplier = useCreateSupplier();

  return (
    <Dialog open={open} onOpenChange={(next) => (createSupplier.isPending ? undefined : onOpenChange(next))}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Thêm nhà cung cấp</DialogTitle>
          <DialogDescription>
            Nhà cung cấp mới ở trạng thái Tạm dừng. Sau khi tạo, hãy thử kết nối rồi mới bật.
          </DialogDescription>
        </DialogHeader>
        {!open ? null : adapters.isPending ? (
          <div className="space-y-3 px-6 py-5" aria-hidden>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : adapters.isError ? (
          <ErrorState error={adapters.error} onRetry={() => void adapters.refetch()} />
        ) : (
          <SupplierForm
            id="create-supplier"
            mode="create"
            adapters={adapters.data}
            className="flex min-h-0 flex-1 flex-col"
            bodyClassName="scrollbar-thin flex-1 overflow-y-auto px-6 py-5"
            onSubmit={(values, adapter) =>
              createSupplier.mutateAsync(toCreateInput(values, adapter)).then((supplier) => {
                onOpenChange(false);
                if (adapter.editor === "HTTP_CONFIG") {
                  toast.success("Đã thêm nhà cung cấp", {
                    description: `${supplier.name} · tiếp theo: khai báo cách gọi API ở tab Tích hợp`,
                  });
                  router.push(`/suppliers/${supplier.id}?tab=integration`);
                  return;
                }
                toast.success("Đã thêm nhà cung cấp", { description: `${supplier.name} · hãy thử kết nối rồi bật` });
                router.push(`/suppliers/${supplier.id}`);
              })
            }
            footer={({ isSubmitting }) => (
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                  Hủy
                </Button>
                <Button type="submit" isLoading={isSubmitting}>
                  Thêm nhà cung cấp
                </Button>
              </DialogFooter>
            )}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
