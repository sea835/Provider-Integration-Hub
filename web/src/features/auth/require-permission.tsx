"use client";

import type { ReactNode } from "react";
import { ForbiddenState } from "@/components/ui/states";
import type { Policy } from "@/lib/auth/policies";
import { usePermission } from "./session-provider";

export function RequirePermission({
  policy,
  description,
  children,
}: {
  policy: Policy;
  description?: string;
  children: ReactNode;
}) {
  const allowed = usePermission(policy);
  if (!allowed) return <ForbiddenState description={description} />;
  return children;
}
