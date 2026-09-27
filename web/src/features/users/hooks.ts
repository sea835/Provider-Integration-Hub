"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { User } from "@/lib/api/types";
import { queryKeys } from "@/lib/query-keys";
import { createUser, deleteUser, fetchAllUsers, updateUser, type UpdateUserInput } from "./api";

export function useUsers(enabled = true) {
  return useQuery({
    queryKey: queryKeys.users.list,
    queryFn: ({ signal }) => fetchAllUsers(signal),
    enabled,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createUser,
    onSuccess: (user) => {
      queryClient.setQueryData<User[]>(queryKeys.users.list, (current) => (current ? [user, ...current] : [user]));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.users.all }),
  });
}

interface UpdateVariables {
  id: string;
  input: UpdateUserInput;
  notice?: { title: string; description?: string };
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: UpdateVariables) => updateUser(id, input),
    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.users.list });
      const previous = queryClient.getQueryData<User[]>(queryKeys.users.list);
      const { password: _password, ...visible } = input;
      queryClient.setQueryData<User[]>(queryKeys.users.list, (current) =>
        current?.map((user) => (user.id === id ? { ...user, ...visible } : user)),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.users.list, context.previous);
    },
    onSuccess: (updated, { notice }) => {
      queryClient.setQueryData<User[]>(queryKeys.users.list, (current) =>
        current?.map((user) => (user.id === updated.id ? updated : user)),
      );
      if (notice) toast.success(notice.title, { description: notice.description });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.users.all }),
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (user: User) => deleteUser(user.id),
    onMutate: async (user) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.users.list });
      const previous = queryClient.getQueryData<User[]>(queryKeys.users.list);
      queryClient.setQueryData<User[]>(queryKeys.users.list, (current) =>
        current?.filter((item) => item.id !== user.id),
      );
      return { previous };
    },
    onError: (_error, _user, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.users.list, context.previous);
    },
    onSuccess: (_result, user) => {
      toast.success("Đã xóa người dùng", { description: user.email });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.users.all }),
  });
}
