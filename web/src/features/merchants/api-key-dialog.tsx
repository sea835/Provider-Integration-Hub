"use client";

import { KeyRound, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { CopyButton } from "@/features/suppliers/copy-button";
import { HUB_PUBLIC_URL } from "@/features/suppliers/constants";
import type { MerchantWithKey } from "./types";

export function ApiKeyDialog({
  merchant,
  reason,
  onClose,
}: {
  merchant: MerchantWithKey | null;
  reason: "created" | "rotated";
  onClose: () => void;
}) {
  const [saved, setSaved] = useState(false);
  const close = () => {
    setSaved(false);
    onClose();
  };
  const sample = merchant
    ? `curl ${HUB_PUBLIC_URL}/v1/orders?requestId=TEST-001 \\\n  -H "x-api-key: ${merchant.apiKey}"`
    : "";

  return (
    <Dialog open={merchant !== null} onOpenChange={(next) => (!next && saved ? close() : undefined)}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-5 text-primary" aria-hidden />
            {reason === "created" ? "API key của Store mới" : "API key mới"}
          </DialogTitle>
          <DialogDescription>
            {merchant ? `${merchant.name} (${merchant.code})` : null}
            {reason === "rotated" ? " · key cũ đã ngừng hoạt động." : null}
          </DialogDescription>
        </DialogHeader>
        {merchant ? (
          <DialogBody className="grid gap-4">
            <div className="flex items-start gap-3 rounded-lg bg-warning-soft p-3.5 text-[13px] text-warning">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>
                Đây là lần duy nhất key hiện ra. Hub chỉ lưu bản băm nên không xem lại được. Mất key thì phải cấp key
                mới.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-api-key">API key</Label>
              <div className="flex flex-wrap items-center gap-2">
                <code
                  id="new-api-key"
                  className="min-w-0 flex-1 rounded-md border bg-subtle px-3 py-2 font-mono text-[13px] break-all select-all"
                >
                  {merchant.apiKey}
                </code>
                <CopyButton value={merchant.apiKey} label="Chép key" />
              </div>
            </div>
            <div className="grid gap-2">
              <p className="text-[13px] text-muted-foreground">
                Store gửi key trong header <code className="font-mono">x-api-key</code> ở mọi lời gọi. Thử nhanh:
              </p>
              <pre className="scrollbar-thin overflow-x-auto rounded-md border bg-subtle px-3 py-2 font-mono text-[12px]">
                {sample}
              </pre>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="api-key-saved" checked={saved} onCheckedChange={(next) => setSaved(next === true)} />
              <Label htmlFor="api-key-saved" className="text-[13px] font-normal">
                Tôi đã lưu key ở nơi an toàn
              </Label>
            </div>
          </DialogBody>
        ) : null}
        <DialogFooter>
          <Button onClick={close} disabled={!saved}>
            Xong
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
