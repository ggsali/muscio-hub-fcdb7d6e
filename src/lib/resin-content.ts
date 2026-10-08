/** Browser-safe shared filtering for public copy, metadata and AI manifests. */
export function isResinText(s?: string | null): boolean {
  return !!s && /resin|\bsla\b|\bmsla\b|\bdlp\b|stereolithograf|harzdruck/i.test(s);
}

export function stripResin(s: string): string {
  return s
    .replace(/FDM-?\s*und\s*(?:im\s+)?SLA\s*\/\s*Resin(?:-Verfahren|-Druck)?/gi, "FDM-Verfahren")
    .replace(/FDM-?\s*(?:und|&|sowie)\s*(?:im\s+)?SLA(?:\s*\/\s*Resin)?(?:-3D-Druck|-Verfahren|-Druck)?/gi, "FDM")
    .replace(/(?:,\s*)?FDM\s+vs\.?\s+SLA(?:\s*\/\s*Resin)?/gi, "")
    .replace(/\s*(?:&|und|sowie|,)\s*(?:SLA[-\s/]*)?Resin\b/gi, "")
    .replace(/\s*(?:&|und|sowie|,)\s*SLA(?:\s*\/\s*Resin|[-\s]Resin)?(?:-3D-Druck|-Verfahren|-Druck)?/gi, "")
    .split(/(?<=[.!?])\s+|\n/)
    .filter((sentence) => !isResinText(sentence))
    .join(s.includes("\n") ? "\n" : " ")
    .replace(/FDM-\s+Verfahren/g, "FDM-Verfahren")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Drop dedicated hidden entries rather than renaming their material/service. */
export function filterResinData(value: unknown): unknown {
  if (typeof value === "string") return stripResin(value);
  if (Array.isArray(value)) return value.filter((v) => !isDedicatedResin(v)).map(filterResinData);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, filterResinData(v)]));
  }
  return value;
}

function isDedicatedResin(value: unknown): boolean {
  if (typeof value === "string") return isResinText(value);
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return ["name", "q", "frage", "url", "to", "slug"].some((key) => typeof record[key] === "string" && isResinText(record[key] as string))
    || (record.itemOffered != null && isDedicatedResin(record.itemOffered));
}

export function parseResinEnabled(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (value && typeof value === "object" && "aktiv" in value) return value.aktiv !== false;
  return true;
}