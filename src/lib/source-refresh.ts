import { createHash } from "node:crypto";
export {
  matchImportedSource,
  preserveEpisodeIdentity,
  reconcileEpisodes,
} from "./source-identity";
export type {
  ExistingEpisode,
  ExistingSourceIdentity,
} from "./source-identity";

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, stableValue(nestedValue)])
    );
  }

  return value;
}

export function canonicalHash(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(stableValue(payload))).digest("hex");
}
