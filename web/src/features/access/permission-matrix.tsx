"use client";

import { BracketsCurly, Plus } from "@phosphor-icons/react/ssr";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Hint } from "@/components/ui/tooltip";
import type { Permission } from "@/lib/api/types";
import { actionLabel, STANDARD_ACTIONS, SUBJECT_LABELS, subjectLabel } from "@/lib/auth/policies";
import { cn } from "@/lib/utils";

const SUBJECT_ORDER = Object.keys(SUBJECT_LABELS);

function orderIndex(list: string[], value: string): number {
  const index = list.indexOf(value);
  return index === -1 ? list.length : index;
}

function cellKey(subject: string, action: string): string {
  return `${subject}\u0000${action}`;
}

export function buildMatrix(permissions: Permission[]) {
  const cells = new Map<string, Permission>();
  const subjects = new Set<string>();
  const actions = new Set<string>(STANDARD_ACTIONS);
  for (const permission of permissions) {
    cells.set(cellKey(permission.subject, permission.action), permission);
    subjects.add(permission.subject);
    actions.add(permission.action);
  }
  const standard = STANDARD_ACTIONS as string[];
  return {
    cells,
    subjects: [...subjects].sort(
      (a, b) => orderIndex(SUBJECT_ORDER, a) - orderIndex(SUBJECT_ORDER, b) || a.localeCompare(b),
    ),
    actions: [...actions].sort((a, b) => orderIndex(standard, a) - orderIndex(standard, b) || a.localeCompare(b)),
  };
}

type CheckState = boolean | "indeterminate";

function groupState(ids: string[], selected: Set<string>): CheckState {
  if (ids.length === 0) return false;
  const count = ids.filter((id) => selected.has(id)).length;
  if (count === 0) return false;
  return count === ids.length ? true : "indeterminate";
}

interface PermissionMatrixProps {
  permissions: Permission[];
  selected: Set<string>;
  onToggle: (ids: string[], checked: boolean) => void;
  readOnly?: boolean;
  onCreate?: (preset: { action: string; subject: string }) => void;
}

export function PermissionMatrix({
  permissions,
  selected,
  onToggle,
  readOnly = false,
  onCreate,
}: PermissionMatrixProps) {
  const { cells, subjects, actions } = useMemo(() => buildMatrix(permissions), [permissions]);

  const idsFor = (predicate: (subject: string, action: string) => boolean) => {
    const ids: string[] = [];
    for (const subject of subjects) {
      for (const action of actions) {
        const permission = cells.get(cellKey(subject, action));
        if (permission && predicate(subject, action)) ids.push(permission.id);
      }
    }
    return ids;
  };

  return (
    <div className="scrollbar-thin overflow-x-auto">
      <table className="w-full min-w-[680px] border-separate border-spacing-0 text-sm">
        <caption className="sr-only">Ma trận phân quyền theo đối tượng và hành động</caption>
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky left-0 z-10 bg-card px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground"
            >
              Đối tượng
            </th>
            {actions.map((action) => {
              const ids = idsFor((_subject, candidate) => candidate === action);
              const state = groupState(ids, selected);
              return (
                <th key={action} scope="col" className="bg-card px-3 py-2.5 text-center align-bottom">
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-[13px] font-medium text-foreground">{actionLabel(action)}</span>
                    <span className="font-mono text-[11px] font-normal text-muted-foreground">{action}</span>
                    <Checkbox
                      checked={state}
                      disabled={readOnly || ids.length === 0}
                      onCheckedChange={() => onToggle(ids, state !== true)}
                      aria-label={`Chọn quyền “${actionLabel(action)}” cho mọi đối tượng`}
                    />
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {subjects.map((subject) => {
            const rowIds = idsFor((candidate) => candidate === subject);
            const rowState = groupState(rowIds, selected);
            const managePermission = cells.get(cellKey(subject, "manage"));
            const hasManage = Boolean(managePermission && selected.has(managePermission.id));
            return (
              <tr
                key={subject}
                className={cn(
                  "group/row even:bg-background",
                  hasManage && "bg-primary-soft/40 even:bg-primary-soft/40",
                )}
              >
                <th
                  scope="row"
                  className={cn(
                    "sticky left-0 z-10 px-4 py-2.5 text-left font-normal",
                    hasManage
                      ? "bg-[color-mix(in_oklch,var(--card)_80%,var(--primary-soft))]"
                      : "bg-card group-even/row:bg-background",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={rowState}
                      disabled={readOnly || rowIds.length === 0}
                      onCheckedChange={() => onToggle(rowIds, rowState !== true)}
                      aria-label={`Chọn mọi quyền trên “${subjectLabel(subject)}”`}
                    />
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-medium">
                        {subjectLabel(subject)}
                        {hasManage ? <Badge tone="primary">Toàn quyền</Badge> : null}
                      </p>
                      <p className="font-mono text-[11px] text-muted-foreground">{subject}</p>
                    </div>
                  </div>
                </th>
                {actions.map((action) => {
                  const permission = cells.get(cellKey(subject, action));
                  const label = `${actionLabel(action)} · ${subjectLabel(subject)}`;
                  return (
                    <td key={action} className="px-3 py-2.5 text-center">
                      {permission ? (
                        <span className="relative inline-flex items-center gap-1.5">
                          <Checkbox
                            checked={selected.has(permission.id)}
                            disabled={readOnly}
                            onCheckedChange={(checked) => onToggle([permission.id], checked === true)}
                            aria-label={label}
                          />
                          {permission.conditions ? (
                            <Hint
                              label={
                                <span className="block">
                                  <span className="mb-1 block font-medium">Điều kiện ABAC</span>
                                  <code className="font-mono">{JSON.stringify(permission.conditions)}</code>
                                </span>
                              }
                            >
                              <button
                                type="button"
                                className="inline-flex size-5 items-center justify-center rounded-sm text-warning hover:bg-warning-soft"
                                aria-label={`${label} có điều kiện ${JSON.stringify(permission.conditions)}`}
                              >
                                <BracketsCurly className="size-3.5" aria-hidden />
                              </button>
                            </Hint>
                          ) : null}
                        </span>
                      ) : onCreate && !readOnly ? (
                        <Hint label={`Tạo quyền ${action} · ${subject}`}>
                          <button
                            type="button"
                            onClick={() => onCreate({ action, subject })}
                            className="inline-flex size-6 items-center justify-center rounded-sm bg-muted text-muted-foreground opacity-0 transition-[opacity,background-color,color] group-hover/row:opacity-100 hover:bg-primary-soft hover:text-primary focus-visible:opacity-100 pointer-coarse:opacity-100"
                            aria-label={`Tạo quyền ${label}`}
                          >
                            <Plus className="size-3.5" aria-hidden />
                          </button>
                        </Hint>
                      ) : (
                        <span className="text-muted-foreground/50" aria-label="Chưa có quyền này">
                          -
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
