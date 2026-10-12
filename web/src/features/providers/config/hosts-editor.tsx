"use client";

import { Plus, Trash } from "@phosphor-icons/react/ssr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_HOSTS, type HostSpec, type IntegrationSpec } from "../types";

const KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,29}$/;
const URL_PATTERN = /^https?:\/\/[^\s/]+/i;

export function hostUsers(spec: IntegrationSpec, key: string): string[] {
  const users: string[] = [];
  if (spec.token.enabled && spec.token.request.host === key) users.push("API đăng nhập");
  if (spec.balance.request.host === key) users.push("API số dư");
  return users;
}

function problemOf(host: HostSpec, hosts: HostSpec[]): string | null {
  if (!host.key) return "Chưa đặt tên";
  if (!KEY_PATTERN.test(host.key)) return "Tên bắt đầu bằng chữ, chỉ gồm chữ, số, gạch dưới (tối đa 30 ký tự)";
  if (hosts.filter((item) => item.key === host.key).length > 1) return "Trùng tên với Base URL khác";
  if (!host.url) return "Chưa nhập URL";
  if (!URL_PATTERN.test(host.url)) return "URL phải bắt đầu bằng http:// hoặc https://";
  return null;
}

export function HostsEditor({
  hosts,
  spec,
  onChange,
  disabled,
}: {
  hosts: HostSpec[];
  spec: IntegrationSpec;
  onChange: (hosts: HostSpec[]) => void;
  disabled?: boolean;
}) {
  const update = (index: number, patch: Partial<HostSpec>) =>
    onChange(hosts.map((host, position) => (position === index ? { ...host, ...patch } : host)));

  return (
    <div className="grid gap-2">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[13px] leading-none font-medium">Base URL khác</p>
          <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
            Đối tác có nhiều máy chủ (ví dụ đăng nhập và số dư ở hai địa chỉ) thì thêm tại đây, rồi chọn ở ô Gọi tới của
            từng API. Đổi môi trường chỉ cần sửa URL một chỗ.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || hosts.length >= MAX_HOSTS}
          onClick={() => onChange([...hosts, { key: "", label: "", url: "" }])}
        >
          <Plus aria-hidden />
          Thêm Base URL
        </Button>
      </div>

      {hosts.length === 0 ? (
        <p className="rounded-md bg-subtle px-3 py-2.5 text-xs text-muted-foreground">
          Chưa có. Mọi API đang gọi tới Base URL mặc định.
        </p>
      ) : (
        <ul className="grid gap-2">
          {hosts.map((host, index) => {
            const problem = problemOf(host, hosts);
            const users = host.key ? hostUsers(spec, host.key) : [];
            const inUse = users.length > 0;
            const id = `config-host-${index}`;
            return (
              <li key={index} className="grid gap-2 rounded-lg bg-subtle p-3">
                <div className="grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)_minmax(0,2fr)_auto] sm:items-end">
                  <div className="grid gap-1.5">
                    <Label htmlFor={`${id}-key`} className="text-xs font-normal text-muted-foreground">
                      Tên
                    </Label>
                    <Input
                      id={`${id}-key`}
                      value={host.key}
                      onChange={(event) => update(index, { key: event.target.value.trim() })}
                      placeholder="auth"
                      maxLength={30}
                      spellCheck={false}
                      autoComplete="off"
                      disabled={disabled || inUse}
                      aria-invalid={problem ? true : undefined}
                      aria-describedby={`${id}-note`}
                      className="bg-card font-mono text-[13px]"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor={`${id}-label`} className="text-xs font-normal text-muted-foreground">
                      Ghi chú
                    </Label>
                    <Input
                      id={`${id}-label`}
                      value={host.label}
                      onChange={(event) => update(index, { label: event.target.value })}
                      placeholder="Máy chủ đăng nhập"
                      maxLength={100}
                      autoComplete="off"
                      disabled={disabled}
                      className="bg-card"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor={`${id}-url`} className="text-xs font-normal text-muted-foreground">
                      URL
                    </Label>
                    <Input
                      id={`${id}-url`}
                      value={host.url}
                      onChange={(event) => update(index, { url: event.target.value.trim() })}
                      placeholder="https://id.doitac.vn"
                      inputMode="url"
                      spellCheck={false}
                      autoComplete="off"
                      disabled={disabled}
                      aria-invalid={problem ? true : undefined}
                      aria-describedby={`${id}-note`}
                      className="bg-card font-mono text-[13px]"
                    />
                  </div>
                  <Button
                    variant="destructive-ghost"
                    size="icon"
                    className="justify-self-end"
                    disabled={disabled || inUse}
                    onClick={() => onChange(hosts.filter((_, position) => position !== index))}
                    aria-label={`Xóa Base URL ${host.key || index + 1}`}
                  >
                    <Trash aria-hidden />
                  </Button>
                </div>
                <p id={`${id}-note`} className="text-xs leading-snug text-muted-foreground">
                  {problem ? <span className="text-danger">{problem}. </span> : null}
                  {inUse
                    ? `Đang dùng cho: ${users.join(", ")}. Muốn đổi tên hoặc xóa thì chuyển các API này sang địa chỉ khác trước.`
                    : "Chưa API nào dùng. Chọn ở ô Gọi tới trong từng API."}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
