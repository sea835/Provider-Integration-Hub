"use client";

import { BracketsCurly } from "@phosphor-icons/react/ssr";
import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface TemplateVariable {
  name: string;
  note: string;
}

export interface VariableGroup {
  title: string;
  empty: string;
  items: TemplateVariable[];
}

const SYSTEM_VARIABLES: TemplateVariable[] = [
  { name: "token", note: "Token lấy từ API đăng nhập" },
  { name: "now.unixMs", note: "Thời điểm hiện tại, mili giây" },
  { name: "now.unixSec", note: "Thời điểm hiện tại, giây" },
  { name: "now.iso", note: "Thời điểm hiện tại, ISO 8601" },
  { name: "now.date", note: "Ngày hiện tại theo giờ Việt Nam" },
  { name: "now.datetime", note: "Ngày giờ hiện tại theo giờ Việt Nam" },
  { name: "uuid", note: "Chuỗi ngẫu nhiên, mới cho mỗi lời gọi" },
];

export const REQUEST_VARIABLES: VariableGroup = {
  title: "Request đang ký",
  empty: "",
  items: [
    { name: "request.method", note: "Phương thức HTTP" },
    { name: "request.path", note: "Đường dẫn kèm query" },
    { name: "request.query", note: "Chuỗi query" },
    { name: "request.body", note: "Body thô trước khi gắn chữ ký" },
  ],
};

export function variableGroupsOf(vars: Array<{ name: string; value: string }>, secretNames: string[]): VariableGroup[] {
  return [
    {
      title: "Biến",
      empty: "Chưa khai báo biến nào ở mục Kết nối.",
      items: vars
        .filter((item) => item.name.trim() !== "")
        .map((item) => ({ name: `vars.${item.name.trim()}`, note: item.value || "(rỗng)" })),
    },
    {
      title: "Bí mật",
      empty: "Chưa có bí mật nào ở mục Kết nối.",
      items: secretNames.map((name) => ({ name: `secrets.${name}`, note: "Giá trị đã mã hóa" })),
    },
    { title: "Hệ thống", empty: "", items: SYSTEM_VARIABLES },
  ];
}

const VariablesContext = createContext<VariableGroup[]>([]);

export function VariablesProvider({ groups, children }: { groups: VariableGroup[]; children: ReactNode }) {
  return <VariablesContext.Provider value={groups}>{children}</VariablesContext.Provider>;
}

export function TemplateInput({
  id,
  value,
  onChange,
  placeholder,
  disabled,
  label,
  className,
  extraGroups,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  label: string;
  className?: string;
  extraGroups?: VariableGroup[];
}) {
  const shared = useContext(VariablesContext);
  const groups = extraGroups ? [...extraGroups, ...shared] : shared;
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const caret = useRef<{ start: number; end: number } | null>(null);

  const remember = () => {
    const input = inputRef.current;
    if (input) caret.current = { start: input.selectionStart ?? value.length, end: input.selectionEnd ?? value.length };
  };

  const insert = (name: string) => {
    const token = `{{${name}}}`;
    const start = Math.min(caret.current?.start ?? value.length, value.length);
    const end = Math.min(caret.current?.end ?? value.length, value.length);
    onChange(`${value.slice(0, start)}${token}${value.slice(end)}`);
    setOpen(false);
    const position = start + token.length;
    caret.current = { start: position, end: position };
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(position, position);
    });
  };

  return (
    <div className={cn("relative min-w-0", className)}>
      <Input
        ref={inputRef}
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onSelect={remember}
        onBlur={remember}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={id ? undefined : label}
        className="pr-10 font-mono text-[13px]"
        spellCheck={false}
        autoComplete="off"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label={`Chèn biến vào ${label}`}
            title="Chèn biến"
            className="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-primary disabled:pointer-events-none disabled:opacity-50 data-[state=open]:text-primary"
          >
            <BracketsCurly className="size-4" weight="bold" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[min(22rem,calc(100vw-1.5rem))] p-2"
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <p className="px-2 pt-1 pb-2 text-xs text-muted-foreground">Bấm vào một biến để chèn vào vị trí con trỏ.</p>
          <div className="max-h-72 scrollbar-thin space-y-2 overflow-y-auto">
            {groups.map((group) => (
              <div key={group.title}>
                <p className="px-2 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  {group.title}
                </p>
                {group.items.length === 0 ? (
                  <p className="px-2 pb-1 text-xs text-muted-foreground">{group.empty}</p>
                ) : (
                  <ul>
                    {group.items.map((item) => (
                      <li key={item.name}>
                        <button
                          type="button"
                          onClick={() => insert(item.name)}
                          className="flex w-full items-baseline justify-between gap-3 rounded-sm px-2 py-1.5 text-left hover:bg-accent focus-visible:bg-accent"
                        >
                          <span className="font-mono text-xs font-medium text-primary">{`{{${item.name}}}`}</span>
                          <span className="min-w-0 truncate text-xs text-muted-foreground">{item.note}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
