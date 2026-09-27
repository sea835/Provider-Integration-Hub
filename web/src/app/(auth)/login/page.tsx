import type { Metadata } from "next";
import { LoginView } from "@/features/auth/login-view";
import { isSafeRedirect } from "@/lib/utils";

export const metadata: Metadata = { title: "Đăng nhập" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = typeof params.next === "string" && isSafeRedirect(params.next) ? params.next : "/";
  const reason = params.reason === "expired" || params.reason === "signed-out" ? params.reason : null;
  return <LoginView next={next} reason={reason} />;
}
