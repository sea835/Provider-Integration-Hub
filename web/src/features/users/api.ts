import { api } from "@/lib/api/client";
import type { SystemRole, User } from "@/lib/api/types";

const PAGE_SIZE = 100;
const MAX_PAGES = 50;

export async function fetchAllUsers(signal?: AbortSignal): Promise<User[]> {
  const users: User[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const batch = await api.get<User[]>("/users", { query: { page, limit: PAGE_SIZE }, signal });
    users.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return users;
}

export interface CreateUserInput {
  email: string;
  password: string;
  role: SystemRole;
}

export interface UpdateUserInput {
  email?: string;
  password?: string;
  role?: SystemRole;
  status?: string;
}

export function createUser(input: CreateUserInput): Promise<User> {
  return api.post<User>("/users", input);
}

export function updateUser(id: string, input: UpdateUserInput): Promise<User> {
  return api.patch<User>(`/users/${id}`, input);
}

export function deleteUser(id: string): Promise<unknown> {
  return api.delete<unknown>(`/users/${id}`);
}
