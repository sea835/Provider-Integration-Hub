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
import { useCreateProvider } from "./hooks";
import { ProviderForm, toProviderInput } from "./provider-form";

export function CreateProviderDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const createProvider = useCreateProvider();

  return (
    <Dialog open={open} onOpenChange={(next) => (createProvider.isPending ? undefined : onOpenChange(next))}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Thêm nhà cung cấp</DialogTitle>
          <DialogDescription>
            Khai báo thông tin kết nối. Bạn có thể kiểm tra kết nối ngay sau khi tạo.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <ProviderForm
            id="create-provider"
            className="flex min-h-0 flex-1 flex-col"
            bodyClassName="scrollbar-thin flex-1 overflow-y-auto px-6 py-5"
            onSubmit={(values) =>
              createProvider.mutateAsync(toProviderInput(values)).then((provider) => {
                onOpenChange(false);
                toast.success("Đã thêm nhà cung cấp", {
                  description: provider.name,
                  action: { label: "Xem chi tiết", onClick: () => router.push(`/providers/${provider.id}`) },
                });
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
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
