"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getErrorMessage } from "@/lib/api/errors";
import { useCreateMerchant } from "./hooks";
import { MerchantForm, toIpList } from "./merchant-form";
import type { MerchantWithKey } from "./types";

export function CreateMerchantDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (merchant: MerchantWithKey) => void;
}) {
  const createMerchant = useCreateMerchant();
  return (
    <Dialog open={open} onOpenChange={(next) => (createMerchant.isPending ? undefined : onOpenChange(next))}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Thêm Store</DialogTitle>
          <DialogDescription>
            Store là hệ thống bán hàng gọi Hub để mua gói. Tạo xong sẽ nhận API key.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <MerchantForm
            id="create-merchant"
            mode="create"
            bodyClassName="px-6 py-5"
            onSubmit={(values) =>
              createMerchant
                .mutateAsync({ code: values.code, name: values.name, ipWhitelist: toIpList(values) })
                .then((merchant) => {
                  onOpenChange(false);
                  onCreated(merchant);
                })
            }
            footer={({ isSubmitting }) => (
              <>
                {createMerchant.isError ? (
                  <p role="alert" className="px-6 pb-3 text-[13px] text-danger">
                    {getErrorMessage(createMerchant.error)}
                  </p>
                ) : null}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                    Hủy
                  </Button>
                  <Button type="submit" isLoading={isSubmitting}>
                    Tạo Store
                  </Button>
                </DialogFooter>
              </>
            )}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
