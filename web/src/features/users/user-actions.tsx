"use client";

import { KeyRound, Lock, MoreHorizontal, Trash2, Unlock, UserCog } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Hint } from "@/components/ui/tooltip";
import { usePermission, useSession } from "@/features/auth/session-provider";
import type { SystemRole, User } from "@/lib/api/types";
import { POLICIES } from "@/lib/auth/policies";
import { ACTIVE_STATUS, LOCKED_STATUS, ROLE_OPTIONS, roleMeta } from "./constants";
import { useDeleteUser, useUpdateUser } from "./hooks";
import { ResetPasswordDialog } from "./reset-password-dialog";

type PendingAction =
  { type: "role"; role: SystemRole } | { type: "status" } | { type: "delete" } | { type: "password" } | null;

export function UserActions({ user }: { user: User }) {
  const session = useSession();
  const canUpdate = usePermission(POLICIES.users.update, user);
  const canDelete = usePermission(POLICIES.users.remove, user);
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const [pending, setPending] = useState<PendingAction>(null);

  const isSelf = session.user.id === user.id;
  const isActive = user.status === ACTIVE_STATUS;
  const close = () => setPending(null);

  if (!canUpdate && !canDelete) return null;

  const confirmRole = (role: SystemRole) =>
    updateUser.mutate(
      {
        id: user.id,
        input: { role },
        notice: {
          title: "Đã cập nhật vai trò",
          description: `${user.email} → ${roleMeta(role).label}. Có hiệu lực từ lần đăng nhập hoặc làm mới phiên tiếp theo.`,
        },
      },
      { onSettled: close },
    );

  const confirmStatus = () =>
    updateUser.mutate(
      {
        id: user.id,
        input: { status: isActive ? LOCKED_STATUS : ACTIVE_STATUS },
        notice: { title: isActive ? "Đã khóa tài khoản" : "Đã kích hoạt tài khoản", description: user.email },
      },
      { onSettled: close },
    );

  const trigger = (
    <Button variant="ghost" size="icon-sm" aria-label={`Thao tác với ${user.email}`}>
      <MoreHorizontal aria-hidden />
    </Button>
  );

  return (
    <>
      <DropdownMenu>
        <Hint label="Thao tác" side="left">
          <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
        </Hint>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
          {canUpdate ? (
            <>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger disabled={isSelf}>
                  <UserCog aria-hidden />
                  Đổi vai trò
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-52">
                  <DropdownMenuRadioGroup
                    value={user.role}
                    onValueChange={(role) => {
                      if (role !== user.role) setPending({ type: "role", role: role as SystemRole });
                    }}
                  >
                    {ROLE_OPTIONS.map((option) => (
                      <DropdownMenuRadioItem key={option.value} value={option.value}>
                        {option.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem onSelect={() => setPending({ type: "password" })}>
                <KeyRound aria-hidden />
                Đặt lại mật khẩu
              </DropdownMenuItem>
              <DropdownMenuItem disabled={isSelf} onSelect={() => setPending({ type: "status" })}>
                {isActive ? <Lock aria-hidden /> : <Unlock aria-hidden />}
                {isActive ? "Khóa tài khoản" : "Kích hoạt tài khoản"}
              </DropdownMenuItem>
            </>
          ) : null}
          {canDelete ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem tone="danger" disabled={isSelf} onSelect={() => setPending({ type: "delete" })}>
                <Trash2 aria-hidden />
                Xóa người dùng
              </DropdownMenuItem>
            </>
          ) : null}
          {isSelf ? (
            <p className="px-2 pt-1 pb-1.5 text-[11px] leading-snug text-muted-foreground">
              Một số thao tác bị khóa trên tài khoản của chính bạn.
            </p>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {pending?.type === "role" ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => (!open ? close() : undefined)}
          title="Đổi vai trò người dùng?"
          description={
            <>
              <span className="font-medium text-foreground">{user.email}</span> sẽ chuyển từ{" "}
              <span className="font-medium text-foreground">{roleMeta(user.role).label}</span> sang{" "}
              <span className="font-medium text-foreground">{roleMeta(pending.role).label}</span>. Quyền mới có hiệu lực
              khi người dùng đăng nhập lại hoặc phiên được làm mới.
            </>
          }
          confirmLabel="Đổi vai trò"
          isPending={updateUser.isPending}
          onConfirm={() => confirmRole(pending.role)}
        />
      ) : null}

      {pending?.type === "status" ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => (!open ? close() : undefined)}
          title={isActive ? "Khóa tài khoản này?" : "Kích hoạt lại tài khoản?"}
          description={
            isActive
              ? `${user.email} sẽ không thể đăng nhập hoặc làm mới phiên cho tới khi được kích hoạt lại.`
              : `${user.email} sẽ có thể đăng nhập trở lại.`
          }
          confirmLabel={isActive ? "Khóa tài khoản" : "Kích hoạt"}
          tone={isActive ? "danger" : "default"}
          isPending={updateUser.isPending}
          onConfirm={confirmStatus}
        />
      ) : null}

      {pending?.type === "delete" ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => (!open ? close() : undefined)}
          title="Xóa vĩnh viễn người dùng?"
          description={`Tài khoản ${user.email} và toàn bộ phiên đăng nhập sẽ bị xóa. Thao tác này không thể hoàn tác.`}
          confirmLabel="Xóa người dùng"
          tone="danger"
          isPending={deleteUser.isPending}
          onConfirm={() => {
            close();
            deleteUser.mutate(user);
          }}
        />
      ) : null}

      {pending?.type === "password" ? <ResetPasswordDialog user={user} onClose={close} /> : null}
    </>
  );
}
