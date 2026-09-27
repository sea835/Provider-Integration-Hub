"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Permission } from "@/lib/api/types";
import { actionLabel, STANDARD_ACTIONS, SUBJECT_LABELS } from "@/lib/auth/policies";
import { useCreatePermission } from "./hooks";

const CUSTOM_ACTION = "__custom__";

const schema = z
  .object({
    action: z.string().min(1, "Chọn hành động"),
    customAction: z.string().trim(),
    subject: z
      .string()
      .trim()
      .min(1, "Vui lòng nhập đối tượng")
      .max(100, "Đối tượng tối đa 100 ký tự")
      .regex(/^[A-Za-z][A-Za-z0-9_]*$/, "Chỉ dùng chữ, số và dấu gạch dưới, bắt đầu bằng chữ cái"),
    description: z.string().trim().max(255, "Mô tả tối đa 255 ký tự"),
    conditions: z.string().trim(),
  })
  .superRefine((values, context) => {
    if (values.action === CUSTOM_ACTION && !/^[a-z][a-zA-Z0-9_]{1,49}$/.test(values.customAction)) {
      context.addIssue({
        code: "custom",
        path: ["customAction"],
        message: "Hành động viết thường, 2–50 ký tự, không dấu cách",
      });
    }
    if (values.conditions) {
      try {
        const parsed: unknown = JSON.parse(values.conditions);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("not-object");
      } catch {
        context.addIssue({
          code: "custom",
          path: ["conditions"],
          message: "Điều kiện phải là một đối tượng JSON hợp lệ",
        });
      }
    }
  });

type Values = z.infer<typeof schema>;

interface PermissionDialogProps {
  onClose: () => void;
  onCreated?: (permission: Permission) => void;
  preset?: { action?: string; subject?: string };
  knownSubjects: string[];
}

export function PermissionDialog({ onClose, onCreated, preset, knownSubjects }: PermissionDialogProps) {
  const createPermission = useCreatePermission();
  const presetAction = preset?.action;
  const isStandard = presetAction ? (STANDARD_ACTIONS as string[]).includes(presetAction) : true;

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      action: presetAction ? (isStandard ? presetAction : CUSTOM_ACTION) : "read",
      customAction: presetAction && !isStandard ? presetAction : "",
      subject: preset?.subject ?? "",
      description: "",
      conditions: "",
    },
  });
  const { errors } = form.formState;
  const action = useWatch({ control: form.control, name: "action" });
  const subjects = Array.from(new Set([...Object.keys(SUBJECT_LABELS), ...knownSubjects]));

  const onSubmit = form.handleSubmit((values) => {
    const finalAction = values.action === CUSTOM_ACTION ? values.customAction : values.action;
    return createPermission
      .mutateAsync({
        action: finalAction,
        subject: values.subject,
        description: values.description || undefined,
        conditions: values.conditions ? (JSON.parse(values.conditions) as Record<string, unknown>) : undefined,
      })
      .then(
        (permission) => {
          toast.success("Đã tạo quyền hạn", { description: `${permission.action} · ${permission.subject}` });
          onCreated?.(permission);
          onClose();
        },
        () => undefined,
      );
  });

  return (
    <Dialog open onOpenChange={(open) => (!open && !createPermission.isPending ? onClose() : undefined)}>
      <DialogContent className="max-w-xl">
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>Tạo quyền hạn</DialogTitle>
            <DialogDescription>
              Quyền hạn là một cặp hành động × đối tượng, có thể kèm điều kiện ABAC. Mỗi cặp là duy nhất.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="permission-action" label="Hành động" required error={errors.action?.message}>
                <Controller
                  control={form.control}
                  name="action"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="permission-action">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STANDARD_ACTIONS.map((item) => (
                          <SelectItem key={item} value={item}>
                            {actionLabel(item)}{" "}
                            <span className="font-mono text-xs text-muted-foreground">({item})</span>
                          </SelectItem>
                        ))}
                        <SelectItem value={CUSTOM_ACTION}>Hành động khác…</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field
                id="permission-subject"
                label="Đối tượng"
                required
                error={errors.subject?.message}
                hint="Tên tài nguyên, ví dụ User, Provider hoặc all"
              >
                <Input
                  {...fieldControlProps("permission-subject", errors.subject?.message, "hint")}
                  {...form.register("subject")}
                  list="permission-subject-options"
                  autoComplete="off"
                  spellCheck={false}
                  className="font-mono"
                  placeholder="Provider"
                />
                <datalist id="permission-subject-options">
                  {subjects.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </Field>
            </div>
            {action === CUSTOM_ACTION ? (
              <Field id="permission-custom-action" label="Tên hành động" required error={errors.customAction?.message}>
                <Input
                  {...fieldControlProps("permission-custom-action", errors.customAction?.message)}
                  {...form.register("customAction")}
                  autoComplete="off"
                  spellCheck={false}
                  className="font-mono"
                  placeholder="export"
                />
              </Field>
            ) : null}
            <Field id="permission-description" label="Mô tả" error={errors.description?.message}>
              <Input
                {...fieldControlProps("permission-description", errors.description?.message)}
                {...form.register("description")}
                autoComplete="off"
                placeholder="Cho phép xem danh sách nhà cung cấp"
              />
            </Field>
            <Field
              id="permission-conditions"
              label="Điều kiện (JSON, tùy chọn)"
              error={errors.conditions?.message}
              hint={
                <>
                  Dùng <code className="rounded bg-muted px-1 font-mono text-[12px]">{"${user.sub}"}</code> để tham
                  chiếu ID người dùng hiện tại.
                </>
              }
            >
              <Textarea
                {...fieldControlProps("permission-conditions", errors.conditions?.message, "hint")}
                {...form.register("conditions")}
                rows={3}
                spellCheck={false}
                className="font-mono text-[13px]"
                placeholder={'{ "id": "${user.sub}" }'}
              />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={createPermission.isPending}>
              Hủy
            </Button>
            <Button type="submit" isLoading={createPermission.isPending}>
              Tạo quyền hạn
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
