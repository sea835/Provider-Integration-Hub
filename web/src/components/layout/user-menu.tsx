"use client";

import { CaretDown, SignOut } from "@phosphor-icons/react/ssr";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession } from "@/features/auth/session-provider";
import { roleMeta } from "@/features/users/constants";
import { signOutAndRedirect } from "@/lib/api/client";

export function UserMenu() {
  const { user } = useSession();
  const [signingOut, setSigningOut] = useState(false);
  const role = roleMeta(user.role);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-10 items-center gap-1.5 rounded-full pr-1 text-hero-foreground outline-white transition-opacity duration-200 hover:opacity-90"
        aria-label={`Tài khoản ${user.email}`}
      >
        <Avatar name={user.email} className="size-10 text-xs ring-2 ring-white/40" />
        <CaretDown className="size-3.5" weight="fill" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center gap-3 py-2">
          <Avatar name={user.email} className="size-9" />
          <span className="min-w-0 space-y-1">
            <span className="block truncate text-sm font-medium text-foreground">{user.email}</span>
            <Badge tone={role.tone}>{role.label}</Badge>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          tone="danger"
          disabled={signingOut}
          onSelect={(event) => {
            event.preventDefault();
            setSigningOut(true);
            void signOutAndRedirect("signed-out");
          }}
        >
          <SignOut aria-hidden />
          {signingOut ? "Đang đăng xuất..." : "Đăng xuất"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
