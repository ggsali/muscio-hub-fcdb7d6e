import React from "react";

/** Farbschema für Post-CH-Sendungsstatus */
export function trackingBadgeClass(status: string | null | undefined, zugestellt?: boolean | null): string {
  const s = (status || "").toLowerCase();
  if (zugestellt || s.includes("zugestellt") || s.includes("delivered")) {
    return "bg-green-500/20 text-green-500 border border-green-500/30";
  }
  if (s.includes("nicht zugestellt") || s.includes("fehler") || s.includes("retour")) {
    return "bg-red-500/20 text-red-500 border border-red-500/30";
  }
  if (s.includes("zustellung") || s.includes("unterwegs")) {
    return "bg-orange-500/20 text-orange-500 border border-orange-500/30";
  }
  if (s.includes("eingeliefert") || s.includes("sortier") || s.includes("bearbeitung")) {
    return "bg-blue-500/20 text-blue-400 border border-blue-500/30";
  }
  return "bg-muted text-muted-foreground border border-border";
}

/** "vor 5 Minuten" / "vor 2 Stunden" */
export function relativeZeit(iso: string | null | undefined): string {
  if (!iso) return "noch nie";
  const diffMs = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diffMs)) return "unbekannt";
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Minute${min === 1 ? "" : "n"}`;
  const std = Math.floor(min / 60);
  if (std < 24) return `vor ${std} Stunde${std === 1 ? "" : "n"}`;
  const tage = Math.floor(std / 24);
  return `vor ${tage} Tag${tage === 1 ? "" : "en"}`;
}

export const TrackingBadge: React.FC<{
  trackingNr?: string | null;
  status?: string | null;
  zugestellt?: boolean | null;
  lieferart?: string | null;
}> = ({ trackingNr, status, zugestellt, lieferart }) => {
  if (lieferart === "abholung" || (!trackingNr && !status)) {
    return <span className="status-badge bg-muted text-muted-foreground border border-border">Abholung</span>;
  }
  if (!status) {
    return <span className="status-badge bg-muted text-muted-foreground border border-border">Ausstehend</span>;
  }
  const label = zugestellt ? "✓ Zugestellt" : status.length > 25 ? `${status.slice(0, 25)}…` : status;
  return <span className={`status-badge ${trackingBadgeClass(status, zugestellt)}`}>{label}</span>;
};
