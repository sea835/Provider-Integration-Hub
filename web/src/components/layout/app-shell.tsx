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
    <nav aria-label="Điều hướng chính" className="flex flex-col gap-5">
      {sections.map((section) => (
        <div key={section.title} className="space-y-0.5">
          <p className="px-2.5 pb-1 text-xs font-medium text-muted-foreground">{section.title}</p>
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
                  "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-[background-color,color] duration-200 pointer-coarse:h-11",
                  active
                    ? "bg-hero text-hero-foreground shadow-xs"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" weight={active ? "fill" : "regular"} aria-hidden />
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
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center px-4">
        <Link href="/" onClick={onNavigate} className="rounded-md" aria-label="Về bảng điều khiển">
          <Brand />
        </Link>
      </div>
      <div className="flex-1 scrollbar-thin overflow-y-auto px-3 py-3">
        <SidebarNav onNavigate={onNavigate} />
      </div>
      <div className="px-5 py-4">
        <HealthPill />
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[216px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)]">
      <a
        href="#main"
        className="sr-only z-[60] rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Bỏ qua điều hướng
      </a>
      <aside className="sticky top-0 hidden h-dvh md:block">
        <SidebarBody />
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-2 bg-background/85 px-4 backdrop-blur-md sm:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="-ml-1.5 md:hidden" aria-label="Mở menu điều hướng">
                <List aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
              <SheetTitle className="sr-only">Menu điều hướng</SheetTitle>
              <SheetDescription className="sr-only">Chọn một mục để chuyển trang</SheetDescription>
              <SidebarBody onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-[1280px] flex-1 px-4 pt-2 pb-14 outline-none sm:px-6 lg:px-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
