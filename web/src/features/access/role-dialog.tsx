"use client";

import { zodResolver } from "@hookform/resolvers/zod";
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
import { Field, fieldControlProps } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { Role } from "@/lib/api/types";
import { useCreateRole, useUpdateRole } from "./hooks";

const schema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Mã vai trò tối thiểu 2 ký tự")
    .max(50, "Mã vai trò tối đa 50 ký tự")
    .regex(/^[A-Z0-9_]+$/, "Chỉ dùng chữ in hoa, số và dấu gạch dưới"),
  name: z.string().trim().min(1, "Vui lòng nhập tên hiển thị").max(100, "Tên tối đa 100 ký tự"),
  description: z.string().trim().max(255, "Mô tả tối đa 255 ký tự"),
  active: z.boolean(),
});

type Values = z.infer<typeof schema>;

interface RoleDialogProps {
  role?: Role;
  onClose: () => void;
  onCreated?: (role: Role) => void;
}

export function RoleDialog({ role, onClose, onCreated }: RoleDialogProps) {
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const isEdit = Boolean(role);
  const isPending = createRole.isPending || updateRole.isPending;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: role?.code ?? "",
      name: role?.name ?? "",
      description: role?.description ?? "",
      active: role ? role.status === "ACTIVE" : true,
    },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    const description = values.description || undefined;
    try {
      if (role) {
        await updateRole.mutateAsync({
          id: role.id,
          input: { name: values.name, description, status: values.active ? "ACTIVE" : "INACTIVE" },
        });
        toast.success("Đã cập nhật vai trò", { description: values.name });
      } else {
        const created = await createRole.mutateAsync({ code: values.code, name: values.name, description });
        toast.success("Đã tạo vai trò", { description: `${created.name} (${created.code})` });
        onCreated?.(created);
      }
      onClose();
    } catch {
      return;
    }
  });

  return (
    <Dialog open onOpenChange={(open) => (!open && !isPending ? onClose() : undefined)}>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Chỉnh sửa vai trò" : "Tạo vai trò mới"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Mã vai trò là cố định. Bạn có thể đổi tên hiển thị, mô tả và trạng thái."
                : "Sau khi tạo, hãy gán quyền cho vai trò trong ma trận phân quyền."}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-5">
            <Field
              id="role-code"
              label="Mã vai trò"
              required={!isEdit}
              error={errors.code?.message}
              hint="Ví dụ: SUPPORT, FINANCE_VIEWER"
            >
              <Input
                {...fieldControlProps("role-code", errors.code?.message, "hint")}
                {...form.register("code", {
                  onChange: (event: { target: { value: string } }) =>
                    form.setValue("code", event.target.value.toUpperCase().replace(/\s+/g, "_")),
                })}
                readOnly={isEdit}
                autoComplete="off"
                spellCheck={false}
                className="font-mono uppercase"
                placeholder="SUPPORT"
              />
            </Field>
            <Field id="role-name" label="Tên hiển thị" required error={errors.name?.message}>
              <Input
                {...fieldControlProps("role-name", errors.name?.message)}
                {...form.register("name")}
                autoComplete="off"
                placeholder="Chuyên viên hỗ trợ"
              />
            </Field>
            <Field id="role-description" label="Mô tả" error={errors.description?.message}>
              <Textarea
                {...fieldControlProps("role-description", errors.description?.message)}
                {...form.register("description")}
                rows={3}
                placeholder="Phạm vi trách nhiệm của vai trò"
              />
            </Field>
            {isEdit ? (
              <Controller
                control={form.control}
                name="active"
                render={({ field }) => (
                  <label
                    htmlFor="role-active"
                    className="flex items-center justify-between gap-4 rounded-md bg-subtle p-3"
                  >
                    <span className="space-y-0.5">
                      <span className="block text-sm font-medium">Đang hoạt động</span>
                      <span className="block text-[13px] text-muted-foreground">
                        Tắt để đánh dấu vai trò ngừng sử dụng.
                      </span>
                    </span>
                    <Switch id="role-active" checked={field.value} onCheckedChange={field.onChange} />
                  </label>
                )}
              />
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Hủy
            </Button>
            <Button type="submit" isLoading={isPending}>
              {isEdit ? "Lưu thay đổi" : "Tạo vai trò"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
