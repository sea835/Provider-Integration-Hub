import "server-only";
import { cookies } from "next/headers";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth/constants";
import type { AbilitiesResponse, Session, User } from "@/lib/api/types";
import { backendFetch } from "./backend";
import { isTokenFresh } from "./session";

export async function getServerSession(): Promise<Session | null> {
  const store = await cookies();
  const accessToken = store.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!isTokenFresh(accessToken)) return null;

  try {
    const [userResponse, abilityResponse] = await Promise.all([
      backendFetch("/auth/me", { accessToken }),
      backendFetch("/authorization/me/abilities", { accessToken }),
    ]);
    if (!userResponse.ok || !abilityResponse.ok) return null;
    const [user, abilities] = await Promise.all([
      userResponse.json() as Promise<User>,
      abilityResponse.json() as Promise<AbilitiesResponse>,
    ]);
    return { user, rules: abilities.rules };
  } catch {
    return null;
  }
}
