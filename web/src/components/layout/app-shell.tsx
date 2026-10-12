"use client";

import { List } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAppAbility } from "@/features/auth/session-provider";
import { cn } from "@/lib/utils";
import { Brand } from "./brand";
import { HealthPill } from "./health-pill";
import { isActivePath, NAV_SECTIONS } from "./navigation";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const ability = useAppAbility();
  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.policy || ability.can(item.policy[0], item.policy[1])),
  })).filter((section) => section.items.length > 0);

  return (
    <nav aria-label="Điều hướng chính" className="flex flex-col gap-3">
      {sections.map((section) => (
        <div key={section.title} role="group" aria-label={section.title} className="space-y-1">
          {section.items.map((item) => {
            const active = isActivePath(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-10 items-center gap-3 rounded-md pr-3 pl-5 text-[13px] outline-white transition-[background-color,color] duration-200 focus-visible:-outline-offset-2 pointer-coarse:h-12",
                  active
                    ? "bg-white/20 font-semibold text-white before:absolute before:top-1/2 before:left-0 before:h-7 before:w-1.5 before:-translate-y-1/2 before:rounded-r-full before:bg-white"
                    : "font-medium text-white/80 hover:bg-white/10 hover:text-white",
                )}
              >
                <Icon className="size-[18px] shrink-0" weight="fill" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col py-6">
      <Link
        href="/"
        onClick={onNavigate}
        className="mx-auto shrink-0 rounded-xl outline-white"
        aria-label="Về bảng điều khiển"
      >
        <Brand stacked />
      </Link>
      <div className="mt-7 flex-1 scrollbar-thin overflow-y-auto">
        <SidebarNav onNavigate={onNavigate} />
      </div>
      <div className="shrink-0 px-5 pt-4">
        <HealthPill />
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-dvh md:p-3 lg:p-4">
      <a
        href="#main"
        className="sr-only z-[60] rounded-md bg-white px-3 py-2 text-sm font-semibold text-primary focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Bỏ qua điều hướng
      </a>
      <div className="glass-frame min-h-dvh md:grid md:min-h-[calc(100dvh-1.5rem)] md:grid-cols-[192px_minmax(0,1fr)] md:gap-4 md:rounded-3xl md:p-4 lg:min-h-[calc(100dvh-2rem)] lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-5 lg:rounded-[28px] lg:p-5">
        <aside className="sidebar-surface sticky top-7 hidden h-[calc(100dvh-3.5rem)] overflow-hidden rounded-[20px] md:block lg:top-9 lg:h-[calc(100dvh-4.5rem)]">
          <SidebarBody />
        </aside>
        <div className="relative mx-auto flex w-full max-w-[1320px] min-w-0 flex-col">
          <div className="z-30 flex items-center gap-2 px-4 pt-4 md:absolute md:top-0.5 md:right-0 md:p-0">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="inverse-ghost"
                  size="icon"
                  className="glass-chip rounded-full md:hidden"
                  aria-label="Mở menu điều hướng"
                >
                  <List aria-hidden />
                </Button>
              </SheetTrigger>
              <SheetContent side="left">
                <SheetTitle className="sr-only">Menu điều hướng</SheetTitle>
                <SheetDescription className="sr-only">Chọn một mục để chuyển trang</SheetDescription>
                <SidebarBody onNavigate={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>
            <div className="ml-auto flex items-center gap-2.5">
              <ThemeToggle />
              <UserMenu />
            </div>
          </div>
          <main id="main" tabIndex={-1} className="flex-1 px-4 pt-5 pb-10 outline-none md:px-0.5 md:pt-0.5 md:pb-1">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
