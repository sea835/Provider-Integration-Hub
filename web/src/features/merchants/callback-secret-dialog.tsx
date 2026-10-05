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

export function CallbackSecretDialog({
  secret,
  rotated,
  onClose,
}: {
  secret: string | null;
  rotated: boolean;
  onClose: () => void;
}) {
  const [saved, setSaved] = useState(false);
  const close = () => {
    setSaved(false);
    onClose();
  };

  return (
    <Dialog open={secret !== null} onOpenChange={(next) => (!next && saved ? close() : undefined)}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-5 text-primary" aria-hidden />
            Khoá ký callback
          </DialogTitle>
          <DialogDescription>
            Store dùng khoá này để kiểm tra callback đúng là do Hub gửi.
            {rotated ? " Khoá cũ đã ngừng hoạt động." : null}
          </DialogDescription>
        </DialogHeader>
        {secret ? (
          <DialogBody className="grid gap-4">
            <div className="flex items-start gap-3 rounded-lg bg-warning-soft p-3.5 text-[13px] text-warning">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>
                Đây là lần duy nhất khoá hiện ra. Gửi khoá cho Store qua kênh an toàn; mất khoá thì phải tạo khoá mới.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="callback-secret">Khoá ký</Label>
              <div className="flex flex-wrap items-center gap-2">
                <code
                  id="callback-secret"
                  className="min-w-0 flex-1 rounded-md border bg-subtle px-3 py-2 font-mono text-[13px] break-all select-all"
                >
                  {secret}
                </code>
                <CopyButton value={secret} label="Chép khoá" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="callback-secret-saved"
                checked={saved}
                onCheckedChange={(next) => setSaved(next === true)}
              />
              <Label htmlFor="callback-secret-saved" className="text-[13px] font-normal">
                Tôi đã lưu khoá ở nơi an toàn
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
