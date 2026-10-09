"use client";

import { BracketsCurly, Key, Prohibit } from "@phosphor-icons/react/ssr";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppAbility, useSession } from "@/features/auth/session-provider";
import { roleMeta } from "@/features/users/constants";
import { actionLabel, subjectLabel } from "@/lib/auth/policies";

function asList(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export function MyPermissionsCard() {
  const { user } = useSession();
  const ability = useAppAbility();
  const role = roleMeta(user.role);
  const entries = ability.rules.flatMap((rule, index) =>
    asList(rule.action as string | string[]).flatMap((action) =>
      asList(rule.subject as string | string[] | undefined).map((subject) => ({
        key: `${index}-${action}-${subject}`,
        action,
        subject,
        inverted: Boolean(rule.inverted),
        conditional: Boolean(rule.conditions),
      })),
    ),
  );

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Quyền của bạn</CardTitle>
          <CardDescription>
            Vai trò <span className="font-medium text-foreground">{role.label}</span> · lấy trực tiếp từ máy chủ phân
            quyền.
          </CardDescription>
        </div>
        <Key className="size-4 text-muted-foreground" aria-hidden />
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tài khoản chưa được cấp quyền nào.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {entries.map((entry) => (
              <li key={entry.key}>
                <Badge
                  tone={entry.inverted ? "danger" : entry.action === "manage" ? "primary" : "outline"}
                  className="py-1"
                >
                  {entry.inverted ? <Prohibit aria-hidden /> : null}
                  {entry.inverted ? "Không được " : ""}
                  {actionLabel(entry.action).toLowerCase()} · {subjectLabel(entry.subject)}
                  {entry.conditional ? (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <BracketsCurly aria-hidden />
                      có điều kiện
                    </span>
                  ) : null}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
