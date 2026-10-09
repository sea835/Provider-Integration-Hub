"use client";

import {
  ArrowCounterClockwise,
  Info,
  ListChecks,
  PencilSimple,
  Plus,
  ShieldCheck,
  Trash,
  Warning,
} from "@phosphor-icons/react/ssr";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { PageBanner } from "@/components/layout/page-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Hint } from "@/components/ui/tooltip";
import { useSession } from "@/features/auth/session-provider";
import type { Permission, Role } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { isProtectedPermission, SYSTEM_ROLE_CODES } from "./api";
import { useAssignPermissions, useDeleteRole, usePermissions, useRolePermissions, useRoles } from "./hooks";
import { PermissionCatalog } from "./permission-catalog";
import { PermissionDialog } from "./permission-dialog";
import { PermissionMatrix } from "./permission-matrix";
import { RoleDialog } from "./role-dialog";

const ROLE_ORDER = ["ADMIN", "MANAGER", "USER"];

type DialogState =
  | { type: "create-role" }
  | { type: "edit-role"; role: Role }
  | { type: "delete-role"; role: Role }
  | { type: "create-permission"; preset?: { action: string; subject: string }; autoSelect: boolean }
  | null;

function Notice({ tone, icon: Icon, children }: { tone: "info" | "warning"; icon: typeof Info; children: ReactNode }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-md px-3 py-2.5 text-[13px] leading-relaxed",
        tone === "info" ? "bg-info-soft text-info" : "bg-warning-soft text-warning",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p className="text-foreground/85">{children}</p>
    </div>
  );
}

function countChanges(baseline: Set<string>, current: Set<string>): number {
  let changes = 0;
  for (const id of current) if (!baseline.has(id)) changes += 1;
  for (const id of baseline) if (!current.has(id)) changes += 1;
  return changes;
}

function sortRoles(roles: Role[]): Role[] {
  return [...roles].sort((a, b) => {
    const ai = ROLE_ORDER.indexOf(a.code);
    const bi = ROLE_ORDER.indexOf(b.code);
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    return a.name.localeCompare(b.name, "vi");
  });
}

