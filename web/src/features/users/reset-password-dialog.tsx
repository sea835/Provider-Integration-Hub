"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Wand2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, fieldControlProps, PasswordInput } from "@/components/ui/field";
import type { User } from "@/lib/api/types";
import { generatePassword } from "./create-user-dialog";
import { useUpdateUser } from "./hooks";

const schema = z.object({
  password: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự").max(128, "Mật khẩu quá dài"),
});

type Values = z.infer<typeof schema>;

export function ResetPasswordDialog({ user, onClose }: { user: User; onClose: () => void }) {
  const updateUser = useUpdateUser();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { password: "" } });
  const error = form.formState.errors.password?.message;

  const onSubmit = form.handleSubmit(({ password }) =>
    updateUser.mutateAsync({ id: user.id, input: { password } }).then(
      () => {
        toast.success("Đã đặt lại mật khẩu", { description: user.email });
        onClose();
      },
      () => undefined,
    ),
  );

  return (
    <Dialog open onOpenChange={(open) => (!open && !updateUser.isPending ? onClose() : undefined)}>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>Đặt lại mật khẩu</DialogTitle>
            <DialogDescription>
              Đặt mật khẩu mới cho <span className="font-medium text-foreground">{user.email}</span>. Các phiên đăng
              nhập hiện có vẫn còn hiệu lực cho tới khi hết hạn.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Field id="reset-password" label="Mật khẩu mới" required error={error}>
              <div className="flex gap-2">
                <div className="flex-1">
                  <PasswordInput
                    {...fieldControlProps("reset-password", error)}
                    {...form.register("password")}
                    autoComplete="new-password"
                    className="font-mono"
                    autoFocus
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Tạo mật khẩu ngẫu nhiên"
                  onClick={() => form.setValue("password", generatePassword(), { shouldValidate: true })}
                >
                  <Wand2 aria-hidden />
                </Button>
              </div>
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={updateUser.isPending}>
              Hủy
            </Button>
            <Button type="submit" isLoading={updateUser.isPending}>
              Lưu mật khẩu
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
