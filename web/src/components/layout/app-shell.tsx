"use client";

import { Menu } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAppAbility } from "@/features/auth/session-provider";
import { cn } from "@/lib/utils";
import { Brand } from "./brand";
import { HealthPill } from "./health-pill";
import { isActivePath, NAV_SECTIONS, ROUTE_LABELS } from "./navigation";
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
    <nav aria-label="Điều hướng chính" className="flex flex-col gap-6">
      {sections.map((section) => (
        <div key={section.title} className="space-y-1">
          <p className="px-3 pb-1 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground/80 uppercase">
            {section.title}
          </p>
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
                  "group relative flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors pointer-coarse:h-11",
                  active
                    ? "bg-card text-foreground shadow-soft ring-1 ring-border"
                    : "text-muted-foreground hover:bg-accent/70 hover:text-foreground",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-y-2 left-0 w-[3px] rounded-full bg-primary transition-opacity",
                    active ? "opacity-100" : "opacity-0",
                  )}
                />
                <Icon className={cn("size-4 shrink-0", active ? "text-primary" : "")} aria-hidden />
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
      <div className="flex h-16 shrink-0 items-center px-5">
        <Link href="/" onClick={onNavigate} className="rounded-lg" aria-label="Về bảng điều khiển">
          <Brand />
        </Link>
      </div>
      <div className="flex-1 scrollbar-thin overflow-y-auto px-3 py-4">
        <SidebarNav onNavigate={onNavigate} />
      </div>
      <div className="border-t border-sidebar-border p-4">
        <HealthPill className="w-full justify-center" />
      </div>
    </div>
  );
}

function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const section = segments[0];
  const crumbs: Array<{ label: string; href?: string }> = section
    ? [{ label: ROUTE_LABELS[section] ?? section, href: segments.length > 1 ? `/${section}` : undefined }]
    : [{ label: "Bảng điều khiển" }];
  if (segments.length > 1) crumbs.push({ label: "Chi tiết" });

  return (
    <nav aria-label="Vị trí hiện tại" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        {crumbs.map((crumb, index) => (
          <li key={crumb.label} className="flex min-w-0 items-center gap-1.5">
            {index > 0 ? (
              <span className="text-muted-foreground/60" aria-hidden>
                /
              </span>
            ) : null}
            {crumb.href ? (
              <Link href={crumb.href as Route} className="truncate text-muted-foreground hover:text-foreground">
                {crumb.label}
              </Link>
            ) : (
              <span className="truncate font-medium" aria-current={index === crumbs.length - 1 ? "page" : undefined}>
                {crumb.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      <a
        href="#main"
        className="sr-only z-[60] rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Bỏ qua điều hướng
      </a>
      <aside className="sticky top-0 hidden h-dvh border-r border-sidebar-border bg-sidebar lg:block">
        <SidebarBody />
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="-ml-1.5 lg:hidden" aria-label="Mở menu điều hướng">
                <Menu aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="left">
              <SheetTitle className="sr-only">Menu điều hướng</SheetTitle>
              <SheetDescription className="sr-only">Chọn một mục để chuyển trang</SheetDescription>
              <SidebarBody onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
          <Breadcrumbs />
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <HealthPill className="hidden md:inline-flex" />
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