export function AccessView() {
  const { user } = useSession();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rolesQuery = useRoles();
  const permissionsQuery = usePermissions();
  const assign = useAssignPermissions();
  const deleteRole = useDeleteRole();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [draft, setDraft] = useState<{ roleId: string; ids: Set<string> } | null>(null);
  const [pendingSwitch, setPendingSwitch] = useState<string | null>(null);

  const roles = useMemo(() => sortRoles(rolesQuery.data ?? []), [rolesQuery.data]);
  const permissions = useMemo(() => permissionsQuery.data ?? [], [permissionsQuery.data]);
  const tab = searchParams.get("tab") === "catalog" ? "catalog" : "roles";
  const requestedCode = searchParams.get("role");
  const selectedRole =
    roles.find((role) => role.code === requestedCode) ?? roles.find((role) => role.code !== "ADMIN") ?? roles[0];
  const rolePermissions = useRolePermissions(selectedRole?.id);

  const baseline = useMemo(
    () => new Set((rolePermissions.data ?? []).map((permission) => permission.id)),
    [rolePermissions.data],
  );
  const current = draft && draft.roleId === selectedRole?.id ? draft.ids : baseline;
  const changes = countChanges(baseline, current);
  const dirty = changes > 0;
  const isAdminRole = selectedRole?.code === "ADMIN";
  const grantsEverything = permissions.some(
    (permission) => isProtectedPermission(permission) && current.has(permission.id),
  );

  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const setParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(window.location.search);
    if (value) params.set(key, value);
    else params.delete(key);
    const query = params.toString();
    window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
  };

  const applyRole = (code: string) => {
    setDraft(null);
    setParam("role", code);
  };

  const selectRole = (code: string) => {
    if (code === selectedRole?.code) return;
    if (dirty) setPendingSwitch(code);
    else applyRole(code);
  };

  const toggle = (ids: string[], checked: boolean) => {
    if (!selectedRole) return;
    const next = new Set(current);
    for (const id of ids) {
      if (checked) next.add(id);
      else next.delete(id);
    }
    setDraft({ roleId: selectedRole.id, ids: next });
  };

  const save = () => {
    if (!selectedRole) return;
    assign.mutate(
      { role: selectedRole, permissionIds: [...current] },
      {
        onSuccess: () => {
          setDraft(null);
          toast.success("Đã lưu phân quyền", {
            description: `${selectedRole.name}: ${current.size} quyền được gán. Áp dụng ngay cho các request tiếp theo.`,
          });
        },
      },
    );
  };

  const onPermissionCreated = (permission: Permission, autoSelect: boolean) => {
    if (autoSelect && selectedRole && !isAdminRole) toggle([permission.id], true);
  };

  const knownSubjects = useMemo(
    () => Array.from(new Set(permissions.map((permission) => permission.subject))),
    [permissions],
  );
  const isLoading = rolesQuery.isPending || permissionsQuery.isPending;
  const loadError = rolesQuery.error ?? permissionsQuery.error;

  return (
    <div className="space-y-6">
      <PageBanner
        eyebrow="Quản trị"
        title="Phân quyền"
        description="Quản lý vai trò, danh mục quyền hạn và gán quyền theo ma trận đối tượng và hành động."
        stats={[
          { label: "Vai trò", value: rolesQuery.data ? roles.length : "-" },
          { label: "Quyền hạn", value: permissionsQuery.data ? permissions.length : "-" },
        ]}
        actions={
          <>
            <Button variant="inverse" size="sm" onClick={() => setDialog({ type: "create-role" })}>
              <Plus aria-hidden />
              Tạo vai trò
            </Button>
            <Button
              variant="inverse-ghost"
              size="sm"
              onClick={() => setDialog({ type: "create-permission", autoSelect: false })}
            >
              <ListChecks aria-hidden />
              Tạo quyền hạn
            </Button>
          </>
        }
      />

      <Tabs value={tab} onValueChange={(value) => setParam("tab", value === "catalog" ? "catalog" : null)}>
        <TabsList>
          <TabsTrigger value="roles">
            <ShieldCheck aria-hidden />
            Vai trò & ma trận
          </TabsTrigger>
          <TabsTrigger value="catalog">
            <ListChecks aria-hidden />
            Danh mục quyền hạn
            {permissionsQuery.data ? (
              <span className="rounded-sm bg-muted px-1.5 text-[11px] text-muted-foreground tabular-nums">
                {permissions.length}
              </span>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roles">
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
              <Skeleton className="h-96 rounded-lg" />
              <Skeleton className="h-[480px] rounded-lg" />
            </div>
          ) : loadError ? (
            <Card>
              <ErrorState
                error={loadError}
                onRetry={() => {
                  void rolesQuery.refetch();
                  void permissionsQuery.refetch();
                }}
              />
            </Card>
          ) : !selectedRole ? (
            <Card>
              <EmptyState
                icon={ShieldCheck}
                title="Chưa có vai trò nào"
                description="Tạo vai trò đầu tiên để bắt đầu phân quyền."
                action={<Button onClick={() => setDialog({ type: "create-role" })}>Tạo vai trò</Button>}
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
              <div className="lg:hidden">
                <Select value={selectedRole.code} onValueChange={selectRole}>
                  <SelectTrigger aria-label="Chọn vai trò">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.code}>
                        {role.name} ({role.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Card className="hidden self-start overflow-hidden lg:block">
                <div className="flex items-center justify-between px-4 pt-3.5 pb-1">
                  <p className="text-sm font-semibold">
                    Vai trò <span className="font-normal text-muted-foreground tabular-nums">({roles.length})</span>
                  </p>
                </div>
                <ul className="space-y-0.5 p-2" aria-label="Danh sách vai trò">
                  {roles.map((role) => {
                    const active = role.id === selectedRole.id;
                    return (
                      <li key={role.id}>
                        <button
                          type="button"
                          onClick={() => selectRole(role.code)}
                          aria-pressed={active}
                          className={cn(
                            "w-full rounded-md px-2.5 py-2 text-left transition-colors duration-200",
                            active ? "bg-primary-soft" : "hover:bg-accent",
                          )}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className={cn("truncate text-sm font-medium", active && "text-primary")}>
                              {role.name}
                            </span>
                            {role.status !== "ACTIVE" ? <Badge tone="neutral">Ngừng</Badge> : null}
                          </span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                            <code className="font-mono">{role.code}</code>
                            {SYSTEM_ROLE_CODES.has(role.code) ? <span>· Hệ thống</span> : null}
                            {role.code === user.role ? <span className="text-primary">· Vai trò của bạn</span> : null}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Card>

              <Card className="min-w-0 overflow-hidden">
                <div className="flex flex-col gap-3 px-4 pt-4 pb-1 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold">{selectedRole.name}</h2>
                      <Badge tone="outline" className="font-mono">
                        {selectedRole.code}
                      </Badge>
                      {selectedRole.status !== "ACTIVE" ? <Badge tone="neutral">Ngừng sử dụng</Badge> : null}
                    </div>
                    <p className="text-sm text-muted-foreground">{selectedRole.description || "Chưa có mô tả."}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDialog({ type: "edit-role", role: selectedRole })}
                    >
                      <PencilSimple aria-hidden />
                      Sửa
                    </Button>
                    <Hint
                      label={
                        SYSTEM_ROLE_CODES.has(selectedRole.code) ? "Không thể xóa vai trò hệ thống" : "Xóa vai trò"
                      }
                    >
                      <span className="inline-flex">
                        <Button
                          variant="outline"
                          size="icon-sm"
                          disabled={SYSTEM_ROLE_CODES.has(selectedRole.code)}
                          onClick={() => setDialog({ type: "delete-role", role: selectedRole })}
                          aria-label={`Xóa vai trò ${selectedRole.name}`}
                        >
                          <Trash className="text-danger" aria-hidden />
                        </Button>
                      </span>
                    </Hint>
                  </div>
                </div>

                <div className="space-y-2 px-4 pt-3 empty:hidden">
                  {isAdminRole ? (
                    <Notice tone="info" icon={Info}>
                      Vai trò <strong>ADMIN</strong> luôn có toàn quyền (<code className="font-mono">manage · all</code>
                      ) được cố định ở backend, không phụ thuộc vào ma trận bên dưới.
                    </Notice>
                  ) : null}
                  {!isAdminRole && grantsEverything ? (
                    <Notice tone="warning" icon={Warning}>
                      Vai trò này đang được cấp <strong>toàn quyền trên mọi tài nguyên</strong>. Hãy chắc chắn đây là
                      điều bạn muốn.
                    </Notice>
                  ) : null}
                  {!isAdminRole &&
                  SYSTEM_ROLE_CODES.has(selectedRole.code) &&
                  current.size === 0 &&
                  !rolePermissions.isPending ? (
                    <Notice tone="info" icon={Info}>
                      Khi không gán quyền nào, backend tự áp dụng bộ quyền mặc định cho vai trò{" "}
                      <strong>{selectedRole.code}</strong>.
                    </Notice>
                  ) : null}
                </div>

                <div className="py-2">
                  {rolePermissions.isPending ? (
                    <div className="space-y-2 p-4" aria-hidden>
                      {Array.from({ length: 5 }, (_, index) => (
                        <Skeleton key={index} className="h-11 w-full" />
                      ))}
                    </div>
                  ) : rolePermissions.isError ? (
                    <ErrorState error={rolePermissions.error} onRetry={() => void rolePermissions.refetch()} />
                  ) : permissions.length === 0 ? (
                    <EmptyState
                      icon={ListChecks}
                      title="Chưa có quyền hạn nào"
                      description="Tạo quyền hạn để bắt đầu gán cho vai trò."
                    />
                  ) : (
                    <PermissionMatrix
                      permissions={permissions}
                      selected={isAdminRole ? new Set(permissions.map((permission) => permission.id)) : current}
                      onToggle={toggle}
                      readOnly={isAdminRole || assign.isPending}
                      onCreate={(preset) => setDialog({ type: "create-permission", preset, autoSelect: true })}
                    />
                  )}
                </div>

                {!isAdminRole ? (
                  <div className="sticky bottom-0 flex flex-col gap-3 rounded-b-lg bg-card/95 px-4 py-2.5 shadow-[0_-6px_12px_-8px_hsl(var(--shadow-color)/0.35)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[13px] text-muted-foreground" aria-live="polite">
                      {dirty ? (
                        <span className="font-medium text-warning">{changes} thay đổi chưa lưu</span>
                      ) : (
                        <span className="tabular-nums">
                          {current.size} / {permissions.length} quyền đang được gán
                        </span>
                      )}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!dirty || assign.isPending}
                        onClick={() => setDraft(null)}
                      >
                        <ArrowCounterClockwise aria-hidden />
                        Hoàn tác
                      </Button>
                      <Button size="sm" disabled={!dirty} isLoading={assign.isPending} onClick={save}>
                        Lưu thay đổi
                      </Button>
                    </div>
                  </div>
                ) : null}
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="catalog">
          <PermissionCatalog />
        </TabsContent>
      </Tabs>

      {dialog?.type === "create-role" ? (
        <RoleDialog onClose={() => setDialog(null)} onCreated={(role) => applyRole(role.code)} />
      ) : null}
      {dialog?.type === "edit-role" ? <RoleDialog role={dialog.role} onClose={() => setDialog(null)} /> : null}
      {dialog?.type === "create-permission" ? (
        <PermissionDialog
          preset={dialog.preset}
          knownSubjects={knownSubjects}
          onClose={() => setDialog(null)}
          onCreated={(permission) => onPermissionCreated(permission, dialog.autoSelect)}
        />
      ) : null}
      {dialog?.type === "delete-role" ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => (!open ? setDialog(null) : undefined)}
          title={`Xóa vai trò “${dialog.role.name}”?`}
          description="Các liên kết quyền của vai trò sẽ bị xóa theo. Người dùng đang mang mã vai trò này sẽ mất các quyền tương ứng."
          confirmLabel="Xóa vai trò"
          tone="danger"
          isPending={deleteRole.isPending}
          onConfirm={() =>
            deleteRole.mutate(dialog.role.id, {
              onSuccess: () => {
                toast.success("Đã xóa vai trò", { description: dialog.role.name });
                setDialog(null);
                setDraft(null);
                setParam("role", null);
              },
            })
          }
        />
      ) : null}
      {pendingSwitch ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => (!open ? setPendingSwitch(null) : undefined)}
          title="Bỏ các thay đổi chưa lưu?"
          description={`Bạn có ${changes} thay đổi phân quyền chưa lưu cho vai trò “${selectedRole?.name}”.`}
          confirmLabel="Bỏ thay đổi"
          tone="danger"
          onConfirm={() => {
            applyRole(pendingSwitch);
            setPendingSwitch(null);
          }}
        />
      ) : null}
    </div>
  );
}
