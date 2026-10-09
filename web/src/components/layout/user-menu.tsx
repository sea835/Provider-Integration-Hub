"use client";

import { CaretUpDown, SignOut } from "@phosphor-icons/react/ssr";
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
        className="flex h-9 items-center gap-2 rounded-md px-1 text-left transition-colors duration-200 hover:bg-accent data-[state=open]:bg-accent sm:pr-2"
        aria-label="Tài khoản của bạn"
      >
        <Avatar name={user.email} className="size-7" />
        <span className="hidden min-w-0 flex-col md:flex">
          <span className="max-w-44 truncate text-[13px] leading-tight font-medium">{user.email}</span>
          <span className="text-[11px] leading-tight text-muted-foreground">{role.label}</span>
        </span>
        <CaretUpDown className="hidden size-3.5 text-muted-foreground md:block" aria-hidden />
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
