import type { StoreOverview } from "@keepcv/core";
import { live, overview } from "@keepcv/core";
import { authPath, readAuth } from "./auth.js";
import { type MirrorStatus, mirrorStatus } from "./mirror.js";
import { withStore } from "./store.js";

export interface StoreStatus {
  dataDir: string;
  resumes: number;
  templates: number;
  overview: StoreOverview;
  mirror: MirrorStatus | undefined;
  hasPassword: boolean;
}

export async function readStatus(dataDir: string, asOf: string): Promise<StoreStatus> {
  const held = await withStore(dataDir, async (r) => await r.store.readCurrent());

  return {
    dataDir,
    resumes: live(held.resumes).length,
    templates: live(held.templates).length,
    overview: overview(held, { asOf }),
    mirror: await mirrorStatus(dataDir),
    hasPassword: (await readAuth(dataDir)) !== undefined,
  };
}

function count(many: number, noun: string): string {
  return `${String(many)} ${noun}${many === 1 ? "" : "s"}`;
}

function kilobytes(bytes: number): string {
  return `${String(Math.max(1, Math.round(bytes / 1024)))} kB`;
}

function since(writtenAt: string, asOf: string): string {
  const minutes = Math.round((Date.parse(asOf) - Date.parse(writtenAt)) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${count(minutes, "minute")} ago`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${count(hours, "hour")} ago` : `${count(Math.round(hours / 24), "day")} ago`;
}

// The store answers these already, and they are the reason to look at a store
// without opening the app.
function worthALook(overview: StoreOverview): string[] {
  const { missingEndDate, pointsWithoutMetrics, expiringCertifications } = overview.unfinished;

  const lines = [
    ...(missingEndDate.length === 0
      ? []
      : [`    ${count(missingEndDate.length, "record")} with no end date`]),
    ...(pointsWithoutMetrics.length === 0
      ? []
      : [`    ${count(pointsWithoutMetrics.length, "point")} with no metric`]),
    ...expiringCertifications.map((entry) => {
      const on = entry.kind === "certification" ? entry.expiresOn : null;
      return `    ${entry.title ?? "Untitled"} expires${on === null ? " soon" : ` ${on}`}`;
    }),
  ];

  return lines.length === 0 ? [] : ["  Worth a look", ...lines, ""];
}

export function statusReport(status: StoreStatus, asOf: string): string {
  const { totals } = status.overview;

  const backup =
    status.mirror === undefined
      ? ["    No backup yet. `keepcv serve` writes one, and `keepcv backup` writes one now."]
      : [
          `    ${status.mirror.path}`,
          `    ${kilobytes(status.mirror.bytes)}, written ${since(status.mirror.writtenAt, asOf)}`,
        ];

  return [
    "",
    "  Store",
    `    ${status.dataDir}`,
    `    ${count(totals.records, "record")}, ${count(totals.points, "point")}, ${count(status.resumes, "resume")}`,
    `    ${String(totals.archived)} archived, ${count(status.templates, "design")} of your own`,
    "",
    "  Backup",
    ...backup,
    "",
    "  Sign-in",
    status.hasPassword
      ? `    A password is set in ${authPath(status.dataDir)}, so --auth password works.`
      : "    No password set. `keepcv serve` mints a token per launch; off loopback needs one.",
    "",
    ...worthALook(status.overview),
  ].join("\n");
}
