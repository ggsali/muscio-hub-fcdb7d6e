// Macht aus jeder Slicer-Fehlerantwort einen lesbaren Text (nie ein Objekt, das React zum Absturz bringt).
export function errorText(value: unknown): string | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((v) => errorText((v as any)?.msg ?? v)).filter(Boolean).join("; ") || undefined;
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    return errorText(v.message ?? v.msg ?? v.detail ?? v.error) ?? JSON.stringify(value);
  }
  return String(value);
}

export function slicerErrorMessage(status: number, raw?: unknown, maxMb = 50): string {
  const message = errorText(raw);
  if (status === 401 || status === 403) return "Keine Berechtigung: Admin-Anmeldung oder Slicer-Schlüssel prüfen.";
  if (status === 413) return `Die Datei ist zu gross (max. ${maxMb} MB).`;
  if (status === 504) return message ?? "Der Slicer hat nicht rechtzeitig geantwortet.";
  if (status === 422) return message ?? "Der Slicer konnte das Modell nicht verarbeiten.";
  if (status >= 500) return message ?? "Der Slicer ist gerade nicht erreichbar.";
  return message ?? `Unerwarteter Fehler (${status}).`;
}
