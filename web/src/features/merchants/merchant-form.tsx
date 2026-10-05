"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Field, fieldControlProps } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { invalidIps, parseIpList } from "./constants";
import type { Merchant } from "./types";

const schema = z
  .object({
    code: z.string().trim(),
    name: z.string().trim().min(1, "Nhập tên Store").max(255, "Tối đa 255 ký tự"),
    ips: z.string(),
  })
  .superRefine((values, ctx) => {
    const wrong = invalidIps(parseIpList(values.ips));
    if (wrong.length > 0) {
      ctx.addIssue({ code: "custom", path: ["ips"], message: `IP không hợp lệ: ${wrong.join(", ")}` });
    }
  });

export type MerchantFormValues = z.infer<typeof schema>;

const createSchema = schema.superRefine((values, ctx) => {
  if (!/^[A-Za-z0-9_]{2,50}$/.test(values.code)) {
    ctx.addIssue({ code: "custom", path: ["code"], message: "Mã gồm chữ, số, gạch dưới (2-50 ký tự)" });
  }
});

export function toIpList(values: MerchantFormValues): string[] {
  return parseIpList(values.ips);
}

export function MerchantForm({
  id,
  mode,
  merchant,
  onSubmit,
  footer,
  bodyClassName,
}: {
  id: string;
  mode: "create" | "edit";
  merchant?: Merchant;
  onSubmit: (values: MerchantFormValues) => Promise<unknown>;
  footer: (state: { isSubmitting: boolean; isDirty: boolean; reset: () => void }) => ReactNode;
  bodyClassName?: string;
}) {
  const defaults: MerchantFormValues = {
    code: merchant?.code ?? "",
    name: merchant?.name ?? "",
    ips: (merchant?.ipWhitelist ?? []).join("\n"),
  };
  const form = useForm<MerchantFormValues>({
    resolver: zodResolver(mode === "create" ? createSchema : schema),
    defaultValues: defaults,
  });
  const { errors, isSubmitting, isDirty } = form.formState;

  return (
    <form
      id={id}
      noValidate
      onSubmit={form.handleSubmit((values) =>
        onSubmit(values)
          .then(() => form.reset(values))
          .catch(() => undefined),
      )}
    >
      <div className={bodyClassName}>
        <div className="grid gap-5">
          {mode === "create" ? (
            <Field
              id={`${id}-code`}
              label="Mã Store"
              required
              error={errors.code?.message}
              hint="Viết liền, vd MSTORE. Không đổi được sau khi tạo."
            >
              <Input
                {...fieldControlProps(`${id}-code`, errors.code?.message, true)}
                {...form.register("code", {
                  setValueAs: (value: string) => value.trim().toUpperCase(),
                })}
                autoComplete="off"
                spellCheck={false}
                className="font-mono uppercase"
                placeholder="MSTORE"
              />
            </Field>
          ) : null}
          <Field id={`${id}-name`} label="Tên hiển thị" required error={errors.name?.message}>
            <Input
              {...fieldControlProps(`${id}-name`, errors.name?.message)}
              {...form.register("name")}
              autoComplete="off"
              placeholder="M-Store"
            />
          </Field>
          <Field
            id={`${id}-ips`}
            label="IP được phép gọi"
            error={errors.ips?.message}
            hint="Mỗi dòng một IP. Để trống = mọi IP đều gọi được (chỉ nên dùng khi thử)."
          >
            <Textarea
              {...fieldControlProps(`${id}-ips`, errors.ips?.message, true)}
              {...form.register("ips")}
              rows={3}
              spellCheck={false}
              className="font-mono text-[13px]"
              placeholder={"203.0.113.10\n203.0.113.11"}
            />
          </Field>
        </div>
      </div>
      {footer({ isSubmitting, isDirty, reset: () => form.reset(defaults) })}
    </form>
  );
}
