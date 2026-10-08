"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Section, type EditorKit } from "./section";
import { MAX_HOSTS, type HostSpec, type IntegrationSpec, type RequestSpec } from "./types";

const KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,29}$/;
const URL_PATTERN = /^https?:\/\/[^\s/]+/i;

const REQUESTS: Array<[string, (spec: IntegrationSpec) => RequestSpec | null]> = [
  ["Đăng nhập", (spec) => (spec.token.enabled ? spec.token.request : null)],
  ["1. Danh sách gói", (spec) => (spec.packages.enabled ? spec.packages.request : null)],
  ["2. Kiểm tra gói", (spec) => (spec.check.enabled ? spec.check.request : null)],
  ["Số dư", (spec) => (spec.balance.enabled ? spec.balance.request : null)],
  ["3. Đăng ký gói", (spec) => spec.submit.request],
  ["4. Kiểm tra trạng thái", (spec) => (spec.query.source === "SINGLE" ? spec.query.request : null)],
  ["5. Danh sách đơn", (spec) => (spec.orders.enabled ? spec.orders.request : null)],
  ["Kiểm tra kết nối", (spec) => spec.test.request],
];

function usersOf(spec: IntegrationSpec, key: string): string[] {
  return REQUESTS.filter(([, pick]) => (pick(spec)?.host ?? "") === key).map(([label]) => label);
}

function problemOf(host: HostSpec, hosts: HostSpec[]): string | null {
  if (!host.key) return "Chưa đặt tên";
  if (!KEY_PATTERN.test(host.key)) return "Tên bắt đầu bằng chữ, chỉ gồm chữ, số, gạch dưới";
  if (hosts.filter((item) => item.key === host.key).length > 1) return "Trùng tên với địa chỉ khác";
  if (!host.url) return "Chưa nhập URL";
  if (!URL_PATTERN.test(host.url)) return "URL phải bắt đầu bằng http:// hoặc https://";
  return null;
}

export function HostsSection({ kit }: { kit: EditorKit }) {
  const { spec, supplier } = kit;
  const hosts = spec.hosts;
  const setHosts = (next: HostSpec[]) => kit.set(["hosts"], next);
  const update = (index: number, patch: Partial<HostSpec>) =>
    setHosts(hosts.map((host, i) => (i === index ? { ...host, ...patch } : host)));
  const baseUsers = usersOf(spec, "");

  return (
    <Section
      {...kit.section("hosts")}
      summary={
        hosts.length > 0
          ? `Base URL + ${hosts.length} địa chỉ: ${hosts.map((host) => host.key || "?").join(", ")}`
          : `Chỉ dùng Base URL ${supplier.baseUrl}`
      }
      title="Địa chỉ gốc"
      description="Nhà cung cấp có nhiều máy chủ (vd đăng nhập, thanh toán, tra cứu khác nhau) thì khai báo ở đây một lần, mỗi API chọn ở ô Gọi tới. Đổi môi trường (sandbox → thật) chỉ cần sửa URL tại đây."
    >
      <div className="grid gap-1 rounded-lg border bg-subtle/50 p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[13px] font-medium">Base URL của nhà cung cấp</p>
          <p className="text-[12px] text-muted-foreground">Sửa ở tab Cấu hình</p>
        </div>
        <p className="font-mono text-[12.5px] break-all">{supplier.baseUrl}</p>
        <p className="text-[12px] text-muted-foreground">
          {baseUsers.length > 0 ? `Đang dùng cho: ${baseUsers.join(", ")}` : "Không API nào dùng"}
        </p>
      </div>

      {hosts.map((host, index) => {
        const problem = problemOf(host, hosts);
        const users = host.key ? usersOf(spec, host.key) : [];
        const id = `host-${index}`;
        return (
          <div key={index} className="grid gap-2 rounded-lg border p-3">
            <div className="grid grid-cols-1 gap-2 @lg:grid-cols-[160px_minmax(0,1fr)_minmax(0,2fr)_auto] @lg:items-end">
              <div className="grid gap-1">
                <Label htmlFor={`${id}-key`} className="text-[11.5px] font-normal text-muted-foreground">
                  Tên
                </Label>
                <Input
                  id={`${id}-key`}
                  value={host.key}
                  onChange={(event) => update(index, { key: event.target.value.trim() })}
                  placeholder="payment"
                  maxLength={30}
                  spellCheck={false}
                  disabled={users.length > 0}
                  title={
                    users.length > 0 ? "Đang có API dùng địa chỉ này, đổi tên sẽ làm các API đó mất địa chỉ" : undefined
                  }
                  aria-invalid={problem ? true : undefined}
                  aria-describedby={problem ? `${id}-problem` : undefined}
                  className="h-8 font-mono text-[13px]"
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor={`${id}-label`} className="text-[11.5px] font-normal text-muted-foreground">
                  Ghi chú
                </Label>
                <Input
                  id={`${id}-label`}
                  value={host.label}
                  onChange={(event) => update(index, { label: event.target.value })}
                  placeholder="Máy chủ thanh toán"
                  maxLength={100}
                  className="h-8 text-[13px]"
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor={`${id}-url`} className="text-[11.5px] font-normal text-muted-foreground">
                  URL
                </Label>
                <Input
                  id={`${id}-url`}
                  value={host.url}
                  onChange={(event) => update(index, { url: event.target.value.trim() })}
                  placeholder="https://payment.example.com/api"
                  inputMode="url"
                  spellCheck={false}
                  className="h-8 font-mono text-[13px]"
                />
              </div>
              <Button
                type="button"
                variant="destructive-ghost"
                size="icon-sm"
                className="justify-self-end"
                disabled={users.length > 0}
                onClick={() => setHosts(hosts.filter((_, i) => i !== index))}
                aria-label={`Xoá địa chỉ ${host.key || index + 1}`}
                title={users.length > 0 ? "Chuyển các API đang dùng sang địa chỉ khác trước khi xoá" : undefined}
              >
                <Trash2 aria-hidden />
              </Button>
            </div>
            {problem ? (
              <p id={`${id}-problem`} className="text-[12.5px] text-danger">
                {problem}
              </p>
            ) : null}
            <p className="text-[12px] text-muted-foreground">
              {users.length > 0
                ? `Đang dùng cho: ${users.join(", ")}. Muốn xoá hoặc đổi tên thì chuyển các API này sang địa chỉ khác trước.`
                : "Chưa API nào dùng. Chọn ở ô Gọi tới trong từng API."}
            </p>
          </div>
        );
      })}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="justify-self-start"
        disabled={hosts.length >= MAX_HOSTS}
        onClick={() => setHosts([...hosts, { key: "", label: "", url: "" }])}
      >
        <Plus aria-hidden />
        Thêm địa chỉ gốc
      </Button>
    </Section>
  );
}
