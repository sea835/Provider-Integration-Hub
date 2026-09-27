import { createMongoAbility, type MongoAbility, type RawRuleOf } from "@casl/ability";
import { unpackRules, type PackRule } from "@casl/ability/extra";
import type { PackedRule } from "@/lib/api/types";

export type AppAbility = MongoAbility;

const CLASS_BASED_SUBJECT = "User";

export function normalizePackedRules(rules: PackedRule[]): PackRule<RawRuleOf<AppAbility>>[] {
  return rules.map((rule) => {
    const copy = [...rule];
    if (copy[1] === null || copy[1] === undefined) copy[1] = CLASS_BASED_SUBJECT;
    return copy as PackRule<RawRuleOf<AppAbility>>;
  });
}

export function buildAbility(rules: PackedRule[]): AppAbility {
  return createMongoAbility(unpackRules(normalizePackedRules(rules)));
}
