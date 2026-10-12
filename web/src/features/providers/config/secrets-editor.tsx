"use client";

import { ArrowCounterClockwise, Plus, Trash } from "@phosphor-icons/react/ssr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export interface SecretsDraft {
  editing: boolean;
  changes: Record<string, string>;
  removed: string[];
  added: Array<{ name: string; value: string }>;
}

export const emptySecretsDraft = (): SecretsDraft => ({ editing: false, changes: {}, removed: [], added: [] });

export function secretsPatchOf(draft: SecretsDraft): Record<string, string | null> {
  if (!draft.editing) return {};
  const patch: Record<string, string | null> = {};
  for (const [name, value] of Object.entries(draft.changes)) if (value !== "") patch[name] = value;
  for (const name of draft.removed) patch[name] = null;
  for (const { name, value } of draft.added) if (name.trim() !== "" && value !== "") patch[name.trim()] = value;
  return patch;
}

export function SecretsEditor({
  keys,
  draft,
  onChange,
  disabled,
}: {
  keys: string[];
  draft: SecretsDraft;
  onChange: (draft: SecretsDraft) => void;
  disabled?: boolean;
}) {
  const toggleRemoved = (name: string) =>
    onChange({
      ...draft,
      removed: draft.removed.includes(name) ? draft.removed.filter((item) => item !== name) : [...draft.removed, name],
    });

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[13px] leading-none font-medium">Bí mật</p>
          <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
            Mã hóa trước khi lưu, không bao giờ hiển thị lại. Dùng trong cấu hình bằng {"{{secrets.tên}}"}.
          </p>
        </div>
        <label className="flex items-center gap-2 text-[13px] font-medium">
          <Switch
            checked={draft.editing}
            onCheckedChange={(editing) => onChange(editing ? { ...draft, editing } : emptySecretsDraft())}
            disabled={disabled}
          />
          Thay đổi thông tin bí mật
        </label>
      </div>

      {keys.length === 0 && !draft.editing ? (
        <p className="rounded-md bg-subtle px-3 py-2.5 text-xs text-muted-foreground">
          Chưa có bí mật nào. Bật công tắc để thêm mật khẩu, API key hoặc khóa ký.
        </p>
      ) : null}

      <ul className="grid gap-2">
        {keys.map((name) => {
          const removed = draft.removed.includes(name);
          return (
            <li key={name} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
              <code className="flex h-9 items-center rounded-md bg-subtle px-3 font-mono text-[13px] sm:w-2/5">
                {name}
              </code>
              {draft.editing && !removed ? (
                <div className="min-w-40 flex-1">
                  <PasswordInput
                    value={draft.changes[name] ?? ""}
                    onChange={(event) =>
                      onChange({ ...draft, changes: { ...draft.changes, [name]: event.target.value } })
                    }
                    placeholder="Để trống để giữ nguyên"
                    aria-label={`Giá trị mới của ${name}`}
                    autoComplete="new-password"
                    disabled={disabled}
                    className="font-mono text-[13px]"
                  />
                </div>
              ) : (
                <span className="flex min-w-40 flex-1 items-center gap-2 text-[13px] text-muted-foreground">
                  {removed ? (
                    <Badge tone="danger">Sẽ xóa khi lưu</Badge>
                  ) : (
                    <>
                      <span className="font-mono tracking-widest" aria-hidden>
                        ••••••••
                      </span>
                      <Badge tone="success">Đã cấu hình</Badge>
                    </>
                  )}
                </span>
              )}
              {draft.editing ? (
                <Button
                  variant={removed ? "ghost" : "destructive-ghost"}
                  size="icon-sm"
                  onClick={() => toggleRemoved(name)}
                  disabled={disabled}
                  aria-label={removed ? `Giữ lại bí mật ${name}` : `Xóa bí mật ${name}`}
                >
                  {removed ? <ArrowCounterClockwise aria-hidden /> : <Trash aria-hidden />}
                </Button>
              ) : null}
            </li>
          );
        })}
        {draft.added.map((item, index) => (
          <li key={`new-${index}`} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
            <Input
              value={item.name}
              onChange={(event) =>
                onChange({
                  ...draft,
                  added: draft.added.map((row, position) =>
                    position === index ? { ...row, name: event.target.value } : row,
                  ),
                })
              }
              placeholder="Tên, ví dụ password"
              aria-label={`Tên bí mật mới ${index + 1}`}
              disabled={disabled}
              className="font-mono text-[13px] sm:w-2/5"
              autoComplete="off"
              spellCheck={false}
            />
            <div className="min-w-40 flex-1">
              <PasswordInput
                value={item.value}
                onChange={(event) =>
                  onChange({
                    ...draft,
                    added: draft.added.map((row, position) =>
                      position === index ? { ...row, value: event.target.value } : row,
                    ),
                  })
                }
                placeholder="Giá trị"
                aria-label={`Giá trị bí mật mới ${index + 1}`}
                autoComplete="new-password"
                disabled={disabled}
                className="font-mono text-[13px]"
              />
            </div>
            <Button
              variant="destructive-ghost"
              size="icon-sm"
              onClick={() => onChange({ ...draft, added: draft.added.filter((_, position) => position !== index) })}
              disabled={disabled}
              aria-label={`Bỏ bí mật mới ${index + 1}`}
            >
              <Trash aria-hidden />
            </Button>
          </li>
        ))}
      </ul>

      {draft.editing ? (
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onChange({ ...draft, added: [...draft.added, { name: "", value: "" }] })}
            disabled={disabled}
          >
            <Plus aria-hidden />
            Thêm bí mật
          </Button>
        </div>
      ) : null}
    </div>
  );
}
