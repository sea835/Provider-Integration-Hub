"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Permission, Role } from "@/lib/api/types";
import { queryKeys } from "@/lib/query-keys";
import { accessApi, type CreatePermissionInput, type CreateRoleInput, type UpdateRoleInput } from "./api";

export function useRoles(enabled = true) {
  return useQuery({ queryKey: queryKeys.roles.list, queryFn: accessApi.roles, enabled });
}

export function usePermissions(enabled = true) {
  return useQuery({ queryKey: queryKeys.permissions.list, queryFn: accessApi.permissions, enabled });
}

export function useRolePermissions(roleId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.roles.permissions(roleId ?? "none"),
    queryFn: () => accessApi.rolePermissions(roleId as string),
    enabled: Boolean(roleId),
  });
}

export function useCreateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRoleInput) => accessApi.createRole(input),
    onSuccess: (role) => {
      queryClient.setQueryData<Role[]>(queryKeys.roles.list, (current) => (current ? [...current, role] : [role]));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.roles.list }),
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateRoleInput }) => accessApi.updateRole(id, input),
    onSuccess: (role) => {
      queryClient.setQueryData<Role[]>(queryKeys.roles.list, (current) =>
        current?.map((item) => (item.id === role.id ? role : item)),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.roles.list }),
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => accessApi.deleteRole(id),
    onSuccess: (_result, id) => {
      queryClient.setQueryData<Role[]>(queryKeys.roles.list, (current) => current?.filter((item) => item.id !== id));
      queryClient.removeQueries({ queryKey: queryKeys.roles.permissions(id) });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.roles.list }),
  });
}

export function useAssignPermissions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ role, permissionIds }: { role: Role; permissionIds: string[] }) =>
      accessApi.assignPermissions(role.id, permissionIds),
    onSuccess: (_result, { role, permissionIds }) => {
      const catalog = queryClient.getQueryData<Permission[]>(queryKeys.permissions.list) ?? [];
      const ids = new Set(permissionIds);
      queryClient.setQueryData<Permission[]>(
        queryKeys.roles.permissions(role.id),
        catalog.filter((permission) => ids.has(permission.id)),
      );
    },
    onSettled: (_result, _error, { role }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.roles.permissions(role.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.session });
    },
  });
}

export function useCreatePermission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePermissionInput) => accessApi.createPermission(input),
    onSuccess: (permission) => {
      queryClient.setQueryData<Permission[]>(queryKeys.permissions.list, (current) =>
        current ? [...current, permission] : [permission],
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.permissions.list }),
  });
}

export function useDeletePermission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => accessApi.deletePermission(id),
    onSuccess: (_result, id) => {
      queryClient.setQueryData<Permission[]>(queryKeys.permissions.list, (current) =>
        current?.filter((item) => item.id !== id),
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.permissions.list });
      void queryClient.invalidateQueries({ queryKey: queryKeys.roles.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.session });
    },
  });
}
