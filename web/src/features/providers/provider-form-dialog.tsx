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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatMoney } from "@/lib/format";
import { INTERVAL_OPTIONS, intervalLabel } from "./constants";
import { useCreateProvider, useUpdateProvider } from "./hooks";
import type { Provider } from "./types";

const amount = z
  .string()
  .trim()
  .regex(/^\d{0,15}$/, "Chỉ nhập chữ số, không dấu chấm phẩy");

const schema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^[A-Z][A-Z0-9_]{1,49}$/, "2-50 ký tự A-Z, 0-9, gạch dưới, bắt đầu bằng chữ cái"),
    name: z.string().trim().min(1, "Vui lòng nhập tên đối tác").max(255, "Tên quá dài"),
    intervalMinutes: z.number(),
    warningThreshold: amount,
    criticalThreshold: amount,
    cooldownMinutes: z
      .string()
      .trim()
      .regex(/^\d+$/, "Nhập số phút")
      .refine((value) => Number(value) >= 5 && Number(value) <= 1440, "Từ 5 đến 1440 phút"),
  })
  .refine(
    (values) =>
      values.warningThreshold === "" ||
      values.criticalThreshold === "" ||
      Number(values.criticalThreshold) <= Number(values.warningThreshold),
    { path: ["criticalThreshold"], message: "Phải nhỏ hơn hoặc bằng ngưỡng cảnh báo sớm" },
  );

type Values = z.infer<typeof schema>;

const toAmount = (value: string) => (value === "" ? null : Number(value));
const fromAmount = (value: number | null) => (value === null ? "" : String(Math.round(value)));
const preview = (value: string) => (value === "" ? "Để trống nếu không dùng mức này." : formatMoney(Number(value)));

export function ProviderFormDialog({
  provider,
  onClose,
  onCreated,
}: {
  provider?: Provider;
  onClose: () => void;
  onCreated?: (provider: Provider) => void;
}) {
  const createProvider = useCreateProvider();
  const updateProvider = useUpdateProvider();
  const pending = createProvider.isPending || updateProvider.isPending;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: provider?.code ?? "",
      name: provider?.name ?? "",
      intervalMinutes: provider?.intervalMinutes ?? 5,
      warningThreshold: fromAmount(provider?.warningThreshold ?? null),
      criticalThreshold: fromAmount(provider?.criticalThreshold ?? null),
      cooldownMinutes: String(provider?.cooldownMinutes ?? 60),
    },
  });
  const { errors } = form.formState;
  const [warning, critical] = useWatch({ control: form.control, name: ["warningThreshold", "criticalThreshold"] });

  const onSubmit = form.handleSubmit((values) => {
    const settings = {
      name: values.name,
      intervalMinutes: values.intervalMinutes,
      warningThreshold: toAmount(values.warningThreshold),
      criticalThreshold: toAmount(values.criticalThreshold),
      cooldownMinutes: Number(values.cooldownMinutes),
    };
    if (provider) {
      return updateProvider.mutateAsync({ id: provider.id, input: settings }).then(
        (updated) => {
          toast.success("Đã lưu thay đổi", { description: updated.name });
          onClose();
        },
        () => undefined,
      );
    }
    return createProvider.mutateAsync({ code: values.code, ...settings }).then(
      (created) => {
        toast.success("Đã thêm đối tác", { description: "Tiếp theo: cấu hình API rồi bật quét." });
        onClose();
        onCreated?.(created);
      },
      () => undefined,
    );
  });

  return (
    <Dialog open onOpenChange={(open) => (!open && !pending ? onClose() : undefined)}>
      <DialogContent className="max-w-xl">
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>{provider ? "Sửa ngưỡng và chu kỳ" : "Thêm đối tác"}</DialogTitle>
            <DialogDescription>
              {provider
                ? "Thay đổi có hiệu lực từ lượt quét kế tiếp."
                : "Đối tác mới ở trạng thái tạm dừng cho tới khi bạn cấu hình API và bật quét."}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                className="content-start"
                id="provider-code"
                label="Mã đối tác"
                required={!provider}
                error={errors.code?.message}
                hint={provider ? "Không đổi được sau khi tạo." : "Ví dụ VIETTEL_DATA."}
              >
                <Input
                  {...fieldControlProps("provider-code", errors.code?.message, "hint")}
                  {...form.register("code", {
                    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                      event.target.value = event.target.value.toUpperCase();
                    },
                  })}
                  readOnly={Boolean(provider)}
                  autoComplete="off"
                  spellCheck={false}
                  className="font-mono"
                  placeholder="VIETTEL_DATA"
                />
              </Field>
              <Field
                className="content-start"
                id="provider-name"
                label="Tên đối tác"
                required
                error={errors.name?.message}
              >
                <Input
                  {...fieldControlProps("provider-name", errors.name?.message)}
                  {...form.register("name")}
                  autoComplete="off"
                  placeholder="Viettel Telecom - Data 4G"
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                className="content-start"
                id="provider-warning"
                label="Ngưỡng cảnh báo sớm (VNĐ)"
                error={errors.warningThreshold?.message}
                hint={preview(warning)}
              >
                <Input
                  {...fieldControlProps("provider-warning", errors.warningThreshold?.message, "hint")}
                  {...form.register("warningThreshold")}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="50000000"
                />
              </Field>
              <Field
                className="content-start"
                id="provider-critical"
                label="Ngưỡng khẩn cấp (VNĐ)"
                error={errors.criticalThreshold?.message}
                hint={preview(critical)}
              >
                <Input
                  {...fieldControlProps("provider-critical", errors.criticalThreshold?.message, "hint")}
                  {...form.register("criticalThreshold")}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="10000000"
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field className="content-start" id="provider-interval" label="Chu kỳ quét">
                <Controller
                  control={form.control}
                  name="intervalMinutes"
                  render={({ field }) => (
                    <Select value={String(field.value)} onValueChange={(value) => field.onChange(Number(value))}>
                      <SelectTrigger id="provider-interval">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INTERVAL_OPTIONS.map((minutes) => (
                          <SelectItem key={minutes} value={String(minutes)}>
                            Mỗi {intervalLabel(minutes)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <Field
                className="content-start"
                id="provider-cooldown"
                label="Nhắc lại sau (phút)"
                error={errors.cooldownMinutes?.message}
                hint="Khoảng cách giữa hai lần nhắc cùng một mức."
              >
                <Input
                  {...fieldControlProps("provider-cooldown", errors.cooldownMinutes?.message, "hint")}
                  {...form.register("cooldownMinutes")}
                  inputMode="numeric"
                  autoComplete="off"
                />
              </Field>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Hủy
            </Button>
            <Button type="submit" isLoading={pending}>
              {provider ? "Lưu thay đổi" : "Thêm đối tác"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
