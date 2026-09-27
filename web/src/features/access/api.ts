import { api } from "@/lib/api/client";
import type { Permission, Role } from "@/lib/api/types";

export interface CreateRoleInput {
  code: string;
  name: string;
  description?: string;
}

export interface UpdateRoleInput {
  name?: string;
  description?: string;
  status?: string;
}

export interface CreatePermissionInput {
  action: string;
  subject: string;
  conditions?: Record<string, unknown>;
  description?: string;
}

export const accessApi = {
  roles: () => api.get<Role[]>("/authorization/roles"),
  createRole: (input: CreateRoleInput) => api.post<Role>("/authorization/roles", input),
  updateRole: (id: string, input: UpdateRoleInput) => api.patch<Role>(`/authorization/roles/${id}`, input),
  deleteRole: (id: string) => api.delete<{ success: boolean }>(`/authorization/roles/${id}`),
  rolePermissions: (id: string) => api.get<Permission[]>(`/authorization/roles/${id}/permissions`),
  assignPermissions: (id: string, permissionIds: string[]) =>
    api.post<{ success: boolean }>(`/authorization/roles/${id}/permissions`, { permissionIds }),
  permissions: () => api.get<Permission[]>("/authorization/permissions"),
  createPermission: (input: CreatePermissionInput) => api.post<Permission>("/authorization/permissions", input),
  deletePermission: (id: string) => api.delete<{ success: boolean }>(`/authorization/permissions/${id}`),
};

export const SYSTEM_ROLE_CODES = new Set(["ADMIN", "MANAGER", "USER"]);

export function isProtectedPermission(permission: Pick<Permission, "action" | "subject">): boolean {
  return permission.action === "manage" && permission.subject === "all";
}
