"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MagicWand } from "@phosphor-icons/react/ssr";
import { Controller, useForm } from "react-hook-form";
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
import { Input } from "@/components/ui/input";
import { SYSTEM_ROLES } from "@/lib/api/types";
import { useCreateUser } from "./hooks";
import { RoleRadioCards } from "./role-radio-cards";

const schema = z.object({
  email: z.string().trim().min(1, "Vui lòng nhập email").pipe(z.email("Email không đúng định dạng")),
  password: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự").max(128, "Mật khẩu quá dài"),
  role: z.enum(SYSTEM_ROLES),
});

type Values = z.infer<typeof schema>;

export function generatePassword(length = 14): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  const bytes = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
}

export function CreateUserDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const createUser = useCreateUser();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", role: "USER" },
  });
  const { errors } = form.formState;

  const close = (next: boolean) => {
    if (createUser.isPending) return;
    if (!next) form.reset();
    onOpenChange(next);
  };

  const onSubmit = form.handleSubmit((values) =>
    createUser.mutateAsync(values).then(
      (user) => {
        toast.success("Đã tạo người dùng", { description: user.email });
        close(false);
      },
      () => undefined,
    ),
  );

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-xl">
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>Thêm người dùng</DialogTitle>
            <DialogDescription>
              Tài khoản được kích hoạt ngay sau khi tạo. Hãy gửi mật khẩu tạm cho người dùng qua kênh an toàn.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-5">
            <Field id="create-email" label="Email" required error={errors.email?.message}>
              <Input
                {...fieldControlProps("create-email", errors.email?.message)}
                {...form.register("email")}
                type="email"
                inputMode="email"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="nguoidung@congty.vn"
              />
            </Field>
            <Field
              id="create-password"
              label="Mật khẩu tạm"
              required
              error={errors.password?.message}
              hint="Tối thiểu 6 ký tự."
            >
              <div className="flex gap-2">
                <div className="flex-1">
                  <PasswordInput
                    {...fieldControlProps("create-password", errors.password?.message, "Tối thiểu 6 ký tự.")}
                    {...form.register("password")}
                    autoComplete="new-password"
                    className="font-mono"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => form.setValue("password", generatePassword(), { shouldValidate: true })}
                >
                  <MagicWand aria-hidden />
                  Tạo ngẫu nhiên
                </Button>
              </div>
            </Field>
            <div className="grid gap-2">
              <span className="text-[13px] font-medium">Vai trò</span>
              <Controller
                control={form.control}
                name="role"
                render={({ field }) => <RoleRadioCards value={field.value} onChange={field.onChange} />}
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)} disabled={createUser.isPending}>
              Hủy
            </Button>
            <Button type="submit" isLoading={createUser.isPending}>
              Tạo người dùng
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
